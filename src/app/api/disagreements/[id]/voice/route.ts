/**
 * POST /api/disagreements/[id]/voice — Speech-to-Text
 *
 * Receives audio from the VoiceButton, transcribes it using
 * the OpenAI transcription model, and returns the text.
 *
 * Also emits PARTNER_ACTIVITY events for the speaking state.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disagreements, coupleMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { getOpenAI, TRANSCRIBE_MODEL } from "@/lib/ai/client";
import { getIO } from "@/lib/socket/socketServer";
import { PARTNER_ACTIVITY } from "@/lib/socket/events";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function verifyAccess(disagreementId: string, userId: string) {
  const [d] = await db
    .select()
    .from(disagreements)
    .where(eq(disagreements.id, disagreementId));

  if (!d) return null;
  if (d.userId === userId) return d;

  if (d.coupleId && d.visibility === "shared") {
    const [member] = await db
      .select()
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, d.coupleId),
          eq(coupleMembers.userId, userId)
        )
      );
    if (member) return d;
  }

  return null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const userId = session.user.id;

  const disagreement = await verifyAccess(id, userId);
  if (!disagreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 }
    );
  }

  try {
    // Emit "speaking" activity
    if (disagreement.coupleId && disagreement.visibility === "shared") {
      try {
        getIO()
          .to(`couple:${disagreement.coupleId}`)
          .emit(PARTNER_ACTIVITY, {
            disagreementId: id,
            userId,
            activity: "speaking",
          });
      } catch {
        /* socket not available */
      }
    }

    // Transcribe audio using OpenAI
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: TRANSCRIBE_MODEL,
    });

    // Emit "online" activity (done speaking)
    if (disagreement.coupleId && disagreement.visibility === "shared") {
      try {
        getIO()
          .to(`couple:${disagreement.coupleId}`)
          .emit(PARTNER_ACTIVITY, {
            disagreementId: id,
            userId,
            activity: "online",
          });
      } catch {
        /* socket not available */
      }
    }

    return NextResponse.json({
      transcript: transcription.text,
    });
  } catch (error) {
    console.error("[voice] Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
