/**
 * useCommitmentsSocket Hook
 *
 * Connects to Socket.IO and listens for request/compromise events
 * across the couple room. Triggers onUpdate() so the page can refetch.
 */
"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import {
  REQUEST_CREATED,
  REQUEST_UPDATED,
  COMPROMISE_CREATED,
  COMPROMISE_UPDATED,
} from "@/lib/socket/events";

interface CommitmentEvent {
  userId?: string;
  [key: string]: unknown;
}

export function useCommitmentsSocket(
  coupleId: string | null | undefined,
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

    const handleEvent = (data: CommitmentEvent) => {
      if (data.userId && data.userId === currentUserId) return;
      callbackRef.current();
    };

    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
    };

    socket.on("connect", handleConnect);
    socket.on(REQUEST_CREATED, handleEvent);
    socket.on(REQUEST_UPDATED, handleEvent);
    socket.on(COMPROMISE_CREATED, handleEvent);
    socket.on(COMPROMISE_UPDATED, handleEvent);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("join-couple", coupleId);
    }

    return () => {
      socket.off(REQUEST_CREATED, handleEvent);
      socket.off(REQUEST_UPDATED, handleEvent);
      socket.off(COMPROMISE_CREATED, handleEvent);
      socket.off(COMPROMISE_UPDATED, handleEvent);
      socket.off("connect", handleConnect);
    };
  }, [coupleId, currentUserId]);
}
