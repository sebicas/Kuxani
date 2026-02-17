/**
 * E2E Tests — Couple Invite/Join Flow
 *
 * Tests the couple creation and invite UI:
 * 1. Solo user sees "Your Partner" card with invite CTA
 * 2. Clicking CTA shows invite code
 * 3. Dashboard shows couple-related content
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e
 */
import { test, expect } from "@playwright/test";
import { signUpAndAuth } from "./helpers";


test.describe("Couple Invite/Join Flow", () => {
  test("should show Your Partner card for solo user", async ({ page }) => {
    await signUpAndAuth(page);

    // Dashboard should show the "Your Partner" card
    await expect(page.locator("text=Your Partner").first()).toBeVisible();
  });

  test("should show couple creation CTA", async ({ page }) => {
    await signUpAndAuth(page, "inv");

    // Should see the "Create Couple & Get Invite Code" button
    await expect(
      page.locator("text=Create Couple & Get Invite Code").first(),
    ).toBeVisible();
  });

  test("should create couple and display invite code", async ({ page }) => {
    await signUpAndAuth(page, "inv");

    // Click the create couple button
    await page.locator("text=Create Couple & Get Invite Code").first().click();

    // Should show the invite code interface (Copy button confirms it loaded)
    await expect(
      page.getByRole("button", { name: "Copy", exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });
});
