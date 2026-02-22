/**
 * Attachment Styles Page — Unit Tests
 *
 * Tests the quiz submission and results-loading flow, specifically
 * verifying that partner results are fetched after quiz submission
 * (fixes: partner comparison section showed "partner hasn't taken
 * the quiz yet" even when they had).
 *
 * Uses RTL + jsdom with mocked fetch and socket.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock: socket client (prevent real connection) ──
const mockSocket = {
  connected: false,
  on: vi.fn(() => mockSocket),
  off: vi.fn(() => mockSocket),
  emit: vi.fn(),
  connect: vi.fn(),
};
vi.mock("@/lib/socket/socketClient", () => ({
  getSocket: () => mockSocket,
}));

// ── Mock data ──
const MOCK_USER_RESULT = {
  id: "result-user-1",
  secure: 55,
  anxious: 25,
  avoidant: 15,
  fearfulAvoidant: 20,
  createdAt: "2026-02-21T00:00:00Z",
};

const MOCK_PARTNER_RESULT = {
  id: "result-partner-1",
  secure: 40,
  anxious: 45,
  avoidant: 20,
  fearfulAvoidant: 30,
  createdAt: "2026-02-21T00:00:00Z",
};

// ── Import page component after mocks ──
import AttachmentStylesPage from "@/app/(dashboard)/attachment-styles/page";
import { QUIZ_STATEMENTS } from "@/lib/data/attachment-styles";

/**
 * Helper: builds a mock fetch for the typical test flow.
 * - initialHasResults: whether the first GET returns results (page load)
 * - partnerAvailable: whether the follow-up GET (after POST) includes partner
 */
function createMockFetch(opts: {
  initialHasResults?: boolean;
  partnerAvailableAfterSubmit?: boolean;
}) {
  let getCallCount = 0;

  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;

    // GET /api/attachment-styles
    if (urlStr === "/api/attachment-styles" && (!init || init.method !== "POST")) {
      getCallCount++;
      if (getCallCount === 1 && !opts.initialHasResults) {
        return new Response(JSON.stringify({ userResult: null, partnerResult: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          userResult: MOCK_USER_RESULT,
          partnerResult: opts.partnerAvailableAfterSubmit ? MOCK_PARTNER_RESULT : null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /api/attachment-styles
    if (urlStr === "/api/attachment-styles" && init?.method === "POST") {
      return new Response(JSON.stringify(MOCK_USER_RESULT), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Couples API
    if (urlStr === "/api/couples") {
      return new Response(
        JSON.stringify({ couple: { id: "couple-1" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Session API
    if (urlStr === "/api/auth/get-session") {
      return new Response(
        JSON.stringify({ user: { id: "user-1" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

/**
 * Helper: fill out all 40 quiz questions by clicking the "4" (Neutral) button
 */
async function fillOutAndSubmitQuiz(user: ReturnType<typeof userEvent.setup>) {
  // Click Start Quiz
  await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

  // Fill out all 40 questions
  for (let i = 0; i < QUIZ_STATEMENTS.length; i++) {
    const ratingBtn = screen.getByRole("button", { name: /Neutral/i });
    await user.click(ratingBtn);
  }

  // Submit
  await user.click(screen.getByRole("button", { name: /Submit/i }));
}

/** Helper: check if the partner comparison grid is visible (not the waiting message) */
function partnerComparisonIsVisible() {
  // The comparison grid shows "Anxious" for partner's top style with our mock data
  return screen.queryByText("Partner Comparison") !== null
    && screen.queryByText(/partner hasn.t taken the quiz yet/i) === null;
}

describe("Attachment Styles Page — Partner Results on Submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("should fetch partner results after submitting the quiz (bug fix)", async () => {
    const user = userEvent.setup();
    global.fetch = createMockFetch({
      initialHasResults: false,
      partnerAvailableAfterSubmit: true,
    });

    await act(async () => {
      render(<AttachmentStylesPage />);
    });

    // Wait for start screen
    await waitFor(() => {
      expect(screen.getByText(/Discover Your Attachment Style/i)).toBeDefined();
    });

    // Fill out and submit the quiz
    await fillOutAndSubmitQuiz(user);

    // After submit, the page should show results with partner comparison (NOT waiting message)
    await waitFor(() => {
      expect(screen.getByText("Partner Comparison")).toBeDefined();
    });

    // The waiting message should NOT appear since partner has results
    expect(screen.queryByText(/partner hasn.t taken the quiz yet/i)).toBeNull();

    // Verify a GET fetch was made AFTER the POST (this is the fix)
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const calls = fetchMock.mock.calls;
    const attachmentCalls = calls.filter(
      ([url]: [string]) => url === "/api/attachment-styles",
    );
    const postIndex = attachmentCalls.findIndex(
      ([, init]: [string, RequestInit?]) => init?.method === "POST",
    );
    const getAfterPost = attachmentCalls.slice(postIndex + 1).some(
      ([, init]: [string, RequestInit?]) => !init || init.method !== "POST",
    );
    expect(postIndex).toBeGreaterThanOrEqual(0);
    expect(getAfterPost).toBe(true);
  });

  it("should show waiting message when partner has NOT completed the quiz", async () => {
    const user = userEvent.setup();
    global.fetch = createMockFetch({
      initialHasResults: false,
      partnerAvailableAfterSubmit: false,
    });

    await act(async () => {
      render(<AttachmentStylesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Discover Your Attachment Style/i)).toBeDefined();
    });

    await fillOutAndSubmitQuiz(user);

    // Partner hasn't taken the quiz — waiting message should appear
    await waitFor(() => {
      expect(screen.getByText(/partner hasn.t taken the quiz yet/i)).toBeDefined();
    });
  });

  it("should show partner results immediately on page load when both completed", async () => {
    global.fetch = createMockFetch({
      initialHasResults: true,
      partnerAvailableAfterSubmit: true,
    });

    await act(async () => {
      render(<AttachmentStylesPage />);
    });

    // Should jump straight to results with partner comparison visible
    await waitFor(() => {
      expect(screen.getByText("Partner Comparison")).toBeDefined();
    });

    // No waiting message
    expect(screen.queryByText(/partner hasn.t taken the quiz yet/i)).toBeNull();
  });

  it("should handle GET failure gracefully after POST and still show results", async () => {
    const user = userEvent.setup();

    // Same as createMockFetch but the follow-up GET fails
    let getCallCount = 0;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;

      if (urlStr === "/api/attachment-styles" && (!init || init.method !== "POST")) {
        getCallCount++;
        if (getCallCount === 1) {
          return new Response(JSON.stringify({ userResult: null, partnerResult: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Simulate server error on follow-up GET
        return new Response("Internal Server Error", { status: 500 });
      }

      if (urlStr === "/api/attachment-styles" && init?.method === "POST") {
        return new Response(JSON.stringify(MOCK_USER_RESULT), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (urlStr === "/api/couples") {
        return new Response(
          JSON.stringify({ couple: { id: "couple-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (urlStr === "/api/auth/get-session") {
        return new Response(
          JSON.stringify({ user: { id: "user-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    await act(async () => {
      render(<AttachmentStylesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Discover Your Attachment Style/i)).toBeDefined();
    });

    await fillOutAndSubmitQuiz(user);

    // Even if the follow-up GET fails, user's own results should still display
    await waitFor(() => {
      expect(screen.getByText(/Your primary attachment style/i)).toBeDefined();
    });
  });
});
