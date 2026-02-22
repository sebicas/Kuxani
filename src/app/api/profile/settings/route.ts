/**
 * GET   /api/profile/settings — returns user settings from profileData
 * PATCH /api/profile/settings — updates settings fields (voicePreference, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const VALID_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "marin", "nova", "onyx", "sage", "shimmer", "verse",
] as const;

export type VoicePreference = (typeof VALID_VOICES)[number];

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id));

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    voicePreference: userData.profileData?.voicePreference ?? "sage",
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { voicePreference } = body;

  // Validate voice preference
  if (voicePreference !== undefined) {
    if (!VALID_VOICES.includes(voicePreference)) {
      return NextResponse.json(
        { error: `Invalid voice. Must be one of: ${VALID_VOICES.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Get existing user to merge profileData
  const [existing] = await db.select().from(user).where(eq(user.id, userId));
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentProfile = existing.profileData ?? {};
  const updatedProfile = {
    ...currentProfile,
    ...(voicePreference !== undefined ? { voicePreference } : {}),
  };

  await db
    .update(user)
    .set({ profileData: updatedProfile })
    .where(eq(user.id, userId));

  return NextResponse.json({ success: true });
}
