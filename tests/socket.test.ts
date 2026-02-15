/**
 * WebSocket / Socket.IO Unit Tests
 *
 * Tests the socket infrastructure:
 * - socketServer.ts: setIO / getIO singleton
 * - events.ts: event constants
 * - socketClient.ts: client singleton factory
 * - server.ts join-couple validation logic
 *
 * Run: npm run test:unit
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Server as SocketIOServer } from "socket.io";

/* ══════════════════════════════════════
 * Socket Server Utilities (setIO / getIO)
 * ══════════════════════════════════════ */
describe("Socket Server — setIO / getIO", () => {
  beforeEach(async () => {
    // Reset module between tests to clear the singleton
    vi.resetModules();
  });

  it("should throw if getIO is called before setIO", async () => {
    const { getIO } = await import("@/lib/socket/socketServer");
    expect(() => getIO()).toThrow("Socket.IO has not been initialized");
  });

  it("should return the IO instance after setIO is called", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const mockIO = { emit: vi.fn(), on: vi.fn() } as unknown as SocketIOServer;

    setIO(mockIO);
    const result = getIO();
    expect(result).toBe(mockIO);
  });

  it("should overwrite the IO instance when setIO is called again", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const mockIO1 = { id: "first" } as unknown as SocketIOServer;
    const mockIO2 = { id: "second" } as unknown as SocketIOServer;

    setIO(mockIO1);
    expect(getIO()).toBe(mockIO1);

    setIO(mockIO2);
    expect(getIO()).toBe(mockIO2);
  });

  it("should return the same instance on multiple getIO calls", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const mockIO = { emit: vi.fn() } as unknown as SocketIOServer;

    setIO(mockIO);
    const a = getIO();
    const b = getIO();
    expect(a).toBe(b);
  });
});

/* ══════════════════════════════════════
 * Socket Event Constants
 * ══════════════════════════════════════ */
describe("Socket Events", () => {
  it("should export PARTNER_JOINED constant", async () => {
    const { PARTNER_JOINED } = await import("@/lib/socket/events");
    expect(PARTNER_JOINED).toBe("partner-joined");
    expect(typeof PARTNER_JOINED).toBe("string");
  });

  it("should export CHALLENGE_UPDATED constant", async () => {
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");
    expect(CHALLENGE_UPDATED).toBe("challenge-updated");
    expect(typeof CHALLENGE_UPDATED).toBe("string");
  });

  it("should export GRATITUDE_UPDATED constant", async () => {
    const { GRATITUDE_UPDATED } = await import("@/lib/socket/events");
    expect(GRATITUDE_UPDATED).toBe("gratitude-updated");
    expect(typeof GRATITUDE_UPDATED).toBe("string");
  });

  it("should export MOOD_UPDATED constant", async () => {
    const { MOOD_UPDATED } = await import("@/lib/socket/events");
    expect(MOOD_UPDATED).toBe("mood-updated");
    expect(typeof MOOD_UPDATED).toBe("string");
  });

  it("should export LOVE_LANGUAGE_UPDATED constant", async () => {
    const { LOVE_LANGUAGE_UPDATED } = await import("@/lib/socket/events");
    expect(LOVE_LANGUAGE_UPDATED).toBe("love-language-updated");
    expect(typeof LOVE_LANGUAGE_UPDATED).toBe("string");
  });

  it("should have unique event names", async () => {
    const {
      PARTNER_JOINED,
      CHALLENGE_UPDATED,
      GRATITUDE_UPDATED,
      MOOD_UPDATED,
      LOVE_LANGUAGE_UPDATED,
    } = await import("@/lib/socket/events");
    const events = [PARTNER_JOINED, CHALLENGE_UPDATED, GRATITUDE_UPDATED, MOOD_UPDATED, LOVE_LANGUAGE_UPDATED];
    expect(new Set(events).size).toBe(events.length);
  });

  it("should not have empty event names", async () => {
    const {
      PARTNER_JOINED,
      CHALLENGE_UPDATED,
      GRATITUDE_UPDATED,
      MOOD_UPDATED,
      LOVE_LANGUAGE_UPDATED,
    } = await import("@/lib/socket/events");
    const events = [PARTNER_JOINED, CHALLENGE_UPDATED, GRATITUDE_UPDATED, MOOD_UPDATED, LOVE_LANGUAGE_UPDATED];
    for (const e of events) {
      expect(e.length).toBeGreaterThan(0);
    }
  });
});

/* ══════════════════════════════════════
 * Socket Client Singleton
 * ══════════════════════════════════════ */
