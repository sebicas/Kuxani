/**
 * NotificationProvider — Real-Time Toast Notifications
 *
 * Mounted once in the dashboard layout. Connects to Socket.IO and
 * listens for partner events, showing floating toast notifications.
 *
 * Usage:
 *   <NotificationProvider coupleId={...} currentUserId={...}>
 *     {children}
 *   </NotificationProvider>
 */
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import {
  GRATITUDE_UPDATED,
  MOOD_UPDATED,
  LOVE_LANGUAGE_UPDATED,
  CHALLENGE_UPDATED,
} from "@/lib/socket/events";
import styles from "./notifications.module.css";

interface Notification {
  id: string;
  message: string;
  emoji: string;
  timestamp: number;
}

interface NotificationContextValue {
  /** Manually push a notification */
  notify: (message: string, emoji?: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notify: () => {},
});

export function useNotification() {
  return useContext(NotificationContext);
}

const EVENT_CONFIG: Record<string, { message: string; emoji: string }> = {
  [GRATITUDE_UPDATED]: { message: "Your partner shared a gratitude entry 💌", emoji: "✨" },
  [MOOD_UPDATED]: { message: "Your partner shared a mood check-in", emoji: "🫶" },
  [LOVE_LANGUAGE_UPDATED]: { message: "Your partner completed the Love Languages quiz!", emoji: "💕" },
  [CHALLENGE_UPDATED]: { message: "Your partner made progress on a challenge", emoji: "🔮" },
};

const TOAST_DURATION = 5000;

export function NotificationProvider({
  coupleId,
  currentUserId,
  children,
}: {
  coupleId: string | null | undefined;
  currentUserId: string | null | undefined;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message: string, emoji = "🔔") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const notification: Notification = { id, message, emoji, timestamp: Date.now() };
      setNotifications((prev) => [...prev.slice(-4), notification]); // max 5

      const timer = setTimeout(() => removeNotification(id), TOAST_DURATION);
      timersRef.current.set(id, timer);
    },
    [removeNotification]
  );

  useEffect(() => {
    if (!coupleId) return;

    const socket = getSocket();

    const handlers: Array<{ event: string; handler: (data: { userId?: string }) => void }> = [];

    for (const [event, config] of Object.entries(EVENT_CONFIG)) {
      const handler = (data: { userId?: string }) => {
        // Skip own events
        if (data.userId && data.userId === currentUserId) return;
        notify(config.message, config.emoji);
      };
      socket.on(event, handler);
      handlers.push({ event, handler });
    }

    // Named handler so we only remove our own listener on cleanup
    const handleConnect = () => {
      socket.emit("join-couple", coupleId);
    };

    socket.on("connect", handleConnect);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("join-couple", coupleId);
    }

    return () => {
      for (const { event, handler } of handlers) {
        socket.off(event, handler);
      }
      socket.off("connect", handleConnect);
      // Do NOT disconnect — the socket is a shared singleton
    };
  }, [coupleId, currentUserId, notify]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}

      {/* Toast Container */}
      {notifications.length > 0 && (
        <div className={styles.toastContainer}>
          {notifications.map((n) => (
            <div key={n.id} className={styles.toast}>
              <span className={styles.toastEmoji}>{n.emoji}</span>
              <span className={styles.toastMessage}>{n.message}</span>
              <button
                className={styles.toastClose}
                onClick={() => removeNotification(n.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}
