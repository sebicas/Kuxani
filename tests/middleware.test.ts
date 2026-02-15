/**
 * Middleware Unit Tests
 *
 * Tests the Next.js middleware that protects authenticated routes
 * and redirects users based on session state.
 *
 * Run: npm test -- tests/middleware.test.ts
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
const { middleware } = await import("@/middleware");

function createMockRequest(pathname: string) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
  } as never;
}

describe("Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Unauthenticated users", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue(null);
    });

    it("should redirect /dashboard to / when not authenticated", () => {
      middleware(createMockRequest("/dashboard"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /challenges to / when not authenticated", () => {
      middleware(createMockRequest("/challenges"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /mood to / when not authenticated", () => {
      middleware(createMockRequest("/mood"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /settings to / when not authenticated", () => {
      middleware(createMockRequest("/settings"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /personal to / when not authenticated", () => {
      middleware(createMockRequest("/personal"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /gratitude to / when not authenticated", () => {
      middleware(createMockRequest("/gratitude"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /deescalation to / when not authenticated", () => {
      middleware(createMockRequest("/deescalation"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should allow /login through when not authenticated", () => {
      middleware(createMockRequest("/login"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /signup through when not authenticated", () => {
      middleware(createMockRequest("/signup"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Authenticated users", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue("valid-session-token");
    });

    it("should redirect /login to /dashboard when authenticated", () => {
      middleware(createMockRequest("/login"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should redirect /signup to /dashboard when authenticated", () => {
      middleware(createMockRequest("/signup"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should allow /dashboard through when authenticated", () => {
      middleware(createMockRequest("/dashboard"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /challenges through when authenticated", () => {
      middleware(createMockRequest("/challenges"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /mood through when authenticated", () => {
      middleware(createMockRequest("/mood"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /love-languages through when authenticated", () => {
      middleware(createMockRequest("/love-languages"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /gratitude through when authenticated", () => {
      middleware(createMockRequest("/gratitude"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /deescalation through when authenticated", () => {
      middleware(createMockRequest("/deescalation"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /invite/:code through when authenticated", () => {
      middleware(createMockRequest("/invite/ABC12345"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow /settings through when authenticated", () => {
      middleware(createMockRequest("/settings"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow nested /challenges/123 through when authenticated", () => {
      middleware(createMockRequest("/challenges/some-challenge-id"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should allow deeply nested /personal/chats/123/messages through when authenticated", () => {
      middleware(createMockRequest("/personal/chats/123/messages"));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unauthenticated - additional routes", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue(null);
    });

    it("should redirect /love-languages to / when not authenticated", () => {
      middleware(createMockRequest("/love-languages"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /invite/:code to / when not authenticated", () => {
      middleware(createMockRequest("/invite/ABC12345"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /checkins to / when not authenticated", () => {
      middleware(createMockRequest("/checkins"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /insights to / when not authenticated", () => {
      middleware(createMockRequest("/insights"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect /exercises to / when not authenticated", () => {
      middleware(createMockRequest("/exercises"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });

    it("should redirect nested /challenges/some-id to / when not authenticated", () => {
      middleware(createMockRequest("/challenges/some-id"));

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe("/");
    });
  });
});
