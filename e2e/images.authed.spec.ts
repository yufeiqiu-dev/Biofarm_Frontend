import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Product images, end to end.
 *
 * The parts worth driving in a real browser rather than in jsdom: the OS file
 * picker accepting several files at once, reordering surviving as *staged*
 * state with nothing sent until Save, and the customer-facing viewer, which is
 * about focus, keys and scrolling - none of which jsdom judges honestly.
 *
 * Nothing here saves. The admin assertions are all about what has *not* been
 * sent yet, so the fixture product is left exactly as it was found.
 */

const PRODUCT_WITH_TWO_IMAGES = "e7a5ed44-691c-4e49-ae3c-87e2d9a0e304";

/** A real file on disk, since a file input cannot be given a fake one. */
function makeImageFile(name: string): string {
  // A 1x1 PNG. Small enough to be free, real enough for the input to accept it.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const file = path.join(os.tmpdir(), name);
  fs.writeFileSync(file, png);
  return file;
}

/** Counts the "(n/10)" the images panel shows. */
async function imageCount(page: Page): Promise<number> {
  const text = await page.locator("h2", { hasText: "Product Images" }).innerText();
  return Number(/\((\d+)\/\d+\)/.exec(text)?.[1] ?? -1);
}

test.describe("admin product images", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/admin/products/${PRODUCT_WITH_TWO_IMAGES}`);
    await expect(page.getByLabel("Product Name")).toBeVisible();
  });

  test("several files can be chosen in one go", async ({ page }) => {
    // This is what `multiple` buys. Before it, the handler took files[0] and
    // adding six images meant six trips through the picker.
    const before = await imageCount(page);

    await page.getByLabel("Add an image").setInputFiles([
      makeImageFile("e2e-one.png"),
      makeImageFile("e2e-two.png"),
      makeImageFile("e2e-three.png"),
    ]);

    await expect
      .poll(() => imageCount(page), { message: "all three should have been queued" })
      .toBe(before + 3);
  });

  test("choosing files uploads nothing until Save", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/images/**", (route) => {
      sent.push(route.request().method());
      return route.continue();
    });

    await page.getByLabel("Add an image").setInputFiles([makeImageFile("e2e-staged.png")]);
    await expect.poll(() => imageCount(page)).toBeGreaterThan(2);

    expect(sent, "the deferred-save contract").toEqual([]);
  });

  test("an image can be moved later and earlier", async ({ page }) => {
    const first = page.locator('[class*="imageItem"]').first();
    const originalSrc = await first.locator("img").getAttribute("src");

    await page.getByRole("button", { name: "Move image 1 later" }).click();

    // The image that was first is now second.
    const nowSecond = page.locator('[class*="imageItem"]').nth(1).locator("img");
    await expect(nowSecond).toHaveAttribute("src", originalSrc!);

    await page.getByRole("button", { name: "Move image 2 earlier" }).click();
    await expect(page.locator('[class*="imageItem"]').first().locator("img")).toHaveAttribute(
      "src",
      originalSrc!,
    );
  });

  test("the ends cannot be moved past", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Move image 1 earlier" })).toBeDisabled();

    const count = await page.locator('[class*="imageItem"]').count();
    await expect(
      page.getByRole("button", { name: `Move image ${count} later` }),
    ).toBeDisabled();
  });

  test("reordering sends nothing on its own", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/api/v1/admin/products/**", (route) => {
      if (route.request().method() !== "GET") sent.push(route.request().method());
      return route.continue();
    });

    await page.getByRole("button", { name: "Move image 1 later" }).click();
    await page.waitForTimeout(400);

    expect(sent, "a reorder is staged, like a deletion").toEqual([]);
  });
});

test.describe("customer image viewer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/products/${PRODUCT_WITH_TWO_IMAGES}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the product page says which image is showing", async ({ page }) => {
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
  });

  test("the image opens full size", async ({ page }) => {
    // At 320px a western blot cannot be read, and the blot is the evidence
    // someone is buying on.
    await page.getByRole("button", { name: /view .* full size/i }).click();

    const viewer = page.getByRole("dialog");
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveAttribute("aria-modal", "true");

    const enlarged = viewer.getByRole("img");
    const box = await enlarged.boundingBox();
    expect(box!.width, "larger than the 320px it was on the page").toBeGreaterThan(320);
  });

  test("arrow keys move through the images and Escape closes", async ({ page }) => {
    await page.getByRole("button", { name: /view .* full size/i }).click();
    const viewer = page.getByRole("dialog");
    await expect(viewer).toBeVisible();

    await expect(viewer.getByText(/^1 of \d+$/)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByText(/^2 of \d+$/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
  });

  test("the page behind cannot be scrolled while it is open", async ({ page }) => {
    await page.getByRole("button", { name: /view .* full size/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
  });

  test("focus goes into the viewer and comes back out", async ({ page }) => {
    const opener = page.getByRole("button", { name: /view .* full size/i });
    await opener.click();

    await expect(page.getByRole("button", { name: "Close image viewer" })).toBeFocused();

    await page.keyboard.press("Escape");
    // Returned to what opened it, rather than dumped at the top of the page.
    await expect(opener).toBeFocused();
  });
});
