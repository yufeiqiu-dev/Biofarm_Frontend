import { test, expect, type Page } from "@playwright/test";

/**
 * The cart, signed in as the seeded test account.
 *
 * The cart is client-side and persisted per user under `cart:{user_id}`, so the
 * interesting behaviour is what survives a reload - which is where the bug lived
 * where a paid-for cart came back out of storage after checkout.
 */

/**
 * The sliding panel, by its accessible name.
 *
 * Addressed by its accessible name rather than by a hashed CSS class, which is
 * what the aria-label on the panel bought.
 *
 * Still paired with toBeInViewport rather than toBeVisible. The panel never
 * leaves the DOM and moves on a transform, so it is "visible" to Playwright
 * while parked off-screen; and Playwright does not model `inert`, so a role
 * query resolves whether it is open or not.
 */
function sidebar(page: Page) {
  return page.getByRole("complementary", { name: "Shopping cart" });
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

  // Addressed by what the buttons are for rather than by their glyphs, now
  // that they carry the name of the line they act on.
  await panel.getByRole("button", { name: /increase quantity of/i }).first().click();

  // The readout specifically. A bare "2" also matches the header's item count,
  // which is the same number for the same reason and so proves nothing.
  const quantity = panel.locator('[class*="quantityValue"]').first();
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

  await panel.getByRole("button", { name: /remove .* from cart/i }).first().click();

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

test("a closed cart refuses keyboard focus", async ({ page }) => {
  // The panel never leaves the DOM, so before it was made inert its buttons sat
  // in the tab order the whole time and a keyboard user could tab into a cart
  // that was not on screen.
  //
  // Asserted by trying to focus a control inside it rather than by looking for
  // the attribute: inert refusing focus is the behaviour, and Playwright's
  // getByRole does not model inert, so a role query still resolves here.
  await addFirstAvailableProduct(page);
  await page.goto("/products");

  const closed = await page.evaluate(() => {
    const panel = document.querySelector('aside[aria-label="Shopping cart"]');
    const button = panel?.querySelector("button");
    button?.focus();
    return {
      panelExists: !!panel,
      buttonExists: !!button,
      inert: panel?.hasAttribute("inert") ?? false,
      tookFocus: document.activeElement === button,
    };
  });

  expect(closed.panelExists).toBe(true);
  expect(closed.buttonExists).toBe(true);
  expect(closed.inert).toBe(true);
  expect(closed.tookFocus).toBe(false);

  // And once open it is focusable again, or the fix would just be a cart nobody
  // can use.
  await navbarCartButton(page).click();
  await expect(sidebar(page)).toBeInViewport();

  const open = await page.evaluate(() => {
    const panel = document.querySelector('aside[aria-label="Shopping cart"]');
    const button = panel?.querySelector("button");
    button?.focus();
    return { inert: panel?.hasAttribute("inert") ?? false, tookFocus: document.activeElement === button };
  });

  expect(open.inert).toBe(false);
  expect(open.tookFocus).toBe(true);
});
