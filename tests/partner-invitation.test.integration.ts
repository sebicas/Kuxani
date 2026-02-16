/**
 * Partner Invitation Integration Tests
 *
 * Tests the full partner invitation flow:
 * - Creating a couple + invite code
 * - Looking up invite info
 * - Joining a couple via invite code
 * - Edge cases (duplicates, self-join, full couple)
 *
 * Requires: Docker (PostgreSQL) running
 * Automatically starts a Next.js server on a random port.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import next from "next";
import { auth } from "@/lib/auth";

let server: Server;
let baseUrl: string;

// ── Helper: create user & get session cookie ──
async function createUserAndGetCookie(email: string, name: string) {
  await auth.api.signUpEmail({
    body: { email, password: "TestPassword123!", name },
  });

  const result = await auth.api.signInEmail({
    body: { email, password: "TestPassword123!" },
    returnHeaders: true,
  });

  const setCookie = result.headers.get("set-cookie")!;
  return new Headers({
    Cookie: setCookie.split(";")[0],
  });
}

// ── Helper: make API request with session ──
async function apiRequest(
  path: string,
  options: {
    method?: string;
    headers: Headers;
    body?: Record<string, unknown>;
  },
) {
  const { method = "GET", headers: sessionHeaders, body } = options;
  const fetchHeaders: Record<string, string> = {
    Cookie: sessionHeaders.get("Cookie") || "",
  };
  if (body) fetchHeaders["Content-Type"] = "application/json";

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, data: await res.json() };
}

// Test data — unique per run
const ts = Date.now();
const creatorEmail = `creator-${ts}@kuxani.app`;
const partnerEmail = `partner-${ts}@kuxani.app`;
const thirdEmail = `third-${ts}@kuxani.app`;

describe("Partner Invitation", () => {
  let creatorHeaders: Headers;
  let partnerHeaders: Headers;
  let thirdHeaders: Headers;
  let inviteCode: string;
  let coupleId: string;

  // Start Next.js server on a random port
  let originalStdoutWrite: typeof process.stdout.write;

  beforeAll(async () => {
    // Suppress Next.js request logs (GET /api/... 200 in 125ms ...)
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
      if (typeof chunk === "string" && /^\s*(GET|POST|PUT|DELETE|PATCH)\s+\//.test(chunk)) {
        return true;
      }
      return originalStdoutWrite(chunk, ...args);
    }) as typeof process.stdout.write;

    const app = next({ dev: true, dir: process.cwd(), quiet: true });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => handle(req, res));
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    // Create test users
    creatorHeaders = await createUserAndGetCookie(creatorEmail, "Alice Creator");
    partnerHeaders = await createUserAndGetCookie(partnerEmail, "Bob Partner");
    thirdHeaders = await createUserAndGetCookie(thirdEmail, "Charlie Third");
  }, 120_000); // 2 min for first-time Next.js compilation

  afterAll(() => {
    process.stdout.write = originalStdoutWrite;
    server?.close();
  });

  /* ── GET /api/couples — no couple yet ── */
  it("should return null couple when user has no couple", async () => {
    const { status, data } = await apiRequest("/api/couples", {
      headers: creatorHeaders,
    });
    expect(status).toBe(200);
    expect(data.couple).toBeNull();
  });

  /* ── POST /api/couples — create couple ── */
  it("should create a couple with invite code", async () => {
    const { status, data } = await apiRequest("/api/couples", {
      method: "POST",
      headers: creatorHeaders,
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.inviteCode).toBeDefined();
    expect(data.inviteCode).toHaveLength(8);
    expect(data.inviteLink).toContain(`/invite/${data.inviteCode}`);
    expect(data.status).toBe("pending");

    inviteCode = data.inviteCode;
    coupleId = data.id;
  });

  /* ── GET /api/couples — after creation ── */
  it("should return couple info after creation", async () => {
    const { status, data } = await apiRequest("/api/couples", {
      headers: creatorHeaders,
    });

    expect(status).toBe(200);
    expect(data.couple).toBeDefined();
    expect(data.couple.id).toBe(coupleId);
    expect(data.couple.status).toBe("pending");
    expect(data.role).toBe("creator");
    expect(data.partner).toBeNull(); // no partner yet
  });

  /* ── POST /api/couples — prevent duplicate ── */
  it("should prevent creating a second couple", async () => {
    const { status, data } = await apiRequest("/api/couples", {
      method: "POST",
      headers: creatorHeaders,
    });

    expect(status).toBe(409);
    expect(data.error).toContain("already part of a couple");
  });

  /* ── GET /api/couples/invite — valid code ── */
  it("should return creator info for valid invite code", async () => {
    const { status, data } = await apiRequest(
      `/api/couples/invite?code=${inviteCode}`,
      { headers: new Headers() }, // no auth needed
    );

    expect(status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.creatorName).toBe("Alice"); // first name only
  });

  /* ── GET /api/couples/invite — invalid code ── */
  it("should return 404 for invalid invite code", async () => {
    const { status, data } = await apiRequest(
      "/api/couples/invite?code=ZZZZZZZZ",
      { headers: new Headers() },
    );

    expect(status).toBe(404);
    expect(data.valid).toBe(false);
  });

  /* ── POST /api/couples/join — self-join ── */
  it("should prevent creator from joining their own couple", async () => {
    const { status, data } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: creatorHeaders,
      body: { inviteCode },
    });

    expect(status).toBe(409);
    expect(data.error).toContain("already part of a couple");
  });

  /* ── POST /api/couples/join — success ── */
  it("should allow partner to join via invite code", async () => {
    const { status, data } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: partnerHeaders,
      body: { inviteCode },
    });

    expect(status).toBe(200);
    expect(data.coupleId).toBe(coupleId);
    expect(data.status).toBe("active");
    expect(data.message).toContain("Successfully joined");
  });

  /* ── GET /api/couples — after partner joins ── */
  it("should show partner info after joining", async () => {
    const { status, data } = await apiRequest("/api/couples", {
      headers: creatorHeaders,
    });

    expect(status).toBe(200);
    expect(data.couple.status).toBe("active");
    expect(data.partner).toBeDefined();
    expect(data.partner.name).toBe("Bob Partner");
  });

  /* ── POST /api/couples/join — third person can't join ── */
  it("should prevent third person from joining a full couple", async () => {
    const { status } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: thirdHeaders,
      body: { inviteCode },
    });

    // Should fail — couple is already active (full)
    expect(status).toBe(409);
  });

  /* ── GET /api/couples/invite — used code ── */
  it("should return 410 for already-used invite code", async () => {
    const { status, data } = await apiRequest(
      `/api/couples/invite?code=${inviteCode}`,
      { headers: new Headers() },
    );

    expect(status).toBe(410);
    expect(data.valid).toBe(false);
    expect(data.error).toContain("already been used");
  });

  /* ── POST /api/couples/join — user already in couple ── */
  it("should prevent user already in a couple from joining another", async () => {
    // Partner is already in a couple, try to join with a different code
    const { status, data } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: partnerHeaders,
      body: { inviteCode: "FAKECODE" },
    });

    expect(status).toBe(409);
    expect(data.error).toContain("already part of a couple");
  });

  /* ── POST /api/couples/join — missing invite code ── */
  it("should reject join request without invite code", async () => {
    const { status, data } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: thirdHeaders,
      body: {},
    });

    expect(status).toBe(400);
    expect(data.error).toContain("Invite code is required");
  });

  /* ── Unauthorized access ── */
  it("should reject unauthenticated couple creation", async () => {
    const { status } = await apiRequest("/api/couples", {
      method: "POST",
      headers: new Headers(),
    });

    expect(status).toBe(401);
  });

  it("should reject unauthenticated join request", async () => {
    const { status } = await apiRequest("/api/couples/join", {
      method: "POST",
      headers: new Headers(),
      body: { inviteCode: "ANYTHING" },
    });

    expect(status).toBe(401);
  });
});