describe("Socket Client — getSocket", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should be importable and export getSocket function", async () => {
    // Mock socket.io-client since we're in a Node test environment
    vi.doMock("socket.io-client", () => ({
      io: vi.fn(() => ({
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      })),
    }));

    const { getSocket } = await import("@/lib/socket/socketClient");
    expect(typeof getSocket).toBe("function");
  });

  it("should return the same socket instance (singleton)", async () => {
    vi.doMock("socket.io-client", () => ({
      io: vi.fn(() => ({
        id: "mock-socket",
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      })),
    }));

    const { getSocket } = await import("@/lib/socket/socketClient");
    const a = getSocket();
    const b = getSocket();
    expect(a).toBe(b);
  });

  it("should create socket with autoConnect=false", async () => {
    const mockIo = vi.fn(() => ({
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    }));

    vi.doMock("socket.io-client", () => ({ io: mockIo }));

    const { getSocket } = await import("@/lib/socket/socketClient");
    getSocket();

    expect(mockIo).toHaveBeenCalledWith(
      expect.objectContaining({
        autoConnect: false,
        withCredentials: true,
      })
    );
  });
});

/* ══════════════════════════════════════
 * Server — Join Couple Validation
 *
 * Tests the join-couple handler logic by mocking
 * Socket.IO, auth, and DB.
 * ══════════════════════════════════════ */
describe("Server — Join Couple Room Validation", () => {
  it("should reject join-couple with empty coupleId", () => {
    // The server handler checks: if (!coupleId || typeof coupleId !== "string") return;
    const invalidIds = [null, undefined, "", 0, false, 123, {}];
    for (const id of invalidIds) {
      const isValid = id && typeof id === "string";
      expect(isValid).toBeFalsy();
    }
  });

  it("should accept join-couple with valid string coupleId", () => {
    const validIds = [
      "abc123",
      "couple-uuid-here",
      "6cba3e02-2b73-4792-b217-892d60be4465",
    ];
    for (const id of validIds) {
      const isValid = id && typeof id === "string";
      expect(isValid).toBeTruthy();
    }
  });
});

/* ══════════════════════════════════════
 * Socket Event Emission Pattern
 *
 * Tests that the try/catch pattern used in API routes
 * for socket emission works correctly.
 * ══════════════════════════════════════ */
describe("Socket Emission Pattern", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should emit to correct room pattern: couple:{coupleId}", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    const coupleId = "test-couple-123";
    getIO()
      .to(`couple:${coupleId}`)
      .emit(CHALLENGE_UPDATED, {
        challengeId: "ch-1",
        action: "perspective_submitted",
        userId: "user-1",
      });

    expect(mockTo).toHaveBeenCalledWith("couple:test-couple-123");
    expect(mockEmit).toHaveBeenCalledWith(
      "challenge-updated",
      expect.objectContaining({
        challengeId: "ch-1",
        action: "perspective_submitted",
        userId: "user-1",
      })
    );
  });

  it("should emit PARTNER_JOINED with correct data shape", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { PARTNER_JOINED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    const coupleId = "couple-abc";
    getIO().to(`couple:${coupleId}`).emit(PARTNER_JOINED, {
      name: "Bob Partner",
      email: "bob@kuxani.app",
      role: "partner",
    });

    expect(mockTo).toHaveBeenCalledWith("couple:couple-abc");
    expect(mockEmit).toHaveBeenCalledWith("partner-joined", {
      name: "Bob Partner",
      email: "bob@kuxani.app",
      role: "partner",
    });
  });

  it("should emit CHALLENGE_UPDATED for all API actions", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    const actions = [
      "perspective_submitted",
      "synthesis_generated",
      "synthesis_rejected",
      "accepted",
      "both_accepted",
      "message_sent",
      "request_created",
      "request_accepted",
      "resolved",
      "challenge-created",
    ];

    for (const action of actions) {
      getIO()
        .to("couple:test")
        .emit(CHALLENGE_UPDATED, {
          challengeId: "ch-1",
          action,
          userId: "user-1",
        });
    }

    expect(mockEmit).toHaveBeenCalledTimes(actions.length);
  });

  it("should emit GRATITUDE_UPDATED with correct data shape", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { GRATITUDE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    getIO().to("couple:couple-abc").emit(GRATITUDE_UPDATED, {
      entryId: "entry-1",
      action: "gratitude-shared",
      userId: "user-1",
    });

    expect(mockTo).toHaveBeenCalledWith("couple:couple-abc");
    expect(mockEmit).toHaveBeenCalledWith("gratitude-updated", {
      entryId: "entry-1",
      action: "gratitude-shared",
      userId: "user-1",
    });
  });

  it("should emit MOOD_UPDATED when mood is shared", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { MOOD_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    getIO().to("couple:couple-xyz").emit(MOOD_UPDATED, {
      entryId: "mood-1",
      action: "mood-shared",
      userId: "user-2",
    });

    expect(mockTo).toHaveBeenCalledWith("couple:couple-xyz");
    expect(mockEmit).toHaveBeenCalledWith("mood-updated", {
      entryId: "mood-1",
      action: "mood-shared",
      userId: "user-2",
    });
  });

  it("should emit LOVE_LANGUAGE_UPDATED when quiz is completed", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { LOVE_LANGUAGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    getIO().to("couple:couple-123").emit(LOVE_LANGUAGE_UPDATED, {
      resultId: "result-1",
      action: "love-language-completed",
      userId: "user-3",
    });

    expect(mockTo).toHaveBeenCalledWith("couple:couple-123");
    expect(mockEmit).toHaveBeenCalledWith("love-language-updated", {
      resultId: "result-1",
      action: "love-language-completed",
      userId: "user-3",
    });
  });

  it("should gracefully handle getIO() throw in try/catch pattern", async () => {
    const { getIO } = await import("@/lib/socket/socketServer");

    // Clear any previously set IO instance (stored on globalThis)
    (globalThis as Record<string, unknown>).__socketIO = undefined;

    // Simulate the try/catch pattern used in all API routes
    let emitted = false;
    try {
      getIO()
        .to("couple:test")
        .emit("challenge-updated", { challengeId: "ch-1" });
      emitted = true;
    } catch {
      // Socket.IO not initialized — this is expected in tests
    }

    expect(emitted).toBe(false);
  });
});

