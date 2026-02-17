/**
 * AI Streaming Routes — Unit Tests (Mocked OpenAI)
 *
 * Tests SSE response format, context assembly, error handling,
 * and DB persistence after stream completion.
 *
 * Uses mocked OpenAI, DB, and auth for isolated unit testing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock: session ──
const mockGetServerSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock return data ──
const mockChallenge = {
  id: "challenge-1",
  title: "Test Challenge",
  category: "communication",
  status: "submitted",
  coupleId: "couple-1",
  createdBy: "user-a",
  aiNeutralDescription: null,
  rejectionFeedback: null,
  acceptedByA: false,
  acceptedByB: false,
};

const mockPerspectives = [
  {
    userId: "user-a",
    perspectiveText: "Partner A's perspective",
    submitted: true,
    userName: "Alice",
    createdAt: new Date(),
  },
  {
    userId: "user-b",
    perspectiveText: "Partner B's perspective",
    submitted: true,
    userName: "Bob",
    createdAt: new Date(),
  },
];

const mockMember = { userId: "user-a", coupleId: "couple-1" };

// ── Mock: DB with chainable proxy ──
function createSelectChain(results: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        ...results,
        [Symbol.iterator]: () => results[Symbol.iterator](),
        orderBy: () => results,
        limit: () => results,
      }),
      innerJoin: () => ({
        where: () => ({
          ...results,
          [Symbol.iterator]: () => results[Symbol.iterator](),
          limit: () => results,
        }),
      }),
      leftJoin: () => ({
        where: () => ({
          ...results,
          [Symbol.iterator]: () => results[Symbol.iterator](),
          orderBy: () => results,
        }),
        orderBy: () => results,
      }),
      orderBy: () => results,
    }),
  };
}

// Track select call order per test
let selectResults: unknown[][];
let selectCallIdx: number;

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const results = selectResults[selectCallIdx] || [];
      selectCallIdx++;
      return createSelectChain(results);
    },
    insert: () => ({
      values: () => ({
        returning: () => [{ id: "msg-1" }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => [{ ...mockChallenge, status: "synthesis" }],
        }),
      }),
    }),
  },
}));

// ── Mock: drizzle-orm operators ──
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
}));

// ── Mock: schema (explicit named exports) ──
const makeTable = (name: string) =>
  new Proxy({ _: { name } }, {
    get: (_t, col) => (col === "_" ? _t._ : `${name}.${String(col)}`),
  });

vi.mock("@/lib/db/schema", () => ({
  challenges: makeTable("challenges"),
  challengePerspectives: makeTable("challengePerspectives"),
  challengeMessages: makeTable("challengeMessages"),
  challengeRequests: makeTable("challengeRequests"),
  coupleMembers: makeTable("coupleMembers"),
  couples: makeTable("couples"),
  user: makeTable("user"),
  disagreements: makeTable("disagreements"),
  disagreementMessages: makeTable("disagreementMessages"),
}));

// ── Mock: Socket.IO ──
vi.mock("@/lib/socket/socketServer", () => ({
  getIO: () => ({
    to: () => ({
      emit: vi.fn(),
    }),
  }),
}));

vi.mock("@/lib/socket/events", () => ({
  CHALLENGE_UPDATED: "challenge:updated",
}));

// ── Mock: AI context + prompts ──
vi.mock("@/lib/ai/context", () => ({
  loadCoupleContext: vi.fn().mockResolvedValue({}),
  loadPersonalContext: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYNTHESIS_PROMPT: "You are a synthesis AI",
  DISCUSSION_PROMPT: "You are a discussion AI",
  buildSystemPrompt: vi.fn().mockReturnValue("Mocked system prompt"),
}));

// ── Mock: next/headers ──
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// ── Mock: OpenAI ──
function createMockStream(chunks: string[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const text of chunks) {
        yield {
          choices: [{ delta: { content: text } }],
        };
      }
    },
  };
}

const mockCreate = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
  REASONING_MODEL: "test-model",
  FAST_MODEL: "test-fast-model",
}));

// ── Helpers ──

function makeRequest(
  url = "http://localhost:3000/api/test",
  method = "POST",
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

function makeParams(id = "challenge-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** Read full SSE response text from a Response */
async function readSSE(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }

  return result;
}

