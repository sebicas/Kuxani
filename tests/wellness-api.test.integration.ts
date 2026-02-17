/**
 * Wellness API Integration Tests
 *
 * Covers:
 * - Mood tracker: create/list, validation, partner visibility
 * - Gratitude journal: create/list, validation
 * - Love Languages: quiz submission, score validation
 *
 * Requires: Docker (PostgreSQL) running + local Next.js server
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

// ── Helper: make API request ──
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

// Unique test data
const ts = Date.now();
const userAEmail = `well-a-${ts}@kuxani.app`;
const userBEmail = `well-b-${ts}@kuxani.app`;
const soloEmail = `well-solo-${ts}@kuxani.app`;

describe("Wellness APIs", () => {
  let userAHeaders: Headers;
  let userBHeaders: Headers;
  let soloHeaders: Headers;

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
    userAHeaders = await createUserAndGetCookie(userAEmail, "WellnessA Test");
    userBHeaders = await createUserAndGetCookie(userBEmail, "WellnessB Test");
    soloHeaders = await createUserAndGetCookie(soloEmail, "Solo User");

    // Set up couple: A creates, B joins
    const { data: couple } = await apiRequest("/api/couples", {
      method: "POST",
      headers: userAHeaders,
    });
    await apiRequest("/api/couples/join", {
      method: "POST",
      headers: userBHeaders,
      body: { inviteCode: couple.inviteCode },
    });
  }, 120_000);

  afterAll(() => {
    process.stdout.write = originalStdoutWrite;
    server?.close();
  });

  // ── Mood Tracker ──

  describe("Mood API", () => {
    it("should create a mood entry with valid data", async () => {
      const { status, data } = await apiRequest("/api/mood", {
        method: "POST",
        headers: userAHeaders,
        body: {
          primaryEmotion: "happy",
          intensity: 7,
          notes: "Feeling great today",
          sharedWithPartner: true,
        },
      });

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.primaryEmotion).toBe("happy");
      expect(data.intensity).toBe(7);
    });

    it("should return 400 when primaryEmotion is missing", async () => {
      const { status, data } = await apiRequest("/api/mood", {
        method: "POST",
        headers: userAHeaders,
        body: { intensity: 5 },
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Primary emotion");
    });

    it("should create a private (unshared) mood entry", async () => {
      const { status } = await apiRequest("/api/mood", {
        method: "POST",
        headers: userBHeaders,
        body: {
          primaryEmotion: "sad",
          intensity: 3,
          sharedWithPartner: false,
        },
      });

      expect(status).toBe(201);
    });

    it("should return own + partner's shared entries", async () => {
      const { status, data } = await apiRequest("/api/mood", {
        headers: userBHeaders,
      });

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      // Should see own entry AND partner's shared entry
      const ownEntries = data.filter(
        (e: { isPartnerEntry?: boolean }) => !e.isPartnerEntry,
      );
      const partnerEntries = data.filter(
        (e: { isPartnerEntry?: boolean }) => e.isPartnerEntry,
      );

      expect(ownEntries.length).toBeGreaterThanOrEqual(1);
      expect(partnerEntries.length).toBeGreaterThanOrEqual(1); // partner A's shared entry
    });

    it("should NOT return partner's unshared entries", async () => {
      const { status, data } = await apiRequest("/api/mood", {
        headers: userAHeaders,
      });

      expect(status).toBe(200);

      // Partner B created an unshared entry — should NOT appear for user A
      const partnerEntries = data.filter(
        (e: { isPartnerEntry?: boolean }) => e.isPartnerEntry,
      );

      for (const entry of partnerEntries) {
        expect(entry.primaryEmotion).not.toBe("sad"); // B's private entry
      }
    });

    it("should clamp intensity to 1-10 range", async () => {
      const { status, data } = await apiRequest("/api/mood", {
        method: "POST",
        headers: userAHeaders,
        body: {
          primaryEmotion: "calm",
          intensity: 50, // exceeds max
          sharedWithPartner: false,
        },
      });

      expect(status).toBe(201);
      expect(data.intensity).toBe(10); // clamped
    });
  });

  // ── Gratitude Journal ──

  describe("Gratitude API", () => {
    it("should create a gratitude entry", async () => {
      const { status, data } = await apiRequest("/api/gratitude", {
        method: "POST",
        headers: userAHeaders,
        body: {
          content: "Grateful for a wonderful day together",
          category: "gratitude",
          shared: true,
        },
      });

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.content).toBe("Grateful for a wonderful day together");
    });

    it("should return 400 for empty content", async () => {
      const { status, data } = await apiRequest("/api/gratitude", {
        method: "POST",
        headers: userAHeaders,
        body: { content: "", category: "gratitude" },
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Content");
    });

    it("should default to gratitude category for invalid input", async () => {
      const { status, data } = await apiRequest("/api/gratitude", {
        method: "POST",
        headers: userAHeaders,
        body: { content: "Test entry", category: "invalid_cat" },
      });

      expect(status).toBe(201);
      expect(data.category).toBe("gratitude");
    });

    it("should return entries for current period", async () => {
      const { status, data } = await apiRequest("/api/gratitude", {
        headers: userAHeaders,
      });

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Love Languages ──

  describe("Love Languages API", () => {
    it("should save quiz results with valid scores", async () => {
      const { status, data } = await apiRequest("/api/love-languages", {
        method: "POST",
        headers: userAHeaders,
        body: {
          wordsOfAffirmation: 8,
          actsOfService: 6,
          receivingGifts: 4,
          qualityTime: 9,
          physicalTouch: 3,
        },
      });

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.qualityTime).toBe(9);
    });

    it("should return 400 for invalid scores (out of range)", async () => {
      const { status, data } = await apiRequest("/api/love-languages", {
        method: "POST",
        headers: userAHeaders,
        body: {
          wordsOfAffirmation: 50, // exceeds 30
          actsOfService: 6,
          receivingGifts: 4,
          qualityTime: 9,
          physicalTouch: 3,
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid scores");
    });

    it("should return own and partner results", async () => {
      // B submits too
      await apiRequest("/api/love-languages", {
        method: "POST",
        headers: userBHeaders,
        body: {
          wordsOfAffirmation: 5,
          actsOfService: 7,
          receivingGifts: 8,
          qualityTime: 3,
          physicalTouch: 7,
        },
      });

      const { status, data } = await apiRequest("/api/love-languages", {
        headers: userAHeaders,
      });

      expect(status).toBe(200);
      expect(data.userResult).toBeDefined();
      expect(data.partnerResult).toBeDefined();
      expect(data.partnerResult.receivingGifts).toBe(8);
    });

    it("should return null partnerResult for solo user", async () => {
      await apiRequest("/api/love-languages", {
        method: "POST",
        headers: soloHeaders,
        body: {
          wordsOfAffirmation: 5,
          actsOfService: 5,
          receivingGifts: 5,
          qualityTime: 5,
          physicalTouch: 5,
        },
      });

      const { status, data } = await apiRequest("/api/love-languages", {
        headers: soloHeaders,
      });

      expect(status).toBe(200);
      expect(data.userResult).toBeDefined();
      expect(data.partnerResult).toBeNull();
    });
  });
});
