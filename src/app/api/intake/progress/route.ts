/**
 * Intake Progress API — List & Update Phase Progress
 *
 * GET  /api/intake/progress — Returns all 7 phase statuses for current user + partner summary
 * POST /api/intake/progress — Updates a phase status (start, complete)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  intakeProgress,
  coupleMembers,
  user,
} from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { eq, and, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Phase metadata (shared between API & UI) */
const PHASES = [
  { phase: 1, title: "Welcome & Relationship Basics", estimatedMinutes: 3 },
  { phase: 2, title: "What Brought You Here", estimatedMinutes: 3 },
  { phase: 3, title: "Growing Up & Family of Origin", estimatedMinutes: 5 },
  { phase: 4, title: "Attachment & Past Relationships", estimatedMinutes: 3 },
  { phase: 5, title: "Communication & Conflict Patterns", estimatedMinutes: 3 },
  { phase: 6, title: "Life Context & Stressors", estimatedMinutes: 2 },
  { phase: 7, title: "Summary & Confirmation", estimatedMinutes: 2 },
];

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user's progress for all phases
  const userProgress = await db
    .select()
    .from(intakeProgress)
    .where(eq(intakeProgress.userId, userId));

  // Find couple and partner progress
  let partnerProgress: typeof userProgress = [];
  let partnerName: string | null = null;
  let coupleId: string | null = null;

  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);

  if (member) {
    coupleId = member.coupleId;
    const [partner] = await db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, member.coupleId),
          ne(coupleMembers.userId, userId)
        )
      )
      .limit(1);

    if (partner) {
      const [partnerUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, partner.userId))
        .limit(1);
      partnerName = partnerUser?.name || "Partner";

      partnerProgress = await db
        .select()
        .from(intakeProgress)
        .where(eq(intakeProgress.userId, partner.userId));
    }
  }

  // Build full phase listing with status
  const phases = PHASES.map((meta) => {
    const progress = userProgress.find((p) => p.phase === meta.phase);
    const partnerPhase = partnerProgress.find((p) => p.phase === meta.phase);
    return {
      ...meta,
      status: progress?.status || "not_started",
      modalityUsed: progress?.modalityUsed || null,
      startedAt: progress?.startedAt || null,
      completedAt: progress?.completedAt || null,
      partnerStatus: partnerPhase?.status || "not_started",
    };
  });

  const completedCount = phases.filter((p) => p.status === "completed").length;
  const partnerCompletedCount = phases.filter(
    (p) => p.partnerStatus === "completed"
  ).length;

  return NextResponse.json({
    phases,
    completedCount,
    totalPhases: PHASES.length,
    percentComplete: Math.round((completedCount / PHASES.length) * 100),
    partnerName,
    partnerCompletedCount,
    coupleId,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { phase, status, modality } = body;

  if (!phase || phase < 1 || phase > 7) {
    return NextResponse.json(
      { error: "Phase must be between 1 and 7" },
      { status: 400 }
    );
  }

  if (!["in_progress", "completed"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'in_progress' or 'completed'" },
      { status: 400 }
    );
  }

  // Get couple ID
  let coupleId: string | null = null;
  const [member] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  if (member) coupleId = member.coupleId;

  // Upsert progress row
  const existing = await db
    .select()
    .from(intakeProgress)
    .where(
      and(eq(intakeProgress.userId, userId), eq(intakeProgress.phase, phase))
    )
    .limit(1);

  let row;
  if (existing.length > 0) {
    [row] = await db
      .update(intakeProgress)
      .set({
        status,
        modalityUsed: modality || existing[0].modalityUsed,
        startedAt:
          status === "in_progress" && !existing[0].startedAt
            ? new Date()
            : existing[0].startedAt,
        completedAt: status === "completed" ? new Date() : null,
      })
      .where(eq(intakeProgress.id, existing[0].id))
      .returning();
  } else {
    [row] = await db
      .insert(intakeProgress)
      .values({
        userId,
        coupleId,
        phase,
        status,
        modalityUsed: modality || null,
        startedAt: new Date(),
        completedAt: status === "completed" ? new Date() : null,
      })
      .returning();
  }

  // Emit real-time event to partner
  if (coupleId) {
    try {
      const { getIO } = await import("@/lib/socket/socketServer");
      const { INTAKE_UPDATED } = await import("@/lib/socket/events");
      getIO().to(`couple:${coupleId}`).emit(INTAKE_UPDATED, {
        phase,
        status,
        userId,
      });
    } catch {
      /* socket not available in test */
    }
  }

  return NextResponse.json(row);
}
