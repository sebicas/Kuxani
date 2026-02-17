/**
 * E2E Tests — Phase 3 Batch 1: Gratitude Journal & Emergency De-escalation
 *
 * Smoke tests for the Batch 1 pages: gratitude journal and
 * emergency de-escalation mode.
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e
 */
import { test, expect } from "@playwright/test";
import { signUpAndAuth } from "./helpers";


// ── Gratitude Journal ──
test.describe("Gratitude Journal", () => {
  test("should load the gratitude page with title", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/gratitude");
    await page.waitForLoadState("networkidle");

    // Should see the page title
    await expect(page.locator("h1")).toContainText("Gratitude Journal");
  });

  test("should show daily prompt card or entry form", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/gratitude");
    await page.waitForLoadState("networkidle");

    // Should see either the prompt card or the new entry button
    const pageContent = await page.textContent("body");
    const hasPrompt = pageContent?.includes("Write About This");
    const hasNewEntry = pageContent?.includes("New Entry");

    expect(hasPrompt || hasNewEntry).toBeTruthy();
  });

  test("should open entry form when clicking New Entry", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/gratitude");
    await page.waitForLoadState("networkidle");

    // Click "New Entry" button
    await page.locator("text=New Entry").click();

    // Should see the entry form
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("text=Save Entry")).toBeVisible();
  });

  test("should show category picker in entry form", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/gratitude");
    await page.waitForLoadState("networkidle");

    await page.locator("text=New Entry").click();

    // Should see category options
    await expect(page.locator("text=Gratitude").first()).toBeVisible();
    await expect(page.locator("text=Love Note").first()).toBeVisible();
    await expect(page.locator("text=Appreciation").first()).toBeVisible();
  });

  test("should create an entry via the form", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/gratitude");
    await page.waitForLoadState("networkidle");

    // Open form
    await page.locator("text=New Entry").click();

    // Write content
    await page.fill("textarea", "I'm grateful for this beautiful day with my partner.");

    // Submit
    await page.locator("text=Save Entry").click();

    // Should see the entry in the feed
    await expect(
      page.locator("text=I'm grateful for this beautiful day with my partner.")
    ).toBeVisible({ timeout: 5000 });
  });
});

// ── Emergency De-escalation ──
test.describe("Emergency De-escalation", () => {
  test("should navigate to de-escalation from FAB button", async ({ page }) => {
    await signUpAndAuth(page);

    // Click the emergency FAB
    await page.locator('[aria-label="Emergency De-escalation Mode"]').click();
    await page.waitForURL("**/deescalation**", { timeout: 10000 });

    // Should see the de-escalation title
    await expect(page.locator("h1")).toContainText("Emergency De-escalation");
  });

  test("should show breathing exercise UI", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/deescalation");
    await page.waitForLoadState("networkidle");

    // Should see the breathing phase button
    await expect(page.locator("text=🌬️ Breathe")).toBeVisible();

    // Should see the start button
    await expect(page.locator("text=Start Breathing Exercise")).toBeVisible();
  });

  test("should start breathing exercise and show controls", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/deescalation");
    await page.waitForLoadState("networkidle");

    // Start breathing
    await page.locator("text=Start Breathing Exercise").click();

    // Should show the "I Feel Calmer" button
    await expect(page.locator("text=I Feel Calmer")).toBeVisible({ timeout: 5000 });

    // Should show 4-7-8 instruction
    await expect(page.locator("text=4-7-8 breathing")).toBeVisible();
  });

  test("should show phase navigation with all phases", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/deescalation");
    await page.waitForLoadState("networkidle");

    // Should show all phase buttons
    await expect(page.locator("text=🌬️ Breathe")).toBeVisible();
    await expect(page.locator("text=⏱️ Cool Down")).toBeVisible();
    await expect(page.locator("text=💡 Prompts")).toBeVisible();
    await expect(page.locator("text=📝 Reflect")).toBeVisible();
  });

  test("should navigate to timer phase and show options", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/deescalation");
    await page.waitForLoadState("networkidle");

    // Click timer phase
    await page.locator("text=⏱️ Cool Down").click();

    // Should show timer options (wait for phase switch to render)
    await expect(page.getByRole("button", { name: "5 min", exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "10 min", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "15 min", exact: true })).toBeVisible();
  });
});

// ── Dashboard & Sidebar Navigation ──
test.describe("Batch 1 Navigation", () => {
  test("should show Gratitude link in sidebar", async ({ page }) => {
    await signUpAndAuth(page);

    // Scope to nav to avoid matching dashboard card content
    await expect(page.locator("nav >> text=Gratitude")).toBeVisible();
  });

  test("should navigate to gratitude from sidebar", async ({ page }) => {
    await signUpAndAuth(page);

    // Click sidebar link
    await page.locator("nav >> text=Gratitude").click();
    await page.waitForURL("**/gratitude**");
    await expect(page.locator("h1")).toContainText("Gratitude Journal");
  });

  test("should navigate to gratitude from dashboard card", async ({ page }) => {
    await signUpAndAuth(page);

    // Click the gratitude card on dashboard
    await page.locator("text=Write a Note →").click();
    await page.waitForURL("**/gratitude**");
    await expect(page.locator("h1")).toContainText("Gratitude Journal");
  });

  test("should show Weekly Check-In in sidebar", async ({ page }) => {
    await signUpAndAuth(page);

    await expect(page.locator("text=Weekly Check-In")).toBeVisible();
  });
});
