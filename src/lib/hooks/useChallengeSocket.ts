/**
 * useChallengeSocket Hook
 *
 * Connects to Socket.IO, joins the couple room, and listens for
 * "challenge-updated" events. When an update for the current challenge
 * arrives, calls onUpdate() so the page can refetch data.
 *
 * Skips events triggered by the current user (the sender already has
 * the latest state from their own API call).
 *
 * IMPORTANT: This uses a shared singleton socket. The hook MUST NOT
 * call socket.disconnect() on cleanup — other consumers share the
 * same connection.
 */
"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { CHALLENGE_UPDATED } from "@/lib/socket/events";

interface ChallengeEvent {
  challengeId: string;
  action: string;
  userId?: string;
}

export function useChallengeSocket(
  coupleId: string | null | undefined,
  challengeId: string | null | undefined,
  currentUserId: string | null | undefined,
  onUpdate: () => void
) {
  const callbackRef = useRef(onUpdate);
  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    if (!coupleId || !challengeId) return;

    const socket = getSocket();

    const handleUpdate = (data: ChallengeEvent) => {
      // Only react to events for this challenge, and skip own events
      if (data.challengeId !== challengeId) return;
      if (data.userId && data.userId === currentUserId) return;
      callbackRef.current();
    };

    // Named handler so we only remove our own listener on cleanup
    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
    };

    socket.on("connect", handleConnect);
    socket.on(CHALLENGE_UPDATED, handleUpdate);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("join-couple", coupleId);
    }

    return () => {
      socket.off(CHALLENGE_UPDATED, handleUpdate);
      socket.off("connect", handleConnect);
      // Do NOT disconnect — the socket is a shared singleton
    };
  }, [coupleId, challengeId, currentUserId]);
}
