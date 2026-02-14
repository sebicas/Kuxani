/**
 * Server-side session helper
 *
 * Extracts the authenticated user from Next.js request headers
 * using Better Auth's server API. Used by all protected API routes.
 */
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getServerSession() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
}

/**
 * Helper that throws a 401 Response if not authenticated.
 * Use in API routes: const session = await requireSession();
 */
export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
