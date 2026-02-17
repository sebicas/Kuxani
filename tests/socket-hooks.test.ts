/**
 * Socket.IO Hooks — Unit Tests (RTL renderHook + mocked socket)
 *
 * Tests all 5 Socket.IO hooks for:
 * - Correct event subscriptions on mount
 * - Room joining on connect
 * - Clean unsubscription on unmount
 * - Self-event filtering (skip own userId)
 * - No-op when coupleId is null
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock: socket client ──
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
const mockSocket = {
  connected: false,
  on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return mockSocket;
  }),
  off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
    listeners.get(event)?.delete(fn);
    return mockSocket;
  }),
  emit: vi.fn(),
  connect: vi.fn(() => {
    mockSocket.connected = true;
  }),
};

function simulateEvent(event: string, ...args: unknown[]) {
  listeners.get(event)?.forEach((fn) => fn(...args));
}

vi.mock("@/lib/socket/socketClient", () => ({
  getSocket: () => mockSocket,
}));

// ── Import hooks after mocks ──
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { useChallengeSocket } from "@/lib/hooks/useChallengeSocket";
import { useDisagreementSocket } from "@/lib/hooks/useDisagreementSocket";
import { usePartnerSocket } from "@/lib/hooks/usePartnerSocket";
import { useCommitmentsSocket } from "@/lib/hooks/useCommitmentsSocket";

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  mockSocket.connected = false;
});

// ══════════════════════════════════════════════
// useCoupleSocket
// ══════════════════════════════════════════════
describe("useCoupleSocket", () => {
  it("subscribes to event and joins room on mount", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", vi.fn()),
    );

    expect(mockSocket.on).toHaveBeenCalledWith(
      "mood-updated",
      expect.any(Function),
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      "connect",
      expect.any(Function),
    );
    expect(mockSocket.emit).toHaveBeenCalledWith("join-couple", "couple-1");
  });

  it("calls connect() when socket is not connected", () => {
    mockSocket.connected = false;

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", vi.fn()),
    );

    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it("calls onUpdate when partner event arrives", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("mood-updated", { userId: "user-2" });
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips own events", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("mood-updated", { userId: "user-1" });
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    mockSocket.connected = true;

    const { unmount } = renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", vi.fn()),
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(
      "mood-updated",
      expect.any(Function),
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      "connect",
      expect.any(Function),
    );
  });

  it("does nothing when coupleId is null", () => {
    renderHook(() =>
      useCoupleSocket(null, "mood-updated", "user-1", vi.fn()),
    );

    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════
// useChallengeSocket
// ══════════════════════════════════════════════
describe("useChallengeSocket", () => {
  it("subscribes to challenge-updated event", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useChallengeSocket("couple-1", "challenge-abc", "user-1", vi.fn()),
    );

    expect(mockSocket.on).toHaveBeenCalledWith(
      "challenge-updated",
      expect.any(Function),
    );
  });

  it("only triggers for matching challenge ID", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useChallengeSocket("couple-1", "challenge-abc", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("challenge-updated", {
        challengeId: "challenge-xxx",
        userId: "user-2",
      });
    });

    expect(onUpdate).not.toHaveBeenCalled();

    act(() => {
      simulateEvent("challenge-updated", {
        challengeId: "challenge-abc",
        userId: "user-2",
      });
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("does nothing when challengeId is null", () => {
    renderHook(() =>
      useChallengeSocket("couple-1", null, "user-1", vi.fn()),
    );

    expect(mockSocket.on).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════
// useDisagreementSocket
// ══════════════════════════════════════════════
describe("useDisagreementSocket", () => {
  const events = [
    "disagreement-message",
    "disagreement-status",
    "disagreement-invite",
    "disagreement-invite-response",
  ];

  it("subscribes to all 4 disagreement events", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useDisagreementSocket("couple-1", "disa-1", "user-1", vi.fn()),
    );

    for (const event of events) {
      expect(mockSocket.on).toHaveBeenCalledWith(
        event,
        expect.any(Function),
      );
    }
  });

  it("joins both couple and disagreement rooms", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useDisagreementSocket("couple-1", "disa-1", "user-1", vi.fn()),
    );

    expect(mockSocket.emit).toHaveBeenCalledWith("join-couple", "couple-1");
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "join-disagreement",
      "disa-1",
    );
  });

  it("leaves disagreement room on unmount", () => {
    mockSocket.connected = true;

    const { unmount } = renderHook(() =>
      useDisagreementSocket("couple-1", "disa-1", "user-1", vi.fn()),
    );

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "leave-disagreement",
      "disa-1",
    );
    for (const event of events) {
      expect(mockSocket.off).toHaveBeenCalledWith(
        event,
        expect.any(Function),
      );
    }
  });

  it("filters by disagreement ID", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useDisagreementSocket("couple-1", "disa-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("disagreement-message", {
        disagreementId: "disa-other",
        userId: "user-2",
      });
    });

    expect(onUpdate).not.toHaveBeenCalled();

    act(() => {
      simulateEvent("disagreement-message", {
        disagreementId: "disa-1",
        userId: "user-2",
      });
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════
// usePartnerSocket
// ══════════════════════════════════════════════
describe("usePartnerSocket", () => {
  it("subscribes to partner-joined event", () => {
    mockSocket.connected = true;

    renderHook(() => usePartnerSocket("couple-1", vi.fn()));

    expect(mockSocket.on).toHaveBeenCalledWith(
      "partner-joined",
      expect.any(Function),
    );
  });

  it("passes partner data to callback (no userId filtering)", () => {
    mockSocket.connected = true;
    const onPartnerJoined = vi.fn();

    renderHook(() => usePartnerSocket("couple-1", onPartnerJoined));

    const partnerData = { name: "Partner", email: "p@test.com", role: "B" };
    act(() => {
      simulateEvent("partner-joined", partnerData);
    });

    expect(onPartnerJoined).toHaveBeenCalledWith(partnerData);
  });

  it("unsubscribes on unmount", () => {
    mockSocket.connected = true;

    const { unmount } = renderHook(() =>
      usePartnerSocket("couple-1", vi.fn()),
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(
      "partner-joined",
      expect.any(Function),
    );
  });
});

// ══════════════════════════════════════════════
// useCommitmentsSocket
// ══════════════════════════════════════════════
describe("useCommitmentsSocket", () => {
  const events = [
    "request-created",
    "request-updated",
    "compromise-created",
    "compromise-updated",
  ];

  it("subscribes to all 4 commitment events", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useCommitmentsSocket("couple-1", "user-1", vi.fn()),
    );

    for (const event of events) {
      expect(mockSocket.on).toHaveBeenCalledWith(
        event,
        expect.any(Function),
      );
    }
  });

  it("triggers on any commitment event from partner", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCommitmentsSocket("couple-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("request-created", { userId: "user-2" });
    });
    act(() => {
      simulateEvent("compromise-updated", { userId: "user-2" });
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("skips own events", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCommitmentsSocket("couple-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("request-created", { userId: "user-1" });
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("unsubscribes from all events on unmount", () => {
    mockSocket.connected = true;

    const { unmount } = renderHook(() =>
      useCommitmentsSocket("couple-1", "user-1", vi.fn()),
    );

    unmount();

    for (const event of events) {
      expect(mockSocket.off).toHaveBeenCalledWith(
        event,
        expect.any(Function),
      );
    }
  });
});

// ══════════════════════════════════════════════
// Edge Cases
// ══════════════════════════════════════════════
describe("Edge Cases", () => {
  it("useCoupleSocket re-joins room on reconnect event", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", vi.fn()),
    );

    // Initial join
    expect(mockSocket.emit).toHaveBeenCalledWith("join-couple", "couple-1");

    // Simulate reconnect
    act(() => {
      simulateEvent("connect");
    });

    // Should re-join the room
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
  });

  it("useCoupleSocket handles payload without userId gracefully", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", onUpdate),
    );

    // Payload with no userId at all
    act(() => {
      simulateEvent("mood-updated", {});
    });

    // Should trigger since userId doesn't match "user-1"
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("useCoupleSocket handles multiple rapid events", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCoupleSocket("couple-1", "mood-updated", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("mood-updated", { userId: "user-2" });
      simulateEvent("mood-updated", { userId: "user-2" });
      simulateEvent("mood-updated", { userId: "user-2" });
    });

    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it("useCoupleSocket does nothing when userId is null", () => {
    mockSocket.connected = true;

    renderHook(() =>
      useCoupleSocket(null, "mood-updated", null, vi.fn()),
    );

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it("useDisagreementSocket does nothing when coupleId is null", () => {
    renderHook(() =>
      useDisagreementSocket(null, "disa-1", "user-1", vi.fn()),
    );

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it("useChallengeSocket skips own events even with matching challengeId", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useChallengeSocket("couple-1", "ch-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("challenge-updated", {
        challengeId: "ch-1",
        userId: "user-1",
      });
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("useDisagreementSocket skips own events on all event types", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useDisagreementSocket("couple-1", "disa-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("disagreement-message", {
        disagreementId: "disa-1",
        userId: "user-1",
      });
      simulateEvent("disagreement-status", {
        disagreementId: "disa-1",
        userId: "user-1",
      });
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("useCommitmentsSocket handles all 4 event types from partner", () => {
    mockSocket.connected = true;
    const onUpdate = vi.fn();

    renderHook(() =>
      useCommitmentsSocket("couple-1", "user-1", onUpdate),
    );

    act(() => {
      simulateEvent("request-created", { userId: "user-2" });
      simulateEvent("request-updated", { userId: "user-2" });
      simulateEvent("compromise-created", { userId: "user-2" });
      simulateEvent("compromise-updated", { userId: "user-2" });
    });

    expect(onUpdate).toHaveBeenCalledTimes(4);
  });
});