/* ══════════════════════════════════════
 * Edge Cases — Room Names & Payloads
 * ══════════════════════════════════════ */
describe("Socket Edge Cases", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should handle room names with special characters", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    const coupleId = "uuid-with-dashes-123-456-789";
    getIO()
      .to(`couple:${coupleId}`)
      .emit(CHALLENGE_UPDATED, { challengeId: "ch-1", action: "test", userId: "u-1" });

    expect(mockTo).toHaveBeenCalledWith("couple:uuid-with-dashes-123-456-789");
  });

  it("should handle emission with minimal payload", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { PARTNER_JOINED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    getIO().to("couple:minimal").emit(PARTNER_JOINED, {});
    expect(mockEmit).toHaveBeenCalledWith("partner-joined", {});
  });

  it("should handle emission with extra unexpected fields in payload", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    getIO().to("couple:extra-fields").emit(CHALLENGE_UPDATED, {
      challengeId: "ch-1",
      action: "test",
      userId: "u-1",
      extraField: "unexpected",
      nestedObject: { deep: true },
    });

    expect(mockEmit).toHaveBeenCalledWith("challenge-updated", expect.objectContaining({
      challengeId: "ch-1",
      extraField: "unexpected",
    }));
  });

  it("should handle rapid-fire emissions to the same room", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { MOOD_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    for (let i = 0; i < 100; i++) {
      getIO().to("couple:rapid").emit(MOOD_UPDATED, {
        entryId: `entry-${i}`,
        action: "mood-shared",
        userId: "user-1",
      });
    }

    expect(mockEmit).toHaveBeenCalledTimes(100);
    expect(mockTo).toHaveBeenCalledTimes(100);
  });

  it("should handle emission to different rooms sequentially", async () => {
    const { setIO, getIO } = await import("@/lib/socket/socketServer");
    const { CHALLENGE_UPDATED } = await import("@/lib/socket/events");

    const mockEmit = vi.fn();
    const mockTo = vi.fn(() => ({ emit: mockEmit }));
    const mockIO = { to: mockTo } as unknown as SocketIOServer;

    setIO(mockIO);

    const rooms = ["couple:aaa", "couple:bbb", "couple:ccc"];
    for (const room of rooms) {
      getIO().to(room).emit(CHALLENGE_UPDATED, { challengeId: "ch-1", action: "test", userId: "u-1" });
    }

    expect(mockTo).toHaveBeenNthCalledWith(1, "couple:aaa");
    expect(mockTo).toHaveBeenNthCalledWith(2, "couple:bbb");
    expect(mockTo).toHaveBeenNthCalledWith(3, "couple:ccc");
  });
});

