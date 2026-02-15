/**
 * Couples API — Create & Get
 *
 * POST /api/couples — Create a new couple (generates invite code)
 * GET  /api/couples — Get current user's couple + partner info
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { couples, coupleMembers, user } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, ne } from "drizzle-orm";
import { randomBytes } from "crypto";

/** Generate an 8-character alphanumeric invite code */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Check if user is already in a couple */
async function getUserMembership(userId: string) {
  const [member] = await db
    .select({
      id: coupleMembers.id,
      coupleId: coupleMembers.coupleId,
      role: coupleMembers.role,
    })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);

  return member || null;
}

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is already in a couple
  const existing = await getUserMembership(session.user.id);
  if (existing) {
    return NextResponse.json(
      { error: "You are already part of a couple" },
      { status: 409 },
    );
  }

  // Generate a unique invite code (retry on collision)
  let inviteCode: string;
  let attempts = 0;
  do {
    inviteCode = generateInviteCode();
    const [existing] = await db
      .select({ id: couples.id })
      .from(couples)
      .where(eq(couples.inviteCode, inviteCode))
      .limit(1);
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  // Create the couple
  const [couple] = await db
    .insert(couples)
    .values({
      inviteCode,
      status: "pending",
    })
    .returning();

  // Add current user as creator
  await db.insert(coupleMembers).values({
    coupleId: couple.id,
    userId: session.user.id,
    role: "creator",
    colorCode: "#6366f1", // Partner A — indigo
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/invite/${inviteCode}`;

  return NextResponse.json(
    {
      id: couple.id,
      inviteCode: couple.inviteCode,
      inviteLink,
      status: couple.status,
      createdAt: couple.createdAt,
    },
    { status: 201 },
  );
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find user's couple membership
  const membership = await getUserMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ couple: null });
  }

  // Get couple details
  const [couple] = await db
    .select()
    .from(couples)
    .where(eq(couples.id, membership.coupleId))
    .limit(1);

  if (!couple) {
    return NextResponse.json({ couple: null });
  }

  // Get partner info (the other member)
  const [partner] = await db
    .select({
      userId: coupleMembers.userId,
      role: coupleMembers.role,
      name: user.name,
      email: user.email,
    })
    .from(coupleMembers)
    .innerJoin(user, eq(user.id, coupleMembers.userId))
    .where(
      and(
        eq(coupleMembers.coupleId, membership.coupleId),
        ne(coupleMembers.userId, session.user.id),
      ),
    );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/invite/${couple.inviteCode}`;

  return NextResponse.json({
    couple: {
      id: couple.id,
      inviteCode: couple.inviteCode,
      inviteLink,
      status: couple.status,
      createdAt: couple.createdAt,
    },
    role: membership.role,
    partner: partner
      ? {
          name: partner.name,
          email: partner.email,
          role: partner.role,
        }
      : null,
  });
}
