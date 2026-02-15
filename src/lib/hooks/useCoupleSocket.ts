/**
 * useCoupleSocket — Generic Real-Time Hook
 *
 * Connects to Socket.IO, joins the couple room, and listens for a
 * specific event. When a matching event arrives from the partner,
 * calls onUpdate() so the page can refetch data.
 *
 * Skips events triggered by the current user.
 *
 * IMPORTANT: This uses a shared singleton socket. The hook MUST NOT
 * call socket.disconnect() on cleanup — other consumers (e.g.
 * NotificationProvider) share the same connection.
 */
"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";

interface CoupleEvent {
  userId?: string;
  [key: string]: unknown;
}

export function useCoupleSocket(
  coupleId: string | null | undefined,
  event: string,
  currentUserId: string | null | undefined,
  onUpdate: () => void
) {
  const callbackRef = useRef(onUpdate);
  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    if (!coupleId) return;

    const socket = getSocket();

    const handleEvent = (data: CoupleEvent) => {
      // Skip own events — the sender already has fresh state
      if (data.userId && data.userId === currentUserId) return;
      callbackRef.current();
    };

    // Named handler so we only remove our own listener on cleanup
    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
    };

    socket.on("connect", handleConnect);
    socket.on(event, handleEvent);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("join-couple", coupleId);
    }

    return () => {
      socket.off(event, handleEvent);
      socket.off("connect", handleConnect);
      // Do NOT disconnect — the socket is a shared singleton
    };
  }, [coupleId, event, currentUserId]);
}
