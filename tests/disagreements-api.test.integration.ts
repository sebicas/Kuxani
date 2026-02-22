import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auth } from "@/lib/auth";
import { getTestServerUrl, releaseTestServer } from "./integration-helper";

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

  // Handle SSE responses differently
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    return { status: res.status, data: { raw: text, isSSE: true } };
  }

  return { status: res.status, data: await res.json() };
}

// Test data — unique per run
const ts = Date.now();
const creatorEmail = `dis-creator-${ts}@kuxani.app`;
const partnerEmail = `dis-partner-${ts}@kuxani.app`;
const outsiderEmail = `dis-outsider-${ts}@kuxani.app`;

describe("Disagreement API", () => {
  let creatorHeaders: Headers;
  let partnerHeaders: Headers;
  let outsiderHeaders: Headers;
  let disagreementId: string;

  beforeAll(async () => {
    baseUrl = await getTestServerUrl();

    // Create test users
    creatorHeaders = await createUserAndGetCookie(creatorEmail, "DisCreator Test");
    partnerHeaders = await createUserAndGetCookie(partnerEmail, "DisPartner Test");
    outsiderHeaders = await createUserAndGetCookie(outsiderEmail, "DisOutsider Test");

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
    releaseTestServer();
  });

  // ── Create Disagreement ──

  it("should return 404 for user without a couple", async () => {
    const { status } = await apiRequest("/api/disagreements", {
      method: "POST",
      headers: outsiderHeaders,
    });

    expect(status).toBe(404);
  });

  it("should create a disagreement with AI greeting", async () => {
    const { status, data } = await apiRequest("/api/disagreements", {
      method: "POST",
      headers: creatorHeaders,
      body: { category: "communication" },
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.status).toBe("intake");
    expect(data.visibility).toBe("private");
    expect(data.greeting).toBeDefined();
    expect(typeof data.greeting).toBe("string");
    disagreementId = data.id;
  });

  // ── List Disagreements ──

  it("should list disagreements for creator", async () => {
    const { status, data } = await apiRequest("/api/disagreements", {
      headers: creatorHeaders,
    });

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((d: { id: string }) => d.id === disagreementId)).toBe(true);
  });

  it("should NOT show private disagreement to partner yet", async () => {
    const { status, data } = await apiRequest("/api/disagreements", {
      headers: partnerHeaders,
    });

    expect(status).toBe(200);
    // Disagreement is still private, partner should not see it
    expect(data.some((d: { id: string }) => d.id === disagreementId)).toBe(false);
  });

  // ── Message Visibility (private phase) ──

  it("should show messages to creator only when private", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/messages`,
      { headers: creatorHeaders },
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1); // AI greeting
    expect(data[0].senderType).toBe("ai");
  });

  // ── Invite Partner ──

  it("should prevent non-creator from sending invite", async () => {
    const { status } = await apiRequest(
      `/api/disagreements/${disagreementId}/invite`,
      {
        method: "POST",
        headers: partnerHeaders,
        body: {},
      },
    );

    expect(status).toBe(404); // Not found (only creator can invite)
  });

  it("should invite partner successfully", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/invite`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: { detailLevel: "summary" },
      },
    );

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.disagreementId).toBe(disagreementId);
  });

  it("should show shared disagreement to partner after invite", async () => {
    const { status, data } = await apiRequest("/api/disagreements", {
      headers: partnerHeaders,
    });

    expect(status).toBe(200);
    expect(data.some((d: { id: string }) => d.id === disagreementId)).toBe(true);
  });

  // ── Partner Join ──

  it("should validate action field on join", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/join`,
      {
        method: "POST",
        headers: partnerHeaders,
        body: { action: "invalid" },
      },
    );

    expect(status).toBe(400);
    expect(data.error).toContain("accept");
  });

  it("should allow partner to accept invitation", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/join`,
      {
        method: "POST",
        headers: partnerHeaders,
        body: { action: "accept" },
      },
    );

    expect(status).toBe(200);
    expect(data.status).toBe("accepted");
    expect(data.disagreementStatus).toBe("partner_joined");
  });

  it("should show system join message visible to both", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/messages`,
      { headers: partnerHeaders },
    );

    expect(status).toBe(200);
    const joinMsg = data.find(
      (m: { senderType: string; visibleTo: string }) =>
        m.senderType === "system" && m.visibleTo === "all",
    );
    expect(joinMsg).toBeDefined();
    expect(joinMsg.content).toContain("joined");
  });

  // ── Cross-Couple Isolation ──

  it("should deny outsider access to disagreement detail", async () => {
    const { status } = await apiRequest(
      `/api/disagreements/${disagreementId}`,
      { headers: outsiderHeaders },
    );

    expect(status).toBe(404);
  });

  it("should deny outsider access to messages", async () => {
    const { status } = await apiRequest(
      `/api/disagreements/${disagreementId}/messages`,
      { headers: outsiderHeaders },
    );

    expect(status).toBe(404);
  });

  // ── Get Invitation Status ──

  it("should return invitation list", async () => {
    const { status, data } = await apiRequest(
      `/api/disagreements/${disagreementId}/invite`,
      { headers: creatorHeaders },
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].status).toBe("accepted");
  });
});
