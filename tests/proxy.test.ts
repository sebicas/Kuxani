/**
 * Proxy Unit Tests
 *
 * Tests the Next.js proxy that protects authenticated routes
 * and redirects users based on session state.
 *
 * Run: npm test -- tests/proxy.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock better-auth/cookies before importing middleware
vi.mock("better-auth/cookies", () => ({
  getSessionCookie: vi.fn(),
}));

// Mock next/server
vi.mock("next/server", () => {
  const redirect = vi.fn(
    (url: URL) => ({ type: "redirect", url: url.toString() } as never)
  );
  const next = vi.fn(() => ({ type: "next" } as never));
  return {
    NextResponse: { redirect, next },
    NextRequest: vi.fn(),
  };
});

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";

// We need to dynamically import middleware after mocks are set up
const { proxy } = await import("@/proxy");

function createMockRequest(pathname: string) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
  } as never;
}

describe("Proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Unauthenticated users", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue(null);
    });

    it("should redirect /dashboard to / when not authenticated", () => {
      proxy(createMockRequest("/dashboard"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /challenges to / when not authenticated", () => {
      proxy(createMockRequest("/challenges"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /mood to / when not authenticated", () => {
      proxy(createMockRequest("/mood"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /settings to / when not authenticated", () => {
      proxy(createMockRequest("/settings"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /personal to / when not authenticated", () => {
      proxy(createMockRequest("/personal"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /gratitude to / when not authenticated", () => {
      proxy(createMockRequest("/gratitude"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /deescalation to / when not authenticated", () => {
      proxy(createMockRequest("/deescalation"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should allow /login through when not authenticated", () => {
      proxy(createMockRequest("/login"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /signup through when not authenticated", () => {
      proxy(createMockRequest("/signup"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Authenticated users", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue("valid-session-token");
    });

    it("should redirect /login to /dashboard when authenticated", () => {
      proxy(createMockRequest("/login"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should redirect /signup to /dashboard when authenticated", () => {
      proxy(createMockRequest("/signup"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should allow /dashboard through when authenticated", () => {
      proxy(createMockRequest("/dashboard"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /challenges through when authenticated", () => {
      proxy(createMockRequest("/challenges"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /mood through when authenticated", () => {
      proxy(createMockRequest("/mood"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /love-languages through when authenticated", () => {
      proxy(createMockRequest("/love-languages"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /gratitude through when authenticated", () => {
      proxy(createMockRequest("/gratitude"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /deescalation through when authenticated", () => {
      proxy(createMockRequest("/deescalation"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /invite/:code through when authenticated", () => {
      proxy(createMockRequest("/invite/ABC12345"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /settings through when authenticated", () => {
      proxy(createMockRequest("/settings"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow nested /challenges/123 through when authenticated", () => {
      proxy(createMockRequest("/challenges/some-challenge-id"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow deeply nested /personal/chats/123/messages through when authenticated", () => {
      proxy(createMockRequest("/personal/chats/123/messages"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unauthenticated - additional routes", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue(null);
    });

    it("should redirect /love-languages to / when not authenticated", () => {
      proxy(createMockRequest("/love-languages"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /invite/:code to / when not authenticated", () => {
      proxy(createMockRequest("/invite/ABC12345"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /checkins to / when not authenticated", () => {
      proxy(createMockRequest("/checkins"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /insights to / when not authenticated", () => {
      proxy(createMockRequest("/insights"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /exercises to / when not authenticated", () => {
      proxy(createMockRequest("/exercises"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect nested /challenges/some-id to / when not authenticated", () => {
      proxy(createMockRequest("/challenges/some-id"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });
  });
});
