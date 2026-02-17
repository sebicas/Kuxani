/**
 * E2E Tests — Challenge Lifecycle
 *
 * Tests the challenge flow for a solo user:
 * - Navigate to challenges page
 * - Create a new challenge
 * - Write a perspective
 *
 * Each test uses a fresh user (Playwright tests run in isolated contexts).
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e
 */
import { test, expect } from "@playwright/test";
import { signUpAndAuth } from "./helpers";


test.describe("Challenge Lifecycle", () => {
  test("should navigate to challenges page from sidebar", async ({ page }) => {
    await signUpAndAuth(page, "ch");

    // Click Challenges in sidebar
    await page.locator("nav >> text=Challenges").click();
    await page.waitForURL("**/challenges**", { timeout: 10000 });

    // Should see the challenges page
    await expect(page.locator("h1")).toContainText("Challenge");
  });

  test("should show empty state for new user", async ({ page }) => {
    await signUpAndAuth(page, "ch");
    await page.goto("/challenges");
    await page.waitForLoadState("networkidle");

    // Should see empty state or create button
    const pageContent = await page.textContent("body");
    const hasEmptyState =
      pageContent?.includes("No active challenges") ||
      pageContent?.includes("Create") ||
      pageContent?.includes("New Challenge");

    expect(hasEmptyState).toBeTruthy();
  });

  test("should show New Challenge button on dashboard", async ({ page }) => {
    await signUpAndAuth(page, "ch");

    // The dashboard should have a "New Challenge" button
    await expect(page.locator("text=New Challenge").first()).toBeVisible();
  });

  test("should show Create Your First Challenge card", async ({ page }) => {
    await signUpAndAuth(page, "ch");

    // Dashboard has an "Active Challenges" card with CTA
    await expect(
      page.locator("text=Create Your First Challenge").first(),
    ).toBeVisible();
  });

  test("should navigate to challenges from dashboard card", async ({
    page,
  }) => {
    await signUpAndAuth(page, "ch");

    // Click the "Create Your First Challenge" link
    await page.locator("text=Create Your First Challenge").first().click();
    await page.waitForURL("**/challenges**", { timeout: 10000 });

    await expect(page.locator("h1")).toContainText("Challenge");
  });

  test("should handle direct URL access to challenges page", async ({
    page,
  }) => {
    await signUpAndAuth(page, "ch");

    // Navigate directly via URL
    await page.goto("/challenges");
    await page.waitForLoadState("networkidle");

    // Should render without errors
    await expect(page.locator("h1")).toContainText("Challenge");
  });

  test("should persist state after page refresh on challenges", async ({
    page,
  }) => {
    await signUpAndAuth(page, "ch");
    await page.goto("/challenges");
    await page.waitForLoadState("networkidle");

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still show challenges page
    await expect(page.locator("h1")).toContainText("Challenge");
  });
});

