/**
 * E2E Tests — Intake Interview Wizard
 *
 * Tests the one-question-at-a-time wizard flow, progress persistence,
 * navigation, and modality toggle.
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e -- e2e/intake.spec.ts
 */
import { test, expect } from "@playwright/test";
import { signUpAndAuth } from "./helpers";

test.setTimeout(30_000);

test.describe("Intake Wizard — Intro", () => {
  test("should render intro screen at /intake", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Get to Know You");
    await expect(page.locator("#start-interview")).toBeVisible();
    await expect(page.locator("text=29 questions")).toBeVisible();
  });

  test("should show category tags on intro screen", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Relationship Basics")).toBeVisible();
    await expect(page.locator("text=What Brought You Here")).toBeVisible();
    await expect(page.locator("text=Growing Up")).toBeVisible();
  });
});

test.describe("Intake Wizard — Interview Flow", () => {
  test("should start interview and show first question", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    // First question should be relationship stage
    await expect(
      page.locator("text=What stage is your relationship in?")
    ).toBeVisible();
    await expect(page.locator("text=Question 1 of")).toBeVisible();
  });

  test("should navigate forward when answering a question", async ({
    page,
  }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    // Answer first question
    await page.locator('button:has-text("Married")').first().click();

    // Click next
    await page.locator("#nav-next").click();
    await page.waitForTimeout(500);

    // Should be on question 2
    await expect(page.locator("text=Question 2 of")).toBeVisible();
  });

  test("should navigate backward", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    // Answer and go to Q2
    await page.locator('button:has-text("Dating")').first().click();
    await page.locator("#nav-next").click();
    await page.waitForTimeout(500);

    // Go back
    await page.locator("#nav-back").click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Question 1 of")).toBeVisible();
  });

  test("should skip a question", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    // Skip without answering
    await page.locator("#nav-skip").click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Question 2 of")).toBeVisible();
  });

  test("should show progress bar", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    const progressBar = page.locator('[class*="progressBar"]');
    await expect(progressBar).toBeVisible();

    const progressFill = page.locator('[class*="progressFill"]');
    await expect(progressFill).toBeVisible();
  });

  test("should show category badge", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    // First question is in "Relationship Basics" category
    await expect(
      page.locator('[class*="categoryBadge"]').first()
    ).toContainText("Relationship Basics");
  });
});

test.describe("Intake Wizard — Modality Toggle", () => {
  test("should show modality toggle with Type active", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await page.locator("#start-interview").click();
    await page.waitForTimeout(500);

    await expect(page.locator("#modality-type")).toBeVisible();
    await expect(page.locator("#modality-chat")).toBeVisible();
    await expect(page.locator("#modality-voice")).toBeVisible();

    // Chat and Voice should be disabled
    await expect(page.locator("#modality-chat")).toBeDisabled();
    await expect(page.locator("#modality-voice")).toBeDisabled();
  });
});

test.describe("Intake Wizard — Direct URL", () => {
  test("should handle direct URL access to /intake", async ({ page }) => {
    await signUpAndAuth(page, "in");
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Get to Know You");
  });
});
