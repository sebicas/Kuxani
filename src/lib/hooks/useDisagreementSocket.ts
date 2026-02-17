/**
 * useDisagreementSocket Hook
 *
 * Connects to Socket.IO, joins the couple room + disagreement room,
 * and listens for disagreement-related events. When an update for the
 * current disagreement arrives (from partner or system), calls onUpdate()
 * so the page can refetch data.
 *
 * Skips events triggered by the current user.
 *
 * IMPORTANT: This uses a shared singleton socket. The hook MUST NOT
 * call socket.disconnect() on cleanup — other consumers share the
 * same connection.
 */
"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import {
  DISAGREEMENT_MESSAGE,
  DISAGREEMENT_STATUS,
  DISAGREEMENT_INVITE,
  DISAGREEMENT_INVITE_RESPONSE,
} from "@/lib/socket/events";

interface DisagreementEvent {
  disagreementId: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

export function useDisagreementSocket(
  coupleId: string | null | undefined,
  disagreementId: string | null | undefined,
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

    const handleEvent = (data: DisagreementEvent) => {
      // Only react to events for this disagreement (or all if no ID)
      if (disagreementId && data.disagreementId !== disagreementId) return;
      // Skip own events — the sender already has fresh state
      if (data.userId && data.userId === currentUserId) return;
      callbackRef.current();
    };

    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
      if (disagreementId) {
        socket.emit("join-disagreement", disagreementId);
      }
    };

    socket.on("connect", handleConnect);
    socket.on(DISAGREEMENT_MESSAGE, handleEvent);
    socket.on(DISAGREEMENT_STATUS, handleEvent);
    socket.on(DISAGREEMENT_INVITE, handleEvent);
    socket.on(DISAGREEMENT_INVITE_RESPONSE, handleEvent);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("join-couple", coupleId);
      if (disagreementId) {
        socket.emit("join-disagreement", disagreementId);
      }
    }

    return () => {
      socket.off(DISAGREEMENT_MESSAGE, handleEvent);
      socket.off(DISAGREEMENT_STATUS, handleEvent);
      socket.off(DISAGREEMENT_INVITE, handleEvent);
      socket.off(DISAGREEMENT_INVITE_RESPONSE, handleEvent);
      socket.off("connect", handleConnect);
      if (disagreementId) {
        socket.emit("leave-disagreement", disagreementId);
      }
      // Do NOT disconnect — the socket is a shared singleton
    };
  }, [coupleId, disagreementId, currentUserId]);
}
