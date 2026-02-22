/**
 * POST /api/realtime/session — Shared WebRTC session endpoint
 *
 * Creates an ephemeral session via OpenAI's Realtime Sessions API
 * with the correct system prompt, voice, and config for the requested module.
 * Returns the ephemeral client_secret so the browser can connect directly.
 *
 * Query params:
 *   - module: "personal" | "disagreement" | "challenge"
 *   - id: resource ID (chat ID, disagreement ID, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { resolveRealtimeContext, RealtimeModule } from "@/lib/ai/realtime";

export const dynamic = "force-dynamic";

const OPENAI_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions";
const REALTIME_MODEL = "gpt-4o-realtime-preview";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get("module") as RealtimeModule | null;
  const resourceId = searchParams.get("id");

  if (!moduleName || !resourceId) {
    return NextResponse.json(
      { error: "Missing required params: module, id" },
      { status: 400 }
    );
  }

  const validModules: RealtimeModule[] = ["personal", "disagreement", "challenge", "intake"];
  if (!validModules.includes(moduleName)) {
    return NextResponse.json(
      { error: `Invalid module: ${moduleName}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[realtime] OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    // 1. Resolve the system prompt and voice for this module
    const { systemPrompt, voice } = await resolveRealtimeContext(
      moduleName,
      resourceId,
      session.user.id
    );

    // 2. Create an ephemeral session with OpenAI
    const openaiRes = await fetch(OPENAI_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice,
        instructions: systemPrompt,
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
        },
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 1500,
        },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[realtime] OpenAI error:", openaiRes.status, errText);
      return NextResponse.json(
        { error: "Failed to create realtime session" },
        { status: 502 }
      );
    }

    // 3. Return the ephemeral client secret + model to the browser
    const data = await openaiRes.json();
    return NextResponse.json({
      client_secret: data.client_secret.value,
      model: REALTIME_MODEL,
    });
  } catch (err) {
    console.error("[realtime] Session error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
