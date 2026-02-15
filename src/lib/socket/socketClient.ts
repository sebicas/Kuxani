/**
 * Socket.IO Client Singleton
 *
 * Provides a shared Socket.IO client instance for use in React hooks.
 * Connects to the same origin (no separate URL needed).
 */
"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Get or create the shared Socket.IO client */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // No URL = connects to same origin (works in both dev & prod)
      autoConnect: false,
      // Send cookies for session auth
      withCredentials: true,
    });
  }
  return socket;
}
