/**
 * E2E Tests — Phase 2 Personal Growth Features
 *
 * Smoke tests for the Phase 2 pages: personal therapy chat,
 * mood tracker, and love languages assessment.
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e
 */
import { test, expect } from "@playwright/test";

// ── Helper: Sign up and get authenticated context ──
async function signUpAndAuth(page: import("@playwright/test").Page) {
  const email = `e2e-${Date.now()}@kuxani.app`;
  const password = "E2eTest123!";

  await page.goto("/signup");
  await page.waitForLoadState("networkidle");

  // Fill signup form
  await page.fill('input[name="name"], input[type="text"]', "E2E Tester");
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL("**/dashboard**", { timeout: 10000 });
}

// ── Personal Therapy Chat ──
test.describe("Personal Therapy Chat", () => {
  test("should load the chat list page", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Should see the page title
    await expect(page.locator("h1")).toContainText("Private Therapy");

    // Should see empty state or chat list
    const pageContent = await page.textContent("body");
    const hasEmptyState = pageContent?.includes("private sanctuary") ||
                          pageContent?.includes("Start Your First Chat");
    const hasChatList = pageContent?.includes("New Chat");

    expect(hasEmptyState || hasChatList).toBeTruthy();
  });

  test("should create a new chat", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Click the "New Chat" or "Start Your First Chat" button
    const newChatBtn = page.locator("button", { hasText: /New Chat|Start Your First Chat/ });
    await newChatBtn.first().click();

    // Should navigate to a chat page
    await page.waitForURL("**/personal/**", { timeout: 10000 });

    // Should see the chat interface
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("text=Your safe space")).toBeVisible();
  });
});

// ── Mood Tracker ──
test.describe("Mood Tracker", () => {
  test("should load the mood tracker page", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/mood");
    await page.waitForLoadState("networkidle");

    // Should see the page title
    await expect(page.locator("h1")).toContainText("Mood Tracker");
  });

  test("should display the emotion wheel", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/mood");
    await page.waitForLoadState("networkidle");

    // Should see the emotion buttons (Plutchik's 8)
    await expect(page.locator("text=How are you feeling")).toBeVisible();

    // Check that at least some emotions are visible
    const emotions = ["joy", "trust", "fear", "sadness", "anger"];
    for (const emotion of emotions) {
      await expect(page.locator(`text=${emotion}`).first()).toBeVisible();
    }
  });

  test("should select an emotion and show intensity slider", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/mood");
    await page.waitForLoadState("networkidle");

    // Click on "Joy" emotion
    await page.locator("text=joy").first().click();

    // Should show the intensity slider
    await expect(page.locator("text=Intensity")).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();

    // Should show the submit button
    await expect(page.locator("text=Log My Mood")).toBeVisible();
  });
});

// ── Love Languages Assessment ──
test.describe("Love Languages Assessment", () => {
  test("should load the start page", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/love-languages");
    await page.waitForLoadState("networkidle");

    // Should see the page title
    await expect(page.locator("h1")).toContainText("Love Languages");

    // Should see the start card
    await expect(page.locator("text=Discover Your Love Language")).toBeVisible();
    await expect(page.locator("text=Start Quiz")).toBeVisible();
  });

  test("should start the quiz and show first question", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/love-languages");
    await page.waitForLoadState("networkidle");

    // Click "Start Quiz"
    await page.locator("text=Start Quiz").click();

    // Should see question 1 of 30
    await expect(page.locator("text=Question 1 of 30")).toBeVisible();
    await expect(page.locator("text=Which statement resonates more")).toBeVisible();

    // Should see Option A and Option B
    await expect(page.locator("text=Option A")).toBeVisible();
    await expect(page.locator("text=Option B")).toBeVisible();
  });

  test("should advance through quiz questions", async ({ page }) => {
    await signUpAndAuth(page);
    await page.goto("/love-languages");
    await page.waitForLoadState("networkidle");

    // Start quiz
    await page.locator("text=Start Quiz").click();
    await expect(page.locator("text=Question 1 of 30")).toBeVisible();

    // Answer first question (click Option A)
    await page.locator("text=Option A").first().click();
    // Wait for next question
    await expect(page.locator("text=Question 2 of 30")).toBeVisible();

    // Answer second question (click Option B)
    await page.locator("text=Option B").first().click();
    await expect(page.locator("text=Question 3 of 30")).toBeVisible();
  });
});

// ── Navigation ──
test.describe("Dashboard Navigation", () => {
  test("should show all Phase 2 links in sidebar", async ({ page }) => {
    await signUpAndAuth(page);

    // Check sidebar navigation items
    await expect(page.locator("text=Private Therapy")).toBeVisible();
    await expect(page.locator("text=Mood Tracker")).toBeVisible();
    await expect(page.locator("text=Love Languages")).toBeVisible();
  });

  test("should navigate to each Phase 2 feature from sidebar", async ({ page }) => {
    await signUpAndAuth(page);

    // Navigate to Private Therapy
    await page.locator("text=Private Therapy").click();
    await page.waitForURL("**/personal**");
    await expect(page.locator("h1")).toContainText("Private Therapy");

    // Navigate to Mood Tracker
    await page.locator("text=Mood Tracker").click();
    await page.waitForURL("**/mood**");
    await expect(page.locator("h1")).toContainText("Mood Tracker");

    // Navigate to Love Languages
    await page.locator("text=Love Languages").click();
    await page.waitForURL("**/love-languages**");
    await expect(page.locator("h1")).toContainText("Love Languages");
  });
});
