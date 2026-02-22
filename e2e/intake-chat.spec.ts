/**
 * E2E Tests — Intake Chat Continuation
 *
 * Tests the flow where a returning user selects "Chat" modality on the
 * Welcome Back screen and continues their intake via a personal chat.
 *
 * Covers:
 * - Welcome Back page with modality selector
 * - Selecting Chat and clicking "Continue Interview"
 * - Redirect to personal chat with ?intake=1
 * - Auto-sent intake trigger message
 * - AI response streaming (no intake_data blocks visible)
 * - Chat title set to "Intake Interview"
 * - Textarea auto-focus after AI responds
 *
 * Requires: Running dev server (auto-started by Playwright config)
 * Run: npm run test:e2e -- e2e/intake-chat.spec.ts
 */
import { test, expect } from "@playwright/test";
import { signUpAndAuth } from "./helpers";

test.setTimeout(60_000);

/**
 * Helper: Sign up, complete at least one intake question, then return to /intake.
 * This ensures the user sees "Welcome Back" instead of the fresh intro.
 */
async function signUpAndStartIntake(page: import("@playwright/test").Page) {
  await signUpAndAuth(page, "ic");
  await page.goto("/intake");
  await page.waitForLoadState("networkidle");

  // Start interview (fresh user)
  await page.locator("#start-interview").click();
  await page.waitForTimeout(500);

  // Answer the first question so we become a "returning" user
  const marriedBtn = page.locator('button:has-text("Married")').first();
  if (await marriedBtn.isVisible()) {
    await marriedBtn.click();
    await page.locator("#nav-next").click();
    await page.waitForTimeout(500);
  }
}

test.describe("Intake Chat Continuation — Welcome Back", () => {
  test("should show Welcome Back page with Chat modality option", async ({
    page,
  }) => {
    await signUpAndStartIntake(page);

    // Navigate back to /intake — should see Welcome Back
    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Verify Welcome Back UI
    await expect(page.locator("text=Welcome Back!")).toBeVisible();
    await expect(
      page.locator("text=Ready to pick up where you left off")
    ).toBeVisible();

    // Verify all modality buttons are visible
    await expect(page.locator("#intro-modality-type")).toBeVisible();
    await expect(page.locator("#intro-modality-chat")).toBeVisible();
    await expect(page.locator("#intro-modality-voice")).toBeVisible();

    // Verify Continue Interview button
    await expect(page.locator("#start-interview")).toContainText(
      "Continue Interview"
    );
  });

  test("should select Chat modality and navigate to personal chat", async ({
    page,
  }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat modality
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);

    // Click Continue Interview
    await page.locator("#start-interview").click();

    // Should redirect to a personal chat with ?intake=1
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Verify we're on a personal chat page
    const url = page.url();
    expect(url).toContain("/personal/");
    expect(url).toContain("intake=1");
  });
});

test.describe("Intake Chat Continuation — Chat Interface", () => {
  test("should auto-send the intake trigger message", async ({ page }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat and continue
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);
    await page.locator("#start-interview").click();
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Wait for the auto-sent trigger message to appear
    await expect(
      page.locator("text=I'm ready to continue with my intake interview")
    ).toBeVisible({ timeout: 10000 });
  });

  test("should receive AI response without intake_data blocks visible", async ({
    page,
  }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat and continue
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);
    await page.locator("#start-interview").click();
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Wait for AI response (indicated by the AI avatar 🌿)
    const aiMessage = page.locator("text=🌿").first();
    await expect(aiMessage).toBeVisible({ timeout: 30000 });

    // Wait a bit for streaming to complete
    await page.waitForTimeout(5000);

    // Verify no intake_data blocks are visible in the page
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("intake_data");
    expect(pageText).not.toContain('"phase"');
    expect(pageText).not.toContain('"individualData"');
  });

  test("should set chat title to 'Intake Interview'", async ({ page }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat and continue
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);
    await page.locator("#start-interview").click();
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Wait for AI response to finish (the title is set after the first exchange)
    const aiMessage = page.locator("text=🌿").first();
    await expect(aiMessage).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(3000);

    // The chat header title should show "Intake Interview"
    await expect(
      page.locator('[class*="chatHeaderTitle"]')
    ).toContainText("Intake Interview", {
      timeout: 5000,
    });
  });

  test("should focus textarea after AI responds", async ({ page }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat and continue
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);
    await page.locator("#start-interview").click();
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Wait for AI response to complete
    const aiMessage = page.locator("text=🌿").first();
    await expect(aiMessage).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(5000);

    // The textarea should be focused — verify by checking if we can type
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Type something — should work without clicking first
    await page.keyboard.type("Testing auto-focus");
    const textareaValue = await textarea.inputValue();
    expect(textareaValue).toContain("Testing auto-focus");
  });

  test("should allow user to send a follow-up message after AI responds", async ({
    page,
  }) => {
    await signUpAndStartIntake(page);

    await page.goto("/intake");
    await page.waitForLoadState("networkidle");

    // Select Chat and continue
    await page.locator("#intro-modality-chat").click();
    await page.waitForTimeout(300);
    await page.locator("#start-interview").click();
    await page.waitForURL("**/personal/**?intake=1", { timeout: 10000 });

    // Wait for AI response
    const aiAvatar = page.locator("text=🌿").first();
    await expect(aiAvatar).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(5000);

    // Type and send a follow-up message
    const textarea = page.locator("textarea");
    await textarea.fill(
      "My parents had a difficult relationship growing up."
    );

    // Press Enter to send (or click send button)
    await page.keyboard.press("Enter");

    // Wait for the user message to appear
    await expect(
      page.locator(
        "text=My parents had a difficult relationship growing up."
      )
    ).toBeVisible({ timeout: 5000 });

    // Wait for the second AI response
    await page.waitForTimeout(10000);

    // There should be at least 2 AI message bubbles now
    // (first greeting + response to the follow-up)
    const aiAvatars = page.locator("text=🌿");
    const count = await aiAvatars.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // No intake_data blocks should be visible after the second response either
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("intake_data");
  });
});
