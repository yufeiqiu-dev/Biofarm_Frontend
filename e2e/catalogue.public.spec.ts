import { test, expect } from "@playwright/test";

/**
 * The catalogue, signed out.
 *
 * Everything here must work without an account: this is what a researcher
 * comparing suppliers sees before deciding to create one. These carry no stored
 * session by design - see the "public" project in playwright.config.ts.
 */

test("the home page leads with the catalogue, not a loading state", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /antibodies and diagnostic kits/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured Products" })).toBeVisible();

  // Nothing should still be loading once the page has settled. This is the
  // check that would have caught the loading state that used to sit here as a
  // full-screen scrim.
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the listing shows price, size and availability for every product", async ({ page }) => {
  await page.goto("/products");

  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    // Every card carries the things a buyer compares. A product with no price
    // or no availability is the failure this catches.
    //
    // .first() on the availability because an out-of-stock card says so twice -
    // once as the value and once on the disabled button - and both are correct.
    await expect(card.getByText(/^\$|^from \$/)).toBeVisible();
    await expect(card.getByText(/in stock|left|out of stock/i).first()).toBeVisible();
  }
});

test("an out-of-stock product cannot be added to the cart", async ({ page }) => {
  await page.goto("/products");

  const soldOut = page.locator("article").filter({ hasText: /out of stock/i }).first();

  // Skipped rather than failed if the fixture data has none: the assertion is
  // about behaviour, and inventing stock here would change the environment the
  // other tests run against.
  const present = await soldOut.count();
  test.skip(present === 0, "No out-of-stock product in this environment.");

  const button = soldOut.getByRole("button", { name: /out of stock/i });
  await expect(button).toBeDisabled();
});

test("a tag filters the listing and can be cleared", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator("article").first()).toBeVisible();

  const all = await page.locator("article").count();
  const filter = page.getByRole("button", { name: "Standards" });
  test.skip((await filter.count()) === 0, "No Standards tag in this environment.");

  await filter.click();
  await expect(page).toHaveURL(/tag=Standards/);
  const filtered = await page.locator("article").count();
  expect(filtered).toBeLessThanOrEqual(all);

  await filter.click();
  await expect(page).not.toHaveURL(/tag=/);
});

test("a product page leads with its catalog ID and can switch size", async ({ page }) => {
  await page.goto("/products");
  await page.locator("article").first().getByRole("heading").click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}/);

  // The catalog ID is the product's real name and was missing from this page
  // entirely until recently.
  const catalogId = page.locator("main").getByText(/^[A-Z]{2,4}-\d+$/).first();
  await expect(catalogId).toBeVisible();

  const sizes = page.getByRole("radio");
  if ((await sizes.count()) > 1) {
    const panel = page.locator("dl").first();
    const before = await panel.textContent();
    await sizes.nth(1).check();
    await expect(panel).not.toHaveText(before ?? "");
  }
});

test("signing out is not required to browse, but buying prompts for it", async ({ page }) => {
  await page.goto("/products");

  const addToCart = page
    .locator("article")
    .filter({ hasNot: page.getByRole("button", { name: /out of stock/i }) })
    .first()
    .getByRole("button", { name: "Add to cart" });

  await addToCart.click();

  // It explains rather than silently doing nothing or bouncing to a 404, which
  // is what it used to do.
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
});
