/**
 * Health Check API — Docker Container Liveness
 *
 * GET /api/health — Returns JSON health status (unauthenticated)
 *
 * Checks:
 *   - Database connectivity (SELECT 1)
 *   - Socket.IO server status
 *   - Process memory usage
 *   - Environment & version info
 *
 * Returns 200 when healthy, 503 when unhealthy.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";

export const dynamic = "force-dynamic";

// Read version & commit SHA once at module load
const APP_VERSION = process.env.npm_package_version || "0.1.0";

let COMMIT_SHA = "unknown";
try {
  COMMIT_SHA = readFileSync(".commit_sha", "utf-8").trim().slice(0, 7);
} catch {
  // File not present in dev — ignore
}
const startTime = Date.now();

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // ── Database Check ──
  try {
    const dbStart = performance.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Math.round(performance.now() - dbStart);
    checks.database = { status: "ok", latency_ms: dbLatency };
  } catch (err) {
    healthy = false;
    checks.database = {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // ── Socket.IO Check ──
  try {
    const io = globalThis.__socketIO;
    if (io) {
      const sockets = await io.fetchSockets();
      checks.socketio = { status: "ok", connections: sockets.length };
    } else {
      checks.socketio = { status: "ok", connections: 0, note: "not_initialized" };
    }
  } catch {
    checks.socketio = { status: "error", message: "Failed to query Socket.IO" };
  }

  // ── Memory Usage ──
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  const response = {
    status: healthy ? "healthy" : "unhealthy",
    version: APP_VERSION,
    last_commit: COMMIT_SHA,
    environment: process.env.APP_ENV || process.env.NODE_ENV || "unknown",
    uptime: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
    memory: {
      rss_mb: toMB(mem.rss),
      heap_used_mb: toMB(mem.heapUsed),
      heap_total_mb: toMB(mem.heapTotal),
    },
  };

  return NextResponse.json(response, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
