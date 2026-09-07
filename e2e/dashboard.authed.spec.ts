import { test, expect } from "@playwright/test";

/**
 * The admin dashboard.
 *
 * /admin used to render the 404 page - there was no index route at all, and the
 * sidebar linked straight past it.
 *
 * The route is worth an end-to-end test rather than only a component one. The
 * first attempt used `<Route index>` inside the admin layout, which is
 * *pathless* - so index matched the parent's path, "/", and put the dashboard on
 * the home page behind AdminRoute, which redirects to "/". The storefront
 * stopped loading entirely. Every unit test still passed, because they render
 * the page directly and never exercise the route tree.
 */
test.describe("admin dashboard", () => {
  test("/admin is the dashboard, not a 404", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toHaveCount(0);
  });

  test("the storefront still owns the home page", async ({ page }) => {
    // The regression the index route caused: / behind AdminRoute, redirecting
    // to itself.
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("it leads with what needs doing", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("a queue tile actually filters the order list", async ({ page }) => {
    // A dashboard that reports a problem and then makes you go and find it is
    // half a feature - and the tab used to be local state, so this link was
    // silently ignored.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible();

    const tile = page.getByRole("link", { name: /to confirm/i });
    if ((await tile.count()) === 0) {
      test.skip(true, "nothing awaiting fulfilment to click through to");
    }
    await tile.click();

    await expect(page).toHaveURL(/status=awaiting_fulfillment/);
    await expect(page.getByRole("button", { name: "Awaiting Fulfillment" })).toHaveClass(
      /active/i,
    );
  });

  test("the sidebar reaches it", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: "Dashboard" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });
});
