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
import { createServer, IncomingMessage } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "./src/lib/socket/socketServer";
import { db } from "./src/lib/db";
import { coupleMembers } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./src/lib/auth";

const dev = process.env.NODE_ENV !== "production";
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

/* ── IP Allowlist for Development Servers ── */
const devAllowedIps =
  appEnv === "development" && process.env.DEV_ALLOWED_IPS
    ? process.env.DEV_ALLOWED_IPS.split(",")
        .map((ip) => ip.trim())
        .filter(Boolean)
    : null;
const productionUrl = process.env.PRODUCTION_URL || "https://kuxani.com";

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(",")[0];
    return first.trim();
  }
  return req.socket.remoteAddress || "";
}

function isIpAllowed(ip: string): boolean {
  if (!devAllowedIps) return true; // no restriction
  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:192.168.1.1 → 192.168.1.1)
  const normalized = ip.replace(/^::ffff:/, "");
  // Always allow localhost
  if (["127.0.0.1", "::1", "localhost"].includes(normalized)) return true;
  return devAllowedIps.some(
    (allowed) => allowed === ip || allowed === normalized
  );
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  if (devAllowedIps) {
    console.log(
      `[ip-guard] DEV mode — allowed IPs: ${devAllowedIps.join(", ")}`
    );
    console.log(
      `[ip-guard] Unauthorized requests redirect to ${productionUrl}`
    );
  }

  const httpServer = createServer((req, res) => {
    // IP allowlist check for development servers
    if (devAllowedIps && req.url && !req.url.startsWith("/api/health")) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp)) {
        console.log(
          `[ip-guard] Blocked ${clientIp} → redirecting to ${productionUrl}`
        );
        res.writeHead(302, { Location: productionUrl });
        res.end();
        return;
      }
    }
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
  const engineUpgradeHandler = listeners[listeners.length - 1] as (
    ...args: unknown[]
  ) => void;
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
      (engineUpgradeHandler as (...args: unknown[]) => void).call(
        httpServer,
        req,
        socket,
        head
      );
    } else {
      // Route to Next.js (HMR at /_next/webpack-hmr, etc.)
      nextUpgradeHandler(req, socket, head);
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (${appEnv})`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
