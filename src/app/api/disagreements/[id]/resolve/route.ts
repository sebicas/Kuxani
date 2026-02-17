/**
 * Disagreement Resolve API — Mark resolved + extract commitments
 *
 * POST /api/disagreements/[id]/resolve — Trigger resolution
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disagreements,
  disagreementMessages,
  coupleMembers,
  requests,
  compromises,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, asc } from "drizzle-orm";
import { openai, REASONING_MODEL } from "@/lib/ai/client";
import { DISAGREEMENT_GENERATE_COMMITMENTS_PROMPT } from "@/lib/ai/prompts";
import {
  DISAGREEMENT_STATUS,
  REQUEST_CREATED,
  COMPROMISE_CREATED,
} from "@/lib/socket/events";
import { isValidUUID } from "@/lib/utils/uuid";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [disagreement] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, id));

  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!disagreement.coupleId) {
    return NextResponse.json(
      { error: "Cannot resolve without a couple" },
      { status: 400 }
    );
  }

  // Verify membership
  const [member] = await db
    .select()
    .from(coupleMembers)
    .where(
      and(
        eq(coupleMembers.coupleId, disagreement.coupleId),
        eq(coupleMembers.userId, session.user.id)
      )
    );

  if (!member) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Get the full conversation to extract commitments
  const messages = await db
    .select({
      senderType: disagreementMessages.senderType,
      content: disagreementMessages.content,
      senderName: user.name,
    })
    .from(disagreementMessages)
    .leftJoin(user, eq(user.id, disagreementMessages.senderId))
    .where(eq(disagreementMessages.disagreementId, id))
    .orderBy(asc(disagreementMessages.createdAt));

  const conversationText = messages
    .map((m) => {
      const sender =
        m.senderType === "ai"
          ? "AI Therapist"
          : m.senderType === "system"
            ? "System"
            : m.senderName || "User";
      return `[${sender}]: ${m.content}`;
    })
    .join("\n\n");

  // Get both partner IDs
  const members = await db
    .select({ userId: coupleMembers.userId })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, disagreement.coupleId));

  const partnerId = members.find(
    (m) => m.userId !== disagreement.userId
  )?.userId;

  // Ask AI to extract commitments
  const body = await request.json().catch(() => ({}));
  const resolutionNotes = body.resolutionNotes || "";

  const completion = await openai.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: DISAGREEMENT_GENERATE_COMMITMENTS_PROMPT },
      {
        role: "user",
        content: `## Disagreement: "${disagreement.title}" (${disagreement.category})

### Full Conversation:
${conversationText}

${resolutionNotes ? `### Additional Resolution Notes:\n${resolutionNotes}` : ""}

Please extract the requests and compromises.`,
      },
    ],
  });

  const aiResponse = completion.choices[0]?.message?.content || "{}";

  // Parse AI response
  let extracted: {
    requests?: Array<{
      title: string;
      description?: string;
      requestedBy: "creator" | "partner";
      category?: string;
      priority?: string;
    }>;
    compromises?: Array<{
      title: string;
      description?: string;
      partnerACommitment: string;
      partnerBCommitment: string;
      checkInFrequency?: string;
    }>;
  } = {};

  try {
    // Strip markdown code fences if present
    const jsonStr = aiResponse.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    extracted = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse AI commitments:", aiResponse);
    extracted = { requests: [], compromises: [] };
  }

  // Save requests
  const createdRequests = [];
  for (const req of extracted.requests || []) {
    const requestedBy =
      req.requestedBy === "partner" && partnerId
        ? partnerId
        : disagreement.userId;
    const requestedOf =
      requestedBy === disagreement.userId && partnerId
        ? partnerId
        : disagreement.userId;

    const [saved] = await db
      .insert(requests)
      .values({
        coupleId: disagreement.coupleId!,
        requestedBy,
        requestedOf,
        sourceType: "disagreement",
        sourceId: disagreement.id,
        title: req.title,
        description: req.description || null,
        category: (req.category as "behavior" | "communication" | "emotional" | "practical" | "boundary" | "other") || "other",
        priority: (req.priority as "low" | "medium" | "high") || "medium",
        status: "proposed",
      })
      .returning();

    createdRequests.push(saved);
  }

  // Save compromises
  const createdCompromises = [];
  for (const comp of extracted.compromises || []) {
    const [saved] = await db
      .insert(compromises)
      .values({
        coupleId: disagreement.coupleId!,
        sourceType: "disagreement",
        sourceId: disagreement.id,
        proposedBy: session.user.id,
        title: comp.title,
        description: comp.description || null,
        partnerACommitment: comp.partnerACommitment,
        partnerBCommitment: comp.partnerBCommitment,
        checkInFrequency:
          (comp.checkInFrequency as "daily" | "weekly" | "biweekly" | "monthly" | "none") || "none",
        status: "proposed",
      })
      .returning();

    createdCompromises.push(saved);
  }

  // Mark disagreement as resolved
  await db
    .update(disagreements)
    .set({
      status: "resolved",
      resolutionNotes: resolutionNotes || null,
      resolvedAt: new Date(),
    })
    .where(eq(disagreements.id, id));

  // Add system message
  const commitmentSummary = [
    createdRequests.length > 0
      ? `${createdRequests.length} request(s) created`
      : "",
    createdCompromises.length > 0
      ? `${createdCompromises.length} compromise(s) created`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");

  await db.insert(disagreementMessages).values({
    disagreementId: id,
    senderId: null,
    senderType: "system",
    content: `This disagreement has been resolved. ${commitmentSummary || "No formal commitments were extracted, but the conversation itself is valuable."}`,
    visibleTo: "all",
  });

  // Emit real-time events
  try {
    const { getIO } = await import("@/lib/socket/socketServer");
    const io = getIO();

    io.to(`couple:${disagreement.coupleId}`).emit(DISAGREEMENT_STATUS, {
      disagreementId: id,
      status: "resolved",
      action: "resolved",
      userId: session.user.id,
    });

    for (const req of createdRequests) {
      io.to(`couple:${disagreement.coupleId}`).emit(REQUEST_CREATED, {
        requestId: req.id,
        sourceType: "disagreement",
        sourceId: id,
      });
    }

    for (const comp of createdCompromises) {
      io.to(`couple:${disagreement.coupleId}`).emit(COMPROMISE_CREATED, {
        compromiseId: comp.id,
        sourceType: "disagreement",
        sourceId: id,
      });
    }
  } catch {
    /* socket not available in test */
  }

  return NextResponse.json({
    status: "resolved",
    requests: createdRequests,
    compromises: createdCompromises,
  });
}
