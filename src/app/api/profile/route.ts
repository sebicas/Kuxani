/**
 * GET  /api/profile — returns current user info + partner info
 * PATCH /api/profile — updates name, phone, description
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, } from "@/lib/db/schema/auth";
import { coupleMembers, couples } from "@/lib/db/schema/couples";
import { eq, and, ne } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user data
  const [userData] = await db.select().from(user).where(eq(user.id, userId));
  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get partner info if coupled
  let partner = null;
  const [membership] = await db
    .select()
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId));

  if (membership) {
    const [couple] = await db
      .select()
      .from(couples)
      .where(eq(couples.id, membership.coupleId));

    const [partnerMember] = await db
      .select()
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, membership.coupleId),
          ne(coupleMembers.userId, userId)
        )
      );

    if (partnerMember) {
      const [partnerUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, partnerMember.userId));

      if (partnerUser) {
        partner = {
          id: partnerUser.id,
          name: partnerUser.name,
          email: partnerUser.email,
          image: partnerUser.image,
          phone: partnerUser.profileData?.phone ?? null,
          description: partnerUser.profileData?.description ?? null,
          coupleStatus: couple?.status ?? "active",
          coupleName: couple?.name ?? null,
        };
      }
    }
  }

  return NextResponse.json({
    id: userData.id,
    name: userData.name,
    email: userData.email,
    image: userData.image,
    phone: userData.profileData?.phone ?? null,
    description: userData.profileData?.description ?? null,
    partner,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { name, phone, description } = body;

  // Get existing user data to merge profileData
  const [existing] = await db.select().from(user).where(eq(user.id, userId));
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  // phone and description go into profileData JSONB
  if (phone !== undefined || description !== undefined) {
    const currentProfile = existing.profileData ?? {};
    updates.profileData = {
      ...currentProfile,
      ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db.update(user).set(updates).where(eq(user.id, userId));

  return NextResponse.json({ success: true });
}
