/**
 * usePartnerSocket Hook
 *
 * Connects to Socket.IO, joins the couple room, and listens for "partner-joined"
 * events. Calls onPartnerJoined callback when the partner signs up and joins.
 *
 * IMPORTANT: This uses a shared singleton socket. The hook MUST NOT
 * call socket.disconnect() on cleanup — other consumers share the
 * same connection.
 */
"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { PARTNER_JOINED } from "@/lib/socket/events";

interface PartnerData {
  name: string;
  email: string;
  role: string;
}

export function usePartnerSocket(
  coupleId: string | null | undefined,
  onPartnerJoined: (partner: PartnerData) => void
) {
  // Keep callback ref stable to avoid re-subscribing
  const callbackRef = useRef(onPartnerJoined);
  useEffect(() => {
    callbackRef.current = onPartnerJoined;
  });

  useEffect(() => {
    // Only connect if we have a pending couple
    if (!coupleId) return;

    const socket = getSocket();

    const handlePartnerJoined = (data: PartnerData) => {
      callbackRef.current(data);
    };

    // Named handler so we only remove our own listener on cleanup
    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
    };

    socket.on("connect", handleConnect);
    socket.on(PARTNER_JOINED, handlePartnerJoined);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected — join room immediately
      socket.emit("join-couple", coupleId);
    }

    return () => {
      socket.off(PARTNER_JOINED, handlePartnerJoined);
      socket.off("connect", handleConnect);
      // Do NOT disconnect — the socket is a shared singleton
    };
  }, [coupleId]);
}
