/**
 * Invite Lookup API (public, no auth required)
 *
 * GET /api/couples/invite?code=XXXX — Validate an invite code and get creator info
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { couples, coupleMembers, user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 },
    );
  }

  // Find the couple by invite code
  const [couple] = await db
    .select({
      id: couples.id,
      status: couples.status,
    })
    .from(couples)
    .where(eq(couples.inviteCode, code.toUpperCase().trim()))
    .limit(1);

  if (!couple) {
    return NextResponse.json(
      { valid: false, error: "Invalid invite code" },
      { status: 404 },
    );
  }

  if (couple.status !== "pending") {
    return NextResponse.json(
      { valid: false, error: "This invite has already been used" },
      { status: 410 },
    );
  }

  // Get the creator's name
  const [creator] = await db
    .select({
      name: user.name,
    })
    .from(coupleMembers)
    .innerJoin(user, eq(user.id, coupleMembers.userId))
    .where(
      and(
        eq(coupleMembers.coupleId, couple.id),
        eq(coupleMembers.role, "creator"),
      ),
    )
    .limit(1);

  // Only expose the first name for privacy
  const firstName = creator?.name?.split(" ")[0] || "Your partner";

  return NextResponse.json({
    valid: true,
    creatorName: firstName,
  });
}
