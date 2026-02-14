/**
 * Auth Integration Tests
 *
 * Tests the Better Auth signup/signin/session flow directly
 * via auth.api — no HTTP server needed, just a running database.
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm test
 */
import { describe, it, expect } from "vitest";
import { auth } from "@/lib/auth";

// Unique email per test run to avoid conflicts
const testEmail = `test-${Date.now()}@kuxani.app`;
const testPassword = "TestPassword123!";
const testName = "Test User";

describe("Auth API", () => {
  let sessionCookieHeader: Headers | null = null;

  it("should sign up a new user", async () => {
    const result = await auth.api.signUpEmail({
      body: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.user.name).toBe(testName);
    expect(result.token).toBeDefined();
  });

  it("should sign in with existing credentials", async () => {
    // Use returnHeaders to capture Set-Cookie for session test
    const result = await auth.api.signInEmail({
      body: {
        email: testEmail,
        password: testPassword,
      },
      returnHeaders: true,
    });

    expect(result.response.user).toBeDefined();
    expect(result.response.user.email).toBe(testEmail);
    expect(result.response.token).toBeDefined();
    expect(result.headers).toBeDefined();

    // Build a headers object with the session cookie for getSession
    const setCookie = result.headers.get("set-cookie");
    expect(setCookie, "No Set-Cookie header in signin response").toBeTruthy();

    sessionCookieHeader = new Headers({
      Cookie: setCookie!.split(";")[0], // "better-auth.session_token=..."
    });
  });

  it("should reject sign in with wrong password", async () => {
    try {
      await auth.api.signInEmail({
        body: {
          email: testEmail,
          password: "WrongPassword123!",
        },
      });
      expect.fail("Should have thrown for wrong password");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should get session with valid cookie", async () => {
    expect(sessionCookieHeader, "No session cookie — signin test must pass first").toBeTruthy();

    const session = await auth.api.getSession({
      headers: sessionCookieHeader!,
    });

    expect(session).toBeDefined();
    expect(session?.user).toBeDefined();
    expect(session?.user.email).toBe(testEmail);
    expect(session?.session).toBeDefined();
  });

  it("should return null session with invalid cookie", async () => {
    const session = await auth.api.getSession({
      headers: new Headers({
        Cookie: "better-auth.session_token=invalid-token-here",
      }),
    });

    expect(session).toBeNull();
  });
});
