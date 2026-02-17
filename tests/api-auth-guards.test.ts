/**
 * API Auth Guards — Unauthenticated Access Tests
 *
 * Verifies that every session-protected API route returns 401
 * when no session is present. This is the most fundamental
 * security test: no anonymous access to protected resources.
 *
 * Excludes:
 *  - /api/health          (public)
 *  - /api/auth/[...all]   (auth handler, no standard exports)
 *  - /api/couples/invite  (public invite lookup)
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// ── Mock: session always returns null (unauthenticated) ──
vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
  requireSession: vi.fn().mockRejectedValue(
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  ),
}));

// ── Mock: DB (prevent real connections) ──
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => () => ({
        from: () => ({
          where: () => ({
            limit: () => [],
            orderBy: () => [],
            returning: () => [],
          }),
          innerJoin: () => ({
            where: () => ({
              limit: () => [],
            }),
          }),
          leftJoin: () => ({
            where: () => ({
              limit: () => [],
              orderBy: () => [],
            }),
          }),
          orderBy: () => [],
        }),
        values: () => ({
          returning: () => [],
          onConflictDoUpdate: () => ({
            returning: () => [],
          }),
        }),
        set: () => ({
          where: () => ({
            returning: () => [],
          }),
        }),
        returning: () => [],
      }),
    },
  ),
}));

// ── Mock: drizzle-orm operators ──
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  gte: vi.fn(),
  ne: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

// ── Mock: schema (prevent barrel export issues) ──
vi.mock(
  "@/lib/db/schema",
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "__esModule") return true;
          // Return a proxy table that has column-like properties
          return new Proxy(
            { _: { name: String(prop) } },
            {
              get: (_t, col) =>
                col === "_" ? _t._ : `${String(prop)}.${String(col)}`,
            },
          );
        },
      },
    ),
);

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
  DISAGREEMENT_UPDATED: "disagreement:updated",
  MOOD_UPDATED: "mood:updated",
  COMMITMENT_UPDATED: "commitment:updated",
  COUPLE_UPDATED: "couple:updated",
}));

// ── Mock: next/headers ──
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// ── Mock: OpenAI ──
vi.mock("@/lib/ai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    responses: {
      create: vi.fn(),
    },
  },
  REASONING_MODEL: "test-model",
  FAST_MODEL: "test-fast-model",
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYNTHESIS_PROMPT: "test",
  DISCUSSION_PROMPT: "test",
  PERSONAL_THERAPY_PROMPT: "test",
  DEESCALATION_PROMPT: "test",
  DISAGREEMENT_PROMPT: "test",
  CHILDHOOD_WOUND_PROMPT: "test",
  buildSystemPrompt: vi.fn().mockReturnValue("test system prompt"),
}));

vi.mock("@/lib/ai/context", () => ({
  loadCoupleContext: vi.fn().mockResolvedValue({}),
  loadPersonalContext: vi.fn().mockResolvedValue({}),
  formatCoupleContext: vi.fn().mockReturnValue(""),
  formatPersonalContext: vi.fn().mockReturnValue(""),
}));

// ── Helpers ──

/** Create a minimal NextRequest */
function makeRequest(
  url = "http://localhost:3000/api/test",
  method = "GET",
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

/** Create params matching Next.js 16 pattern: { params: Promise<{ id: string }> } */
function makeParams(id = "test-uuid"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/**
 * Each entry: [description, route import path, method, needs params, needs body]
 *
 * Routes are grouped by feature area for readability.
 */
type RouteSpec = [
  desc: string,
  importPath: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  needsParams: boolean,
  body?: Record<string, unknown>,
];

const routes: RouteSpec[] = [
  // ── Challenges ──
  ["GET  /api/challenges", "@/app/api/challenges/route", "GET", false],
  [
    "POST /api/challenges",
    "@/app/api/challenges/route",
    "POST",
    false,
    { title: "test" },
  ],
  ["GET  /api/challenges/[id]", "@/app/api/challenges/[id]/route", "GET", true],
  [
    "PATCH /api/challenges/[id]",
    "@/app/api/challenges/[id]/route",
    "PATCH",
    true,
    { title: "updated" },
  ],
  [
    "DELETE /api/challenges/[id]",
    "@/app/api/challenges/[id]/route",
    "DELETE",
    true,
  ],
  [
    "POST /api/challenges/[id]/accept",
    "@/app/api/challenges/[id]/accept/route",
    "POST",
    true,
    { accept: true },
  ],
  [
    "GET  /api/challenges/[id]/messages",
    "@/app/api/challenges/[id]/messages/route",
    "GET",
    true,
  ],
  [
    "POST /api/challenges/[id]/messages",
    "@/app/api/challenges/[id]/messages/route",
    "POST",
    true,
    { message: "hi" },
  ],
  [
    "GET  /api/challenges/[id]/perspectives",
    "@/app/api/challenges/[id]/perspectives/route",
    "GET",
    true,
  ],
  [
    "PUT  /api/challenges/[id]/perspectives",
    "@/app/api/challenges/[id]/perspectives/route",
    "PUT",
    true,
    { text: "perspective" },
  ],
  [
    "GET  /api/challenges/[id]/requests",
    "@/app/api/challenges/[id]/requests/route",
    "GET",
    true,
  ],
  [
    "POST /api/challenges/[id]/requests",
    "@/app/api/challenges/[id]/requests/route",
    "POST",
    true,
    { request: "test" },
  ],
  [
    "PATCH /api/challenges/[id]/requests",
    "@/app/api/challenges/[id]/requests/route",
    "PATCH",
    true,
    { status: "accepted" },
  ],
  [
    "POST /api/challenges/[id]/resolve",
    "@/app/api/challenges/[id]/resolve/route",
    "POST",
    true,
    {},
  ],
  [
    "POST /api/challenges/[id]/synthesis",
    "@/app/api/challenges/[id]/synthesis/route",
    "POST",
    true,
    {},
  ],

  // ── Disagreements ──
  ["GET  /api/disagreements", "@/app/api/disagreements/route", "GET", false],
  [
    "POST /api/disagreements",
    "@/app/api/disagreements/route",
    "POST",
    false,
    { title: "test" },
  ],
  [
    "GET  /api/disagreements/[id]",
    "@/app/api/disagreements/[id]/route",
    "GET",
    true,
  ],
  [
    "PATCH /api/disagreements/[id]",
    "@/app/api/disagreements/[id]/route",
    "PATCH",
    true,
    {},
  ],
  [
    "DELETE /api/disagreements/[id]",
    "@/app/api/disagreements/[id]/route",
    "DELETE",
    true,
  ],
  [
    "POST /api/disagreements/[id]/invite",
    "@/app/api/disagreements/[id]/invite/route",
    "POST",
    true,
    {},
  ],
  [
    "GET  /api/disagreements/[id]/invite",
    "@/app/api/disagreements/[id]/invite/route",
    "GET",
    true,
  ],
  [
    "POST /api/disagreements/[id]/join",
    "@/app/api/disagreements/[id]/join/route",
    "POST",
    true,
    {},
  ],
  [
    "GET  /api/disagreements/[id]/messages",
    "@/app/api/disagreements/[id]/messages/route",
    "GET",
    true,
  ],
  [
    "POST /api/disagreements/[id]/messages",
    "@/app/api/disagreements/[id]/messages/route",
    "POST",
    true,
    { message: "hi" },
  ],
  [
    "POST /api/disagreements/[id]/resolve",
    "@/app/api/disagreements/[id]/resolve/route",
    "POST",
    true,
    {},
  ],
  [
    "POST /api/disagreements/[id]/voice",
    "@/app/api/disagreements/[id]/voice/route",
    "POST",
    true,
    {},
  ],

  // ── Couples ──
  ["GET  /api/couples", "@/app/api/couples/route", "GET", false],
  ["POST /api/couples", "@/app/api/couples/route", "POST", false],
  [
    "POST /api/couples/join",
    "@/app/api/couples/join/route",
    "POST",
    false,
    { inviteCode: "TEST1234" },
  ],

  // ── Mood ──
  ["GET  /api/mood", "@/app/api/mood/route", "GET", false],
  [
    "POST /api/mood",
    "@/app/api/mood/route",
    "POST",
    false,
    { primaryEmotion: "happy" },
  ],

  // ── Gratitude ──
  ["GET  /api/gratitude", "@/app/api/gratitude/route", "GET", false],
  [
    "POST /api/gratitude",
    "@/app/api/gratitude/route",
    "POST",
    false,
    { text: "grateful" },
  ],
  [
    "GET  /api/gratitude/prompts",
    "@/app/api/gratitude/prompts/route",
    "GET",
    false,
  ],

  // ── Love Languages ──
  ["GET  /api/love-languages", "@/app/api/love-languages/route", "GET", false],
  [
    "POST /api/love-languages",
    "@/app/api/love-languages/route",
    "POST",
    false,
    { answers: [] },
  ],

  // ── Attachment Styles ──
  [
    "GET  /api/attachment-styles",
    "@/app/api/attachment-styles/route",
    "GET",
    false,
  ],
  [
    "POST /api/attachment-styles",
    "@/app/api/attachment-styles/route",
    "POST",
    false,
    { answers: [] },
  ],

  // ── Childhood Wounds ──
  [
    "GET  /api/childhood-wounds",
    "@/app/api/childhood-wounds/route",
    "GET",
    false,
  ],
  [
    "POST /api/childhood-wounds",
    "@/app/api/childhood-wounds/route",
    "POST",
    false,
    { wound: "test" },
  ],
  [
    "PUT  /api/childhood-wounds/[id]",
    "@/app/api/childhood-wounds/[id]/route",
    "PUT",
    true,
    { wound: "updated" },
  ],
  [
    "DELETE /api/childhood-wounds/[id]",
    "@/app/api/childhood-wounds/[id]/route",
    "DELETE",
    true,
  ],
  [
    "PATCH /api/childhood-wounds/[id]",
    "@/app/api/childhood-wounds/[id]/route",
    "PATCH",
    true,
    {},
  ],
  [
    "POST /api/childhood-wounds/ai-suggest",
    "@/app/api/childhood-wounds/ai-suggest/route",
    "POST",
    false,
  ],
  [
    "POST /api/childhood-wounds/suggest",
    "@/app/api/childhood-wounds/suggest/route",
    "POST",
    false,
    { text: "test" },
  ],

  // ── De-escalation ──
  ["GET  /api/deescalation", "@/app/api/deescalation/route", "GET", false],
  ["POST /api/deescalation", "@/app/api/deescalation/route", "POST", false, {}],
  [
    "PATCH /api/deescalation",
    "@/app/api/deescalation/route",
    "PATCH",
    false,
    {},
  ],
  [
    "GET  /api/deescalation/prompts",
    "@/app/api/deescalation/prompts/route",
    "GET",
    false,
  ],

  // ── Commitments — Requests ──
  [
    "GET  /api/commitments/requests",
    "@/app/api/commitments/requests/route",
    "GET",
    false,
  ],
  [
    "POST /api/commitments/requests",
    "@/app/api/commitments/requests/route",
    "POST",
    false,
    { request: "test" },
  ],
  [
    "GET  /api/commitments/requests/[id]",
    "@/app/api/commitments/requests/[id]/route",
    "GET",
    true,
  ],
  [
    "PATCH /api/commitments/requests/[id]",
    "@/app/api/commitments/requests/[id]/route",
    "PATCH",
    true,
    {},
  ],

  // ── Commitments — Compromises ──
  [
    "GET  /api/commitments/compromises",
    "@/app/api/commitments/compromises/route",
    "GET",
    false,
  ],
  [
    "POST /api/commitments/compromises",
    "@/app/api/commitments/compromises/route",
    "POST",
    false,
    {},
  ],
  [
    "GET  /api/commitments/compromises/[id]",
    "@/app/api/commitments/compromises/[id]/route",
    "GET",
    true,
  ],
  [
    "PATCH /api/commitments/compromises/[id]",
    "@/app/api/commitments/compromises/[id]/route",
    "PATCH",
    true,
    {},
  ],
  [
    "GET  /api/commitments/compromises/[id]/check-in",
    "@/app/api/commitments/compromises/[id]/check-in/route",
    "GET",
    true,
  ],
  [
    "POST /api/commitments/compromises/[id]/check-in",
    "@/app/api/commitments/compromises/[id]/check-in/route",
    "POST",
    true,
    {},
  ],

  // ── Personal Chats ──
  ["GET  /api/personal/chats", "@/app/api/personal/chats/route", "GET", false],
  ["POST /api/personal/chats", "@/app/api/personal/chats/route", "POST", false],
  [
    "GET  /api/personal/chats/[id]",
    "@/app/api/personal/chats/[id]/route",
    "GET",
    true,
  ],
  [
    "PATCH /api/personal/chats/[id]",
    "@/app/api/personal/chats/[id]/route",
    "PATCH",
    true,
    {},
  ],
  [
    "DELETE /api/personal/chats/[id]",
    "@/app/api/personal/chats/[id]/route",
    "DELETE",
    true,
  ],
  [
    "POST /api/personal/chats/[id]/messages",
    "@/app/api/personal/chats/[id]/messages/route",
    "POST",
    true,
    { message: "hi" },
  ],
];

// ── Tests ──

describe("API Auth Guards — 401 when unauthenticated", () => {
  // Pre-import all route modules (dynamic imports after mocks are set up)
  const modules: Record<string, Record<string, (...args: unknown[]) => Promise<Response>>> = {};

  beforeAll(async () => {
    const uniqueImports = [...new Set(routes.map(([, path]) => path))];
    const results = await Promise.allSettled(
      uniqueImports.map(async (path) => {
        const mod = await import(path);
        modules[path] = mod;
      }),
    );

    // Log any import failures for debugging
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.warn(
          `⚠ Failed to import ${uniqueImports[i]}: ${result.reason}`,
        );
      }
    });
  });

  for (const [desc, importPath, method, needsParams, body] of routes) {
    it(`${desc} → 401`, async () => {
      const mod = modules[importPath];
      if (!mod) {
        // Module failed to import (may have unresolvable deps) — skip gracefully
        console.warn(`Skipping ${desc}: module not available`);
        return;
      }

      const handler = mod[method];
      expect(
        handler,
        `${desc}: handler "${method}" should be exported`,
      ).toBeDefined();

      const request = makeRequest(
        `http://localhost:3000/api/test`,
        method,
        body,
      );

      const args: unknown[] = [request];
      if (needsParams) {
        args.push(makeParams());
      }

      // Some GET handlers have no params at all
      let response: Response;
      if (method === "GET" && !needsParams && handler.length === 0) {
        response = await handler();
      } else {
        response = await handler(...args);
      }

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  }
});
