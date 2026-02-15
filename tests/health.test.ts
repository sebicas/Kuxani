/**
 * Health Endpoint Tests
 *
 * Tests GET /api/health for both healthy and unhealthy scenarios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock drizzle-orm sql template tag (it's used as a tagged template literal)
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

// Mock the db module
const mockExecute = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

// Import the handler AFTER mocks are set up
const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Socket.IO global
    globalThis.__socketIO = undefined;
  });

  it("returns 200 and healthy status when DB is reachable", async () => {
    mockExecute.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.database.latency_ms).toBeTypeOf("number");
    expect(body.checks.socketio.status).toBe("ok");
    expect(body.version).toBeTypeOf("string");
    expect(body.environment).toBeTypeOf("string");
    expect(body.uptime).toBeTypeOf("number");
    expect(body.timestamp).toBeTypeOf("string");
    expect(body.memory.rss_mb).toBeTypeOf("number");
    expect(body.memory.heap_used_mb).toBeTypeOf("number");
    expect(body.memory.heap_total_mb).toBeTypeOf("number");
  });

  it("returns 503 and unhealthy status when DB is unreachable", async () => {
    mockExecute.mockRejectedValueOnce(new Error("connection refused"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.message).toBe("connection refused");
  });

  it("reports socket.io as not_initialized when no instance exists", async () => {
    mockExecute.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(body.checks.socketio.status).toBe("ok");
    expect(body.checks.socketio.note).toBe("not_initialized");
    expect(body.checks.socketio.connections).toBe(0);
  });

  it("reports socket.io connections when instance exists", async () => {
    mockExecute.mockResolvedValueOnce([{ "?column?": 1 }]);
    // Mock Socket.IO global
    globalThis.__socketIO = {
      fetchSockets: vi.fn().mockResolvedValueOnce([{}, {}]),
    } as unknown as typeof globalThis.__socketIO;

    const res = await GET();
    const body = await res.json();

    expect(body.checks.socketio.status).toBe("ok");
    expect(body.checks.socketio.connections).toBe(2);
  });

  it("includes Cache-Control: no-store header", async () => {
    mockExecute.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET();

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
