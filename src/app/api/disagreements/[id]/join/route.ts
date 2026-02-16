/**
 * Disagreement Join API — Partner accepts/declines invitation
 *
 * POST /api/disagreements/[id]/join — Accept or decline
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementInvitations,
  disagreementMessages,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import {
  DISAGREEMENT_PARTNER_ONBOARD_PROMPT,
  buildSystemPrompt,
} from "@/lib/ai/prompts";
import { loadCoupleContext } from "@/lib/ai/context";
import {
  DISAGREEMENT_INVITE_RESPONSE,
  DISAGREEMENT_STATUS,
} from "@/lib/socket/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "accept" or "decline"

  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be 'accept' or 'decline'" },
      { status: 400 }
    );
  }

  // Find the invitation for this user
  const [invite] = await db
    .select()
    .from(disagreementInvitations)
    .where(
      and(
        eq(disagreementInvitations.disagreementId, id),
        eq(disagreementInvitations.invitedUserId, session.user.id),
        eq(disagreementInvitations.status, "pending")
      )
    );

  if (!invite) {
    return NextResponse.json(
      { error: "No pending invitation found" },
      { status: 404 }
    );
  }

  const [disagreement] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, id));

  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update invitation status
  await db
    .update(disagreementInvitations)
    .set({
      status: action === "accept" ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(eq(disagreementInvitations.id, invite.id));

  if (action === "decline") {
    // System message to creator
    await db.insert(disagreementMessages).values({
      disagreementId: id,
      senderId: null,
      senderType: "system",
      content:
        "Your partner has declined the invitation. You can continue exploring this on your own, or try inviting again later.",
      visibleTo: "creator_only",
    });

    // Emit events
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      getIO()
        .to(`couple:${disagreement.coupleId}`)
        .emit(DISAGREEMENT_INVITE_RESPONSE, {
          disagreementId: id,
          action: "declined",
          userId: session.user.id,
        });
    } catch {
      /* socket not available in test */
    }

    return NextResponse.json({ status: "declined" });
  }

  // ── Accept flow ──

  // Update disagreement status
  await db
    .update(disagreements)
    .set({ status: "partner_joined" })
    .where(eq(disagreements.id, id));

  // Get partner's name
  const [partnerUser] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  // System message visible to both
  await db.insert(disagreementMessages).values({
    disagreementId: id,
    senderId: null,
    senderType: "system",
    content: `${partnerUser?.name || "Your partner"} has joined the conversation.`,
    metadata: { event: "partner_joined", userId: session.user.id },
    visibleTo: "all",
  });

  // Generate AI onboarding message for partner
  const ctx = disagreement.coupleId
    ? await loadCoupleContext(disagreement.coupleId)
    : {};

  const systemPrompt = buildSystemPrompt({
    basePrompt: DISAGREEMENT_PARTNER_ONBOARD_PROMPT,
    ...ctx,
  });

  const contextMsg = `The creator's perspective on this disagreement (category: ${disagreement.category}):
${disagreement.creatorPerspective || disagreement.aiSummary || "Not yet summarized"}.

The partner "${partnerUser?.name || "Partner"}" has just accepted the invitation.`;

  const completion = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextMsg },
    ],
  });

  const onboardMsg =
    completion.choices[0]?.message?.content ||
    "Welcome! I'd love to hear your perspective on this.";

  await db.insert(disagreementMessages).values({
    disagreementId: id,
    senderId: null,
    senderType: "ai",
    content: onboardMsg,
    visibleTo: "all",
  });

  // Emit real-time events
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const io = getIO();

    io.to(`couple:${disagreement.coupleId}`).emit(
      DISAGREEMENT_INVITE_RESPONSE,
      {
        disagreementId: id,
        action: "accepted",
        userId: session.user.id,
      }
    );

    io.to(`couple:${disagreement.coupleId}`).emit(DISAGREEMENT_STATUS, {
      disagreementId: id,
      status: "partner_joined",
      action: "partner-joined",
      userId: session.user.id,
    });
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json({
    status: "accepted",
    disagreementStatus: "partner_joined",
  });
}
