/**
 * Challenge API Integration Tests
 *
 * Tests the full challenge lifecycle through HTTP handlers:
 * - Create challenge + auto-create perspectives
 * - Submit perspectives, visibility rules
 * - Accept/reject synthesis
 * - Status transitions
 * - Cross-couple isolation
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
const creatorEmail = `chall-creator-${ts}@kuxani.app`;
const partnerEmail = `chall-partner-${ts}@kuxani.app`;
const outsiderEmail = `chall-outsider-${ts}@kuxani.app`;

describe("Challenge API", () => {
  let creatorHeaders: Headers;
  let partnerHeaders: Headers;
  let outsiderHeaders: Headers;
  let challengeId: string;

  let originalStdoutWrite: typeof process.stdout.write;

  beforeAll(async () => {
    // Suppress Next.js request logs
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
    creatorHeaders = await createUserAndGetCookie(creatorEmail, "Creator Challenge");
    partnerHeaders = await createUserAndGetCookie(partnerEmail, "Partner Challenge");
    outsiderHeaders = await createUserAndGetCookie(outsiderEmail, "Outsider Challenge");

    // Set up couple: creator creates, partner joins
    const { data: couple } = await apiRequest("/api/couples", {
      method: "POST",
      headers: creatorHeaders,
    });
    await apiRequest("/api/couples/join", {
      method: "POST",
      headers: partnerHeaders,
      body: { inviteCode: couple.inviteCode },
    });
  }, 120_000);

  afterAll(() => {
    process.stdout.write = originalStdoutWrite;
    server?.close();
  });

  // ── Create Challenge ──

  it("should reject challenge with empty title", async () => {
    const { status, data } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: creatorHeaders,
      body: { title: "" },
    });

    expect(status).toBe(400);
    expect(data.error).toContain("Title is required");
  });

  it("should reject challenge with missing title", async () => {
    const { status, data } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: creatorHeaders,
      body: {},
    });

    expect(status).toBe(400);
    expect(data.error).toContain("Title is required");
  });

  it("should create a challenge with auto-created perspectives", async () => {
    const { status, data } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: creatorHeaders,
      body: { title: "Test Challenge", category: "communication" },
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Test Challenge");
    expect(data.category).toBe("communication");
    expect(data.status).toBe("created");
    challengeId = data.id;
  });

  it("should default to 'other' category for invalid category", async () => {
    const { status, data } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: creatorHeaders,
      body: { title: "Another Challenge", category: "invalid_category" },
    });

    expect(status).toBe(201);
    expect(data.category).toBe("other");
  });

  // ── List Challenges ──

  it("should list challenges for the couple", async () => {
    const { status, data } = await apiRequest("/api/challenges", {
      headers: creatorHeaders,
    });

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((c: { id: string }) => c.id === challengeId)).toBe(true);
  });

  it("should return 404 for user without a couple", async () => {
    const { status } = await apiRequest("/api/challenges", {
      headers: outsiderHeaders,
    });

    expect(status).toBe(404);
  });

  // ── Challenge Detail ──

  it("should return challenge detail with perspectives", async () => {
    const { status, data } = await apiRequest(`/api/challenges/${challengeId}`, {
      headers: creatorHeaders,
    });

    expect(status).toBe(200);
    expect(data.id).toBe(challengeId);
    expect(data.title).toBe("Test Challenge");
    expect(data.perspectives).toHaveLength(2);
    expect(data.bothPerspectivesSubmitted).toBe(false);
    expect(data.currentUserPartner).toMatch(/^[ab]$/);
  });

  it("should deny access to outsider", async () => {
    const { status, data } = await apiRequest(`/api/challenges/${challengeId}`, {
      headers: outsiderHeaders,
    });

    expect(status).toBe(404);
    expect(data.error).toContain("not found");
  });

  // ── Perspectives ──

  it("should hide partner perspective when only one partner has submitted", async () => {
    // Creator submits perspective
    const { status } = await apiRequest(`/api/challenges/${challengeId}/perspectives`, {
      method: "PUT",
      headers: creatorHeaders,
      body: { perspectiveText: "Creator's perspective", submit: true },
    });
    expect(status).toBe(200);

    // Partner reads perspectives — should see own (empty) but not creator's text
    const { data: perspectives } = await apiRequest(
      `/api/challenges/${challengeId}/perspectives`,
      { headers: partnerHeaders },
    );

    expect(perspectives.bothSubmitted).toBe(false);
    expect(perspectives.partner.perspectiveText).toBeNull();
    expect(perspectives.mine.perspectiveText).toBeNull(); // partner hasn't written yet
  });

  it("should reveal both perspectives after both submit", async () => {
    // Partner submits
    const { status } = await apiRequest(`/api/challenges/${challengeId}/perspectives`, {
      method: "PUT",
      headers: partnerHeaders,
      body: { perspectiveText: "Partner's perspective", submit: true },
    });
    expect(status).toBe(200);

    // Both should now be visible
    const { data: perspectives } = await apiRequest(
      `/api/challenges/${challengeId}/perspectives`,
      { headers: creatorHeaders },
    );

    expect(perspectives.bothSubmitted).toBe(true);
    expect(perspectives.mine.perspectiveText).toBe("Creator's perspective");
    expect(perspectives.partner.perspectiveText).toBe("Partner's perspective");
  });

  it("should prevent re-submitting an already submitted perspective", async () => {
    const { status, data } = await apiRequest(
      `/api/challenges/${challengeId}/perspectives`,
      {
        method: "PUT",
        headers: creatorHeaders,
        body: { perspectiveText: "Changed my mind", submit: true },
      },
    );

    expect(status).toBe(400);
    expect(data.error).toContain("already submitted");
  });

  it("should advance challenge status to 'submitted' when both perspectives submitted", async () => {
    const { data } = await apiRequest(`/api/challenges/${challengeId}`, {
      headers: creatorHeaders,
    });

    expect(data.status).toBe("submitted");
  });

  // ── Update Challenge ──

  it("should update challenge title", async () => {
    const { status, data } = await apiRequest(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: creatorHeaders,
      body: { title: "Updated Title" },
    });

    expect(status).toBe(200);
    expect(data.title).toBe("Updated Title");
  });

  it("should reject PATCH with no valid fields", async () => {
    const { status, data } = await apiRequest(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: creatorHeaders,
      body: { invalidField: "nope" },
    });

    expect(status).toBe(400);
    expect(data.error).toContain("No valid fields");
  });

  // ── Accept/Reject Synthesis ──

  it("should reject accept when no synthesis exists", async () => {
    const { status, data } = await apiRequest(
      `/api/challenges/${challengeId}/accept`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: { accept: true },
      },
    );

    expect(status).toBe(400);
    expect(data.error).toContain("No synthesis");
  });

  it("should validate accept field is boolean", async () => {
    const { status, data } = await apiRequest(
      `/api/challenges/${challengeId}/accept`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: { accept: "yes" },
      },
    );

    expect(status).toBe(400);
    expect(data.error).toContain("accept must be a boolean");
  });

  // ── Cross-Couple Isolation ──

  it("should not allow outsider to create challenge", async () => {
    const { status } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: outsiderHeaders,
      body: { title: "Outsider Challenge" },
    });

    expect(status).toBe(404); // No couple found
  });

  it("should not allow outsider to update a challenge", async () => {
    const { status } = await apiRequest(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: outsiderHeaders,
      body: { title: "Hacked" },
    });

    expect(status).toBe(404);
  });

  it("should not allow outsider to submit perspective", async () => {
    const { status } = await apiRequest(
      `/api/challenges/${challengeId}/perspectives`,
      {
        method: "PUT",
        headers: outsiderHeaders,
        body: { perspectiveText: "I shouldn't be here", submit: true },
      },
    );

    expect(status).toBe(403);
  });

  // ── Delete Challenge ──

  it("should delete challenge", async () => {
    // Create a throwaway challenge to delete
    const { data: temp } = await apiRequest("/api/challenges", {
      method: "POST",
      headers: creatorHeaders,
      body: { title: "To Delete" },
    });

    const { status } = await apiRequest(`/api/challenges/${temp.id}`, {
      method: "DELETE",
      headers: creatorHeaders,
    });

    expect(status).toBe(200);

    // Verify it's gone
    const { status: getStatus } = await apiRequest(`/api/challenges/${temp.id}`, {
      headers: creatorHeaders,
    });
    expect(getStatus).toBe(404);
  });
});
