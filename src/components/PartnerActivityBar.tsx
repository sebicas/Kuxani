/**
 * PartnerActivityBar — Persistent Partner Status Indicator
 *
 * Always visible in the disagreement chat workspace. Shows what the
 * partner is currently doing in real time via WebSocket.
 *
 * States: idle, viewing_list, reading_invite, reading_perspective,
 * writing_perspective, typing, speaking, online, offline, joined
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { PARTNER_ACTIVITY } from "@/lib/socket/events";
import styles from "./PartnerActivityBar.module.css";

type PartnerActivity =
  | "idle"
  | "viewing_list"
  | "reading_invite"
  | "reading_perspective"
  | "writing_perspective"
  | "typing"
  | "speaking"
  | "online"
  | "offline"
  | "joined";

interface ActivityEvent {
  disagreementId: string;
  userId: string;
  activity: PartnerActivity;
}

const ACTIVITY_DISPLAY: Record<
  PartnerActivity,
  { icon: string; label: string; animate?: boolean }
> = {
  idle: { icon: "🔲", label: "Waiting for partner" },
  viewing_list: { icon: "👀", label: "Partner is browsing…" },
  reading_invite: { icon: "📩", label: "Partner opened invitation…", animate: true },
  reading_perspective: { icon: "👀", label: "Partner reading your perspective…", animate: true },
  writing_perspective: { icon: "✍️", label: "Partner sharing their perspective…", animate: true },
  typing: { icon: "💬", label: "Partner typing…", animate: true },
  speaking: { icon: "🎙️", label: "Partner speaking…", animate: true },
  online: { icon: "🟢", label: "Partner is in the chat" },
  offline: { icon: "🔴", label: "Partner is away" },
  joined: { icon: "✅", label: "Partner joined the chat!" },
};

export default function PartnerActivityBar({
  disagreementId,
  currentUserId,
}: {
  disagreementId: string;
  currentUserId: string | null;
}) {
  const [activity, setActivity] = useState<PartnerActivity>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleActivity = (data: ActivityEvent) => {
      if (data.disagreementId !== disagreementId) return;
      if (data.userId === currentUserId) return; // skip own events

      setActivity(data.activity);

      // Auto-revert "joined" → "online" after 3s
      if (data.activity === "joined") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setActivity("online"), 3000);
      }
    };

    socket.on(PARTNER_ACTIVITY, handleActivity);

    return () => {
      socket.off(PARTNER_ACTIVITY, handleActivity);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [disagreementId, currentUserId]);

  const display = ACTIVITY_DISPLAY[activity];

  return (
    <div
      className={`${styles.bar} ${
        activity === "offline" ? styles.barOffline :
        activity === "joined" ? styles.barJoined :
        display.animate ? styles.barActive : ""
      }`}
    >
      <span className={`${styles.icon} ${display.animate ? styles.iconPulse : ""}`}>
        {display.icon}
      </span>
      <span className={styles.label}>{display.label}</span>
    </div>
  );
}
