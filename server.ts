/**
 * Custom Server — Next.js + Socket.IO on a single HTTP server
 *
 * Used in both development and production:
 *   dev:  NODE_ENV=development tsx server.ts
 *   prod: NODE_ENV=production  node server.js
 *
 * Socket.IO handles WebSocket upgrades on the same port as Next.js.
 */

// Load .env BEFORE any imports that use process.env (db, auth, etc.)
import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "./src/lib/socket/socketServer";
import { db } from "./src/lib/db";
import { coupleMembers } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./src/lib/auth";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  /* ── Socket.IO Setup (noServer mode to avoid upgrade conflicts) ── */
  const io = new SocketIOServer({
    cors: {
      origin: dev
        ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
        : false,
      credentials: true,
    },
    transports: ["websocket", "polling"],
    // Use noServer so we can manually route WebSocket upgrades
    // between Socket.IO and Next.js HMR
  });

  // Attach Socket.IO to the HTTP server for polling transport
  io.attach(httpServer, { path: "/socket.io/" });

  // Remove the automatic upgrade listener added by io.attach()
  // so we can handle upgrades ourselves
  const listeners = httpServer.listeners("upgrade");
  const engineUpgradeHandler = listeners[listeners.length - 1] as (...args: unknown[]) => void;
  httpServer.removeListener("upgrade", engineUpgradeHandler);

  // Store globally so API routes can access via getIO()
  setIO(io);

  io.on("connection", (socket) => {
    console.log(`[socket.io] client connected: ${socket.id}`);

    // Client requests to join their couple room
    socket.on("join-couple", async (coupleId: string) => {
      if (!coupleId || typeof coupleId !== "string") return;

      try {
        // Authenticate the socket using cookies from the handshake
        const cookieHeader = socket.handshake.headers.cookie || "";
        const sessionData = await auth.api.getSession({
          headers: new Headers({ cookie: cookieHeader }),
        });

        if (!sessionData?.user) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Verify the user actually belongs to this couple
        const [membership] = await db
          .select({ id: coupleMembers.id })
          .from(coupleMembers)
          .where(eq(coupleMembers.coupleId, coupleId))
          .limit(1);

        if (!membership) {
          socket.emit("error", { message: "Not a member of this couple" });
          return;
        }

        socket.join(`couple:${coupleId}`);
        console.log(
          `[socket.io] ${socket.id} joined room couple:${coupleId}`
        );
      } catch (err) {
        console.error("[socket.io] join-couple error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[socket.io] client disconnected: ${socket.id}`);
    });
  });

  /* ── Route WebSocket upgrades manually ── */
  const nextUpgradeHandler = app.getUpgradeHandler();
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) {
      // Route to Socket.IO's engine
      (engineUpgradeHandler as (...args: unknown[]) => void).call(httpServer, req, socket, head);
    } else {
      // Route to Next.js (HMR at /_next/webpack-hmr, etc.)
      nextUpgradeHandler(req, socket, head);
    }
  });

  httpServer.listen(port, () => {
    console.log(
      `> Ready on http://${hostname}:${port} (${dev ? "development" : "production"})`
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
