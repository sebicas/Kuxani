/**
 * Shared E2E Helpers
 *
 * Centralised sign-up / sign-in helpers with retry logic to
 * handle "Failed to create user" errors under concurrent load.
 */
import type { Page } from "@playwright/test";

let counter = 0;

/**
 * Sign up a new user and wait for dashboard redirect.
 * Retries up to 3 times if signup fails (DB contention under parallel tests).
 */
export async function signUpAndAuth(
  page: Page,
  prefix = "e2e",
  name = "E2E Tester",
): Promise<void> {
  const maxRetries = 3;
  const password = "E2eTest123!";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    counter++;
    const email = `${prefix}-${Date.now()}-${counter}@kuxani.app`;

    await page.goto("/signup");
    await page.waitForLoadState("networkidle");

    // Fill signup form
    await page.fill('input[name="name"], input[type="text"]', name);
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for either dashboard redirect or error message
    try {
      await page.waitForURL("**/dashboard**", { timeout: 15000 });
      return; // Success!
    } catch {
      // Check if there's an error message on the page
      const errorVisible = await page
        .locator("text=Failed to create user")
        .isVisible()
        .catch(() => false);

      if (errorVisible && attempt < maxRetries - 1) {
        // Wait a bit before retrying
        await page.waitForTimeout(1000 * (attempt + 1));
        continue;
      }

      // Last attempt or unexpected error — throw
      throw new Error(
        `signUpAndAuth failed after ${attempt + 1} attempts for ${email}`,
      );
    }
  }
}
