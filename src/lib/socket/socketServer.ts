/**
 * Socket.IO Server Utilities
 *
 * Provides a global Socket.IO instance that can be accessed from Next.js API routes
 * to emit real-time events (e.g., partner-joined, gratitude-updated).
 *
 * IMPORTANT: We store the IO instance on `globalThis` rather than a module-local
 * variable because Next.js bundles API routes separately from server.ts.
 * A module-local `let io` would be a different variable in the API route
 * context vs the custom server context, making getIO() always return null
 * in API routes.
 */
import { Server as SocketIOServer } from "socket.io";

/* ── Global IO instance (persisted across module boundaries) ── */
declare global {
  var __socketIO: SocketIOServer | undefined;
}

/** Store the Socket.IO server instance (called from server.ts) */
export function setIO(server: SocketIOServer) {
  globalThis.__socketIO = server;
  console.log("[socketServer] setIO() called — instance stored on globalThis");
}

/** Retrieve the Socket.IO server instance (called from API routes) */
export function getIO(): SocketIOServer {
  if (!globalThis.__socketIO) {
    throw new Error(
      "Socket.IO has not been initialized. Ensure server.ts calls setIO()."
    );
  }
  return globalThis.__socketIO;
}
