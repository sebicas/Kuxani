/**
 * Disagreement Invite API — Invite partner to join
 *
 * POST /api/disagreements/[id]/invite — Send invitation to partner
 * GET  /api/disagreements/[id]/invite — Get invitation status
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementInvitations,
  disagreementMessages,
  coupleMembers,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, ne } from "drizzle-orm";
import {
  DISAGREEMENT_INVITE,
  DISAGREEMENT_STATUS,
} from "@/lib/socket/events";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Only creator can invite
  const [disagreement] = await db
    .select()
    .from(disagreements)
    .where(
      and(eq(disagreements.id, id), eq(disagreements.userId, session.user.id))
    );

  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!disagreement.coupleId) {
    return NextResponse.json(
      { error: "Not in a couple" },
      { status: 400 }
    );
  }

  // Find partner
  const [partner] = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, disagreement.coupleId),
        ne(coupleMembers.userId, session.user.id)
      )
    );

  if (!partner) {
    return NextResponse.json(
      { error: "No partner found" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const detailLevel = body.detailLevel === "detailed" ? "detailed" : "summary";

  // Create invitation
  const [invite] = await db
    .insert(disagreementInvitations)
    .values({
      disagreementId: id,
      invitedBy: session.user.id,
      invitedUserId: partner.userId,
      detailLevel,
    })
    .returning();

  // Update disagreement status + visibility
  await db
    .update(disagreements)
    .set({
      status: "invite_sent",
      visibility: "shared",
    })
    .where(eq(disagreements.id, id));

  // Add system message
  await db.insert(disagreementMessages).values({
    disagreementId: id,
    senderId: null,
    senderType: "system",
    content: "Your partner has been invited to this conversation.",
    metadata: { inviteId: invite.id, detailLevel },
    visibleTo: "creator_only",
  });

  // Emit real-time invite notification to partner
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const io = getIO();

    io.to(`couple:${disagreement.coupleId}`).emit(DISAGREEMENT_INVITE, {
      disagreementId: id,
      inviteId: invite.id,
      invitedBy: session.user.id,
      detailLevel,
      title: disagreement.title,
      category: disagreement.category,
    });

    io.to(`couple:${disagreement.coupleId}`).emit(DISAGREEMENT_STATUS, {
      disagreementId: id,
      status: "invite_sent",
      action: "invite-sent",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json(invite, { status: 201 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const invites = await db
    .select()
    .from(disagreementInvitations)
    .where(eq(disagreementInvitations.disagreementId, id));

  return NextResponse.json(invites);
}
