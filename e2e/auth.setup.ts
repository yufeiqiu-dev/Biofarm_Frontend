import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

/**
 * Signs in once and saves the session for every authenticated spec.
 *
 * Sign-in leaves the application entirely: `signInWithRedirect` sends the
 * browser to the Cognito hosted UI on amazoncognito.com and it comes back to
 * /auth/callback with a code. Doing that per test would be slow and would put
 * a third-party page in the failure path of every assertion, so it runs once
 * here and the rest reuse the stored state.
 */
setup("sign in", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  // A clear failure rather than a confusing one on the hosted UI's error page.
  expect(
    email && password,
    "Set E2E_EMAIL and E2E_PASSWORD in .env.e2e (see .env.e2e.example).",
  ).toBeTruthy();

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Cognito's managed login asks for the address and the password on separate
  // screens. The first is skipped when it already knows who you are, so it is
  // conditional rather than assumed.
  await page.waitForURL(/amazoncognito\.com/);

  const emailField = page.locator('input[name="username"]');
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(email!);
    await page.getByRole("button", { name: "Next" }).click();
  }

  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole("button", { name: "Continue" }).click();

  // Back on the application, signed in. Asserting on the address rather than on
  // the absence of a "Sign in" button, which would also pass on a page that
  // failed to render at all.
  await page.waitForURL((url) => url.origin === new URL(page.url()).origin, {
    timeout: 20_000,
  });
  await expect(page.getByText(email!, { exact: false })).toBeVisible({
    timeout: 20_000,
  });

  await page.context().storageState({ path: STORAGE_STATE });
});
