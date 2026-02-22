/**
 * Shared integration test helper.
 *
 * Auto-detects if `npm run dev` is running on port 3000 and reuses it.
 * If no dev server is found, starts a fresh Next.js dev server.
 */
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import next from "next";

let sharedServer: Server | null = null;
let sharedBaseUrl: string | null = null;
let refCount = 0;
let originalStdoutWrite: typeof process.stdout.write;

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the base URL of the test server.
 * First call detects/starts the server; subsequent calls reuse it.
 */
export async function getTestServerUrl(): Promise<string> {
  refCount++;

  if (sharedBaseUrl) return sharedBaseUrl;

  // 1) Check if dev server is already running on port 3000
  const devUrl = "http://localhost:3000";
  if (await isServerRunning(devUrl)) {
    sharedBaseUrl = devUrl;
    return sharedBaseUrl;
  }

  // 2) Start a fresh Next.js server
  originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    if (typeof chunk === "string" && /^\s*(GET|POST|PUT|DELETE|PATCH)\s+\//.test(chunk)) {
      return true;
    }
    return originalStdoutWrite(chunk, ...args);
  }) as typeof process.stdout.write;

  const app = next({ dev: true, dir: process.cwd(), quiet: true });
  const handle = app.getRequestHandler();
  await app.prepare();

  sharedServer = createServer((req, res) => handle(req, res));
  await new Promise<void>((resolve) => {
    sharedServer!.listen(0, () => {
      const addr = sharedServer!.address() as AddressInfo;
      sharedBaseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });

  return sharedBaseUrl;
}

/** Decrement ref count; close server when last suite finishes */
export function releaseTestServer() {
  refCount--;
  if (refCount <= 0 && sharedServer) {
    process.stdout.write = originalStdoutWrite;
    sharedServer.close();
    sharedServer = null;
    sharedBaseUrl = null;
  }
}
