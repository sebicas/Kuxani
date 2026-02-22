/**
 * Database Flush Script
 *
 * Drops all tables and re-runs migrations to start with a clean database.
 * ⚠️  NEVER runs in production — will abort immediately if NODE_ENV === "production".
 *
 * Usage:
 *   npx tsx scripts/flush-db.ts          # uses DATABASE_URL from .env
 *   npx tsx scripts/flush-db.ts --force  # skip interactive confirmation
 */

import "dotenv/config";
import postgres from "postgres";

// ────────────────────────────────────────────────────────────────────────────
// 1. Production guard — hard block, no flags can override this
// ────────────────────────────────────────────────────────────────────────────
const env = process.env.NODE_ENV?.toLowerCase() ?? "";

if (env === "production") {
  console.error("\n🚫  ABORT: flush-db is DISABLED in production.\n");
  console.error("   NODE_ENV is set to \"production\".");
  console.error("   This script will NEVER execute against a production database.\n");
  process.exit(1);
}

// Extra safety: also refuse if the DATABASE_URL looks like a known production host
const dbUrl = process.env.DATABASE_URL ?? "";

if (!dbUrl) {
  console.error("❌  DATABASE_URL is not set. Aborting.\n");
  process.exit(1);
}

const PRODUCTION_PATTERNS = [
  "kuxani.com",
  "neon.tech",
  "supabase.co",
  "rds.amazonaws.com",
  "cloud.google.com",
  "azure.com",
];

const lowerUrl = dbUrl.toLowerCase();
for (const pattern of PRODUCTION_PATTERNS) {
  if (lowerUrl.includes(pattern)) {
    console.error(`\n🚫  ABORT: DATABASE_URL contains "${pattern}".`);
    console.error("   This looks like a production/cloud database. Refusing to flush.\n");
    process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Interactive confirmation (unless --force is passed)
// ────────────────────────────────────────────────────────────────────────────
const force = process.argv.includes("--force");

if (!force) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      `\n⚠️  This will DROP ALL TABLES in the database.\n` +
        `   NODE_ENV  = "${env || "(not set)"}"\n` +
        `   DATABASE  = ${dbUrl.replace(/\/\/.*@/, "//***@")}\n\n` +
        `   Type "yes" to continue: `,
      resolve,
    );
  });

  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("\n❌  Cancelled.\n");
    process.exit(0);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Flush the database
// ────────────────────────────────────────────────────────────────────────────
console.log("\n🗑️   Flushing database…\n");

const sql = postgres(dbUrl, { max: 1 });

try {
  // Terminate other connections to avoid locks
  await sql`
    SELECT pg_terminate_backend(pid)
    FROM   pg_stat_activity
    WHERE  datname = current_database()
      AND  pid <> pg_backend_pid()
  `;

  // Drop all objects in the public schema
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO PUBLIC`;

  console.log("✅  All tables dropped.\n");

  // Re-run Drizzle migrations
  console.log("📦  Running Drizzle migrations…\n");

  const { execSync } = await import("node:child_process");
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: env || "development" },
  });

  console.log("\n✅  Database flushed and migrations applied successfully.\n");
} catch (error) {
  console.error("\n❌  Failed to flush database:\n", error);
  process.exit(1);
} finally {
  await sql.end();
}
