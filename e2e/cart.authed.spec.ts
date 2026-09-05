import { test, expect, type Page } from "@playwright/test";

/**
 * The cart, signed in as the seeded test account.
 *
 * The cart is client-side and persisted per user under `cart:{user_id}`, so the
 * interesting behaviour is what survives a reload - which is where the bug lived
 * where a paid-for cart came back out of storage after checkout.
 */

/**
 * The sliding panel.
 *
 * It is always in the DOM and moves with a transform, so `toBeVisible` is true
 * even when it is parked off-screen. `toBeInViewport` is the assertion that
 * actually distinguishes open from closed.
 */
function sidebar(page: Page) {
  return page.locator('aside[class*="cartSideBar"]');
}

function navbarCartButton(page: Page) {
  // Scoped to the header: an unscoped /cart/i also matches "Close cart" inside
  // the panel, which is a strict-mode violation rather than a useful locator.
  return page.getByRole("banner").getByRole("button", { name: /cart/i });
}

async function addFirstAvailableProduct(page: Page) {
  await page.goto("/products");

  const card = page
    .locator("article")
    .filter({ hasNot: page.getByRole("button", { name: /out of stock/i }) })
    .first();

  const name = (await card.getByRole("heading").textContent())?.trim() ?? "";
  await card.getByRole("button", { name: "Add to cart" }).click();

  // The button reports the change, so the test waits on the application rather
  // than on a timer.
  await expect(card.getByRole("button", { name: "In cart" })).toBeVisible();
  return name;
}

test("an added product is in the cart", async ({ page }) => {
  const name = await addFirstAvailableProduct(page);

  // Adding does not open the panel. AddToCartButton only opens it when the item
  // is already there, so a first add is silent apart from the button changing
  // to "In cart" - deliberate, and the reason this clicks Cart itself.
  await navbarCartButton(page).click();

  await expect(sidebar(page)).toBeInViewport();
  await expect(sidebar(page).getByText(name)).toBeVisible();
});

test("adding something already in the cart opens the cart rather than duplicating it", async ({ page }) => {
  const name = await addFirstAvailableProduct(page);

  const card = page.locator("article").filter({ hasText: name }).first();
  await card.getByRole("button", { name: "In cart" }).click();

  await expect(sidebar(page)).toBeInViewport();
  // One line, not two. Items dedupe by variant.
  await expect(sidebar(page).getByText(name)).toHaveCount(1);
});

test("the cart survives a reload", async ({ page }) => {
  const name = await addFirstAvailableProduct(page);

  await page.reload();
  await navbarCartButton(page).click();

  // Persistence is keyed on the Cognito sub, so this also proves the session was
  // restored and the key resolved to the same account.
  await expect(sidebar(page)).toBeInViewport();
  await expect(sidebar(page).getByText(name)).toBeVisible();
});

test("a quantity change survives a reload", async ({ page }) => {
  await addFirstAvailableProduct(page);
  await navbarCartButton(page).click();

  const panel = sidebar(page);
  await expect(panel).toBeInViewport();

  // The quantity readout specifically. A bare "2" also matches the header's
  // item count, which is the same number for the same reason and so proves
  // nothing about the control.
  const quantity = panel.locator('[class*="quantityValue"]').first();

  await panel.getByRole("button", { name: "+", exact: true }).first().click();
  await expect(quantity).toHaveText("2");

  await page.reload();
  await navbarCartButton(page).click();
  await expect(sidebar(page).locator('[class*="quantityValue"]').first()).toHaveText("2");
});

test("the cart can be emptied item by item", async ({ page }) => {
  await addFirstAvailableProduct(page);
  await navbarCartButton(page).click();

  const panel = sidebar(page);
  await expect(panel).toBeInViewport();

  await panel.getByRole("button", { name: "Remove item" }).first().click();

  await expect(panel.getByText(/your cart is empty|no items/i)).toBeVisible();
});

test("checkout is reachable with items in the cart", async ({ page }) => {
  await addFirstAvailableProduct(page);

  await page.goto("/checkout");

  // Stops short of paying. With STRIPE_BYPASS=false that means a real Stripe
  // PaymentElement and a webhook, which belongs in its own spec rather than
  // being smuggled into a cart test.
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole("heading").first()).toBeVisible();
});
