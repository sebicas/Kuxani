import { test, expect } from "@playwright/test";

/**
 * E2E Auth Tests
 *
 * Tests the actual signup/login pages through a real browser.
 * This validates the full stack: HTML form → React → Better Auth client → HTTP → server → DB
 *
 * Run: npm run test:e2e
 */

// Unique email per test run to avoid conflicts
const testEmail = `e2e-${Date.now()}@kuxani.app`;
const testPassword = "TestPassword123!";
const testName = "E2E Test User";

test.describe("Auth Pages", () => {
  test("signup page renders correctly", async ({ page }) => {
    await page.goto("/signup");

    // Verify key elements are present
    await expect(page.locator("h1")).toHaveText("Begin your journey");
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    // Verify key elements are present
    await expect(page.locator("h1")).toHaveText("Welcome back");
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
  });

  test("signup creates account and redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Fill the signup form
    await page.fill('input[id="name"]', testName);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("login with valid credentials redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    // Fill the login form with credentials from signup test
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");

    // Fill with wrong password
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', "WrongPassword123!");

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message and stay on login page
    const errorDiv = page.locator('[class*="authError"]');
    await expect(errorDiv).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("signup page links to login", async ({ page }) => {
    await page.goto("/signup");
    await page.click('a[href="/login"]');
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("login page links to signup", async ({ page }) => {
    await page.goto("/login");
    await page.click('a[href="/signup"]');
    await page.waitForURL("**/signup");
    expect(page.url()).toContain("/signup");
  });
});
