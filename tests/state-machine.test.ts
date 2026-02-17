/**
 * State Machine Transition Tests
 *
 * Tests that challenge and disagreement status transitions
 * follow valid paths, with guard conditions enforced.
 *
 * Uses mocked DB and auth for isolated unit testing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock: session ──
const mockGetServerSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock: Schema (explicit named exports) ──
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
  disagreementInvitations: makeTable("disagreementInvitations"),
  requests: makeTable("requests"),
  compromises: makeTable("compromises"),
}));

// ── Mock: drizzle-orm ──
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
}));

// ── Mock helpers for DB tracking ──
let selectResults: unknown[][];
let selectCallIdx: number;
let lastUpdateSet: Record<string, unknown> | null = null;

function createSelectChain(results: unknown[]) {
  return {
    from: () => ({
      where: () => {
        const obj = Object.create(results);
        obj[Symbol.iterator] = () => results[Symbol.iterator]();
        obj.orderBy = () => results;
        obj.limit = () => results;
        return obj;
      },
      innerJoin: () => ({
        where: () => {
          const obj = Object.create(results);
          obj[Symbol.iterator] = () => results[Symbol.iterator]();
          return obj;
        },
      }),
      leftJoin: () => ({
        where: () => {
          const obj = Object.create(results);
          obj[Symbol.iterator] = () => results[Symbol.iterator]();
          obj.orderBy = () => results;
          return obj;
        },
        orderBy: () => results,
      }),
      orderBy: () => results,
    }),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const results = selectResults[selectCallIdx] || [];
      selectCallIdx++;
      return createSelectChain(results);
    },
    insert: () => ({
      values: () => ({
        returning: () => [{ id: "new-1" }],
      }),
    }),
    update: () => ({
      set: (data: Record<string, unknown>) => {
        lastUpdateSet = data;
        return {
          where: () => ({
            returning: () => [{ id: "updated-1", ...data }],
          }),
        };
      },
    }),
    delete: () => ({
      where: () => [{ id: "deleted-1" }],
    }),
  },
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
  DISAGREEMENT_STATUS: "disagreement:status",
  DISAGREEMENT_INVITE: "disagreement:invite",
  DISAGREEMENT_INVITE_RESPONSE: "disagreement:invite-response",
  DISAGREEMENT_MESSAGE: "disagreement:message",
  REQUEST_CREATED: "request:created",
  COMPROMISE_CREATED: "compromise:created",
}));

// ── Mock: AI ──
vi.mock("@/lib/ai/context", () => ({
  loadCoupleContext: vi.fn().mockResolvedValue({}),
  loadPersonalContext: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYNTHESIS_PROMPT: "synthesis prompt",
  DISCUSSION_PROMPT: "discussion prompt",
  DISAGREEMENT_INTAKE_PROMPT: "intake prompt",
  DISAGREEMENT_CLARIFY_PROMPT: "clarify prompt",
  DISAGREEMENT_GENERATE_COMMITMENTS_PROMPT: "commitments prompt",
  buildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}));

const mockOpenAICreate = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockOpenAICreate(...args),
      },
    },
  },
  REASONING_MODEL: "test-model",
  FAST_MODEL: "test-fast",
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// ── Helpers ──

function makeRequest(
  url: string,
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

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function mockSession(userId = "user-a", name = "Alice") {
  mockGetServerSession.mockResolvedValue({ user: { id: userId, name } });
}

function _mockNoSession() {
  mockGetServerSession.mockResolvedValue(null);
}

// ── Challenge route imports (after mocks) ──
const { PUT: perspectivesPUT } = await import(
  "@/app/api/challenges/[id]/perspectives/route"
);
const { POST: acceptPOST } = await import(
  "@/app/api/challenges/[id]/accept/route"
);

// ── Tests ──

describe("State Machine Transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx = 0;
    selectResults = [];
    lastUpdateSet = null;
  });

  describe("Challenge Status Transitions", () => {
    // created → perspectives: when first partner submits
    it("should transition from 'created' to 'perspectives' when first partner submits", async () => {
      mockSession("user-a");

      const challenge = {
        id: "ch-1",
        coupleId: "c-1",
        status: "created",
      };

      const perspective = {
        id: "persp-a",
        userId: "user-a",
        challengeId: "ch-1",
        perspectiveText: null,
        submitted: false,
      };

      // Unsubmitted partner B perspective
      const allPerspectives = [
        { ...perspective, submitted: true, perspectiveText: "My view" },
        { id: "persp-b", userId: "user-b", challengeId: "ch-1", submitted: false },
      ];

      selectResults = [
        [challenge],         // challenge lookup
        [{ userId: "user-a" }], // member check
        [perspective],        // user's perspective lookup
        allPerspectives,      // all perspectives (check if both submitted)
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/perspectives",
        "PUT",
        { perspectiveText: "My view on this issue", submit: true },
      );

      const response = await perspectivesPUT(request, makeParams("ch-1"));
      expect(response.status).toBe(200);

      // Verify the update set perspectives status
      // The route calls db.update(challenges).set({ status: "perspectives" })
      // when one submits but not both
      expect(lastUpdateSet).toBeDefined();
      expect(lastUpdateSet!.status).toBe("perspectives");
    });

    // created/perspectives → submitted: when BOTH partners submit
    it("should transition to 'submitted' when both partners have submitted", async () => {
      mockSession("user-b");

      const challenge = {
        id: "ch-1",
        coupleId: "c-1",
        status: "perspectives",
      };

      const perspectiveB = {
        id: "persp-b",
        userId: "user-b",
        challengeId: "ch-1",
        perspectiveText: null,
        submitted: false,
      };

      // Both now submitted
      const allPerspectives = [
        { id: "persp-a", userId: "user-a", submitted: true },
        { id: "persp-b", userId: "user-b", submitted: true },
      ];

      selectResults = [
        [challenge],
        [{ userId: "user-b" }],
        [perspectiveB],
        allPerspectives,
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/perspectives",
        "PUT",
        { perspectiveText: "My perspective too", submit: true },
      );

      const response = await perspectivesPUT(request, makeParams("ch-1"));
      expect(response.status).toBe(200);

      expect(lastUpdateSet).toBeDefined();
      expect(lastUpdateSet!.status).toBe("submitted");
    });

    // review → discussion: when both partners accept synthesis
    it("should transition to 'discussion' when both partners accept synthesis", async () => {
      mockSession("user-b");

      const challenge = {
        id: "ch-1",
        coupleId: "c-1",
        status: "review",
        acceptedByA: true,
        acceptedByB: false,
        aiNeutralDescription: "synthesis text",
      };

      selectResults = [
        [challenge],
        [{ userId: "user-b", coupleId: "c-1" }],
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/accept",
        "POST",
        { accept: true },
      );

      const response = await acceptPOST(request, makeParams("ch-1"));
      const _data = await response.json();

      expect(response.status).toBe(200);
      expect(lastUpdateSet).toBeDefined();
      expect(lastUpdateSet!.status).toBe("discussion");
    });

    // review → review (with rejection): when partner rejects
    it("should reset acceptance and stay in 'review' when partner rejects synthesis", async () => {
      mockSession("user-a");

      const challenge = {
        id: "ch-1",
        coupleId: "c-1",
        status: "review",
        acceptedByA: false,
        acceptedByB: true,
        aiNeutralDescription: "synthesis text",
      };

      selectResults = [
        [challenge],
        [{ userId: "user-a", coupleId: "c-1" }],
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/accept",
        "POST",
        { accept: false, rejectionReason: "It doesn't capture my feelings accurately" },
      );

      const response = await acceptPOST(request, makeParams("ch-1"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.needsRegeneration).toBe(true);

      expect(lastUpdateSet).toBeDefined();
      expect(lastUpdateSet!.status).toBe("review");
      expect(lastUpdateSet!.acceptedByA).toBe(false);
      expect(lastUpdateSet!.acceptedByB).toBe(false);
      expect(lastUpdateSet!.rejectionFeedback).toContain("doesn't capture");
    });

    // Guard: cannot submit empty perspective
    it("should reject perspective submission with empty text", async () => {
      mockSession("user-a");

      const challenge = { id: "ch-1", coupleId: "c-1", status: "created" };
      const perspective = {
        id: "persp-a",
        userId: "user-a",
        perspectiveText: null,
        submitted: false,
      };

      selectResults = [
        [challenge],
        [{ userId: "user-a" }],
        [perspective],
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/perspectives",
        "PUT",
        { submit: true },
      );

      const response = await perspectivesPUT(request, makeParams("ch-1"));
      expect(response.status).toBe(400);
    });

    // Guard: cannot reject without reason
    it("should require rejection reason when declining synthesis", async () => {
      mockSession("user-a");

      const challenge = {
        id: "ch-1",
        coupleId: "c-1",
        status: "review",
        acceptedByA: false,
        acceptedByB: false,
        aiNeutralDescription: "synthesis text",
      };

      selectResults = [
        [challenge],
        [{ userId: "user-a", coupleId: "c-1" }],
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/accept",
        "POST",
        { accept: false },
      );

      const response = await acceptPOST(request, makeParams("ch-1"));
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    // Edge: unauthenticated user cannot submit perspective
    it("should reject unauthenticated perspective submission", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/perspectives",
        "PUT",
        { perspectiveText: "sneaky", submit: true },
      );

      const response = await perspectivesPUT(request, makeParams("ch-1"));
      expect(response.status).toBe(401);
    });

    // Edge: unauthenticated user cannot accept
    it("should reject unauthenticated accept request", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/accept",
        "POST",
        { accept: true },
      );

      const response = await acceptPOST(request, makeParams("ch-1"));
      expect(response.status).toBe(401);
    });

    // Edge: accept on challenge that doesn't exist
    it("should return 404 for non-existent challenge", async () => {
      mockSession("user-a");
      selectResults = [[]]; // no challenge found

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-nonexistent/accept",
        "POST",
        { accept: true },
      );

      const response = await acceptPOST(request, makeParams("ch-nonexistent"));
      expect(response.status).toBe(404);
    });

    // Edge: save perspective without submitting (draft)
    it("should allow saving a draft perspective without submitting", async () => {
      mockSession("user-a");

      const challenge = { id: "ch-1", coupleId: "c-1", status: "created" };
      const perspective = {
        id: "persp-a",
        userId: "user-a",
        perspectiveText: null,
        submitted: false,
      };

      selectResults = [
        [challenge],
        [{ userId: "user-a" }],
        [perspective],
      ];

      const request = makeRequest(
        "http://localhost:3000/api/challenges/ch-1/perspectives",
        "PUT",
        { perspectiveText: "Work in progress, not ready to submit" },
      );

      const response = await perspectivesPUT(request, makeParams("ch-1"));
      expect(response.status).toBe(200);

      // Status should NOT have changed (no submit flag)
      expect(lastUpdateSet?.status).toBeUndefined();
    });
  });
});