// ── Import route after mocks ──
const { POST } = await import(
  "@/app/api/challenges/[id]/synthesis/route"
);

// ── Tests ──

describe("AI Streaming Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx = 0;
    selectResults = [];
  });
  describe("Synthesis Route", () => {
    it("should return SSE data: lines and [DONE] terminator", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });
      // select calls: 1.challenge, 2.member, 3.perspectives
      selectResults = [
        [mockChallenge],
        [mockMember],
        mockPerspectives,
      ];
      selectCallIdx = 0;

      mockCreate.mockResolvedValue(
        createMockStream(["This is ", "a neutral ", "synthesis."]),
      );

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");

      const sseText = await readSSE(response);

      // Verify SSE format: each chunk is `data: {"text":"..."}\n\n`
      expect(sseText).toContain('data: {"text":"This is "}');
      expect(sseText).toContain('data: {"text":"a neutral "}');
      expect(sseText).toContain('data: {"text":"synthesis."}');
      expect(sseText).toContain("data: [DONE]");
    });

    it("should call OpenAI with correct model and stream flag", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });
      selectResults = [
        [mockChallenge],
        [mockMember],
        mockPerspectives,
      ];
      selectCallIdx = 0;

      mockCreate.mockResolvedValue(createMockStream(["test"]));

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      await readSSE(response); // consume stream

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "test-model",
          stream: true,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user" }),
          ]),
        }),
      );
    });

    it("should include both perspectives in the prompt sent to OpenAI", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });
      selectResults = [
        [mockChallenge],
        [mockMember],
        mockPerspectives,
      ];
      selectCallIdx = 0;

      mockCreate.mockResolvedValue(createMockStream(["ok"]));

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      await readSSE(response); // consume stream

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === "user",
      );

      expect(userMessage.content).toContain("Partner A's perspective");
      expect(userMessage.content).toContain("Partner B's perspective");
      expect(userMessage.content).toContain("Test Challenge");
    });

    it("should return 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      expect(response.status).toBe(401);
    });

    it("should return 400 when perspectives not submitted", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });

      const unsubmittedPerspectives = [
        { ...mockPerspectives[0], submitted: false },
        { ...mockPerspectives[1] },
      ];

      selectResults = [
        [mockChallenge],
        [mockMember],
        unsubmittedPerspectives,
      ];
      selectCallIdx = 0;

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain("Both perspectives must be submitted");
    });

    it("should return 404 when challenge not found", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });

      selectResults = [[]]; // no challenge
      selectCallIdx = 0;

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      expect(response.status).toBe(404);
    });

    it("should return 403 when user is not a member of the couple", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-c", name: "Charlie" },
      });

      selectResults = [
        [mockChallenge],
        [], // no member found
      ];
      selectCallIdx = 0;

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      expect(response.status).toBe(403);
    });

    it("should include refinement feedback when challenge has rejectionFeedback", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-a", name: "Alice" },
      });

      const challengeWithFeedback = {
        ...mockChallenge,
        rejectionFeedback: "The synthesis was biased toward partner A",
        aiNeutralDescription: "Previous synthesis text",
      };

      selectResults = [
        [challengeWithFeedback],
        [mockMember],
        mockPerspectives,
      ];
      selectCallIdx = 0;

      mockCreate.mockResolvedValue(createMockStream(["improved"]));

      const request = makeRequest(
        "http://localhost:3000/api/challenges/challenge-1/synthesis",
        "POST",
        {},
      );

      const response = await POST(request, makeParams());
      await readSSE(response);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === "user",
      );

      expect(userMessage.content).toContain("biased toward partner A");
      expect(userMessage.content).toContain("Previous synthesis text");
    });
  });
});
