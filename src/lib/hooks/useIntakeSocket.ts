/**
 * useIntakeSocket — Real-time intake progress updates
 *
 * Listens for INTAKE_UPDATED events from the partner's couple room
 * to update the Intake Hub page in real-time.
 */
"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { INTAKE_UPDATED } from "@/lib/socket/events";

export function useIntakeSocket(
  coupleId: string | null,
  onUpdate: (data: { phase: number; status: string; userId: string }) => void
) {
  useEffect(() => {
    if (!coupleId) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join-couple", coupleId);
    socket.on(INTAKE_UPDATED, onUpdate);

    return () => {
      socket.off(INTAKE_UPDATED, onUpdate);
    };
  }, [coupleId, onUpdate]);
}
