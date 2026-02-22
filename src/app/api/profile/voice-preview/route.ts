/**
 * POST /api/profile/voice-preview — Generate a TTS audio preview
 *
 * Accepts { voice, name } and returns an audio/mpeg stream
 * with a random greeting in the specified voice.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ALLOWED_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "marin", "nova", "onyx", "sage", "shimmer", "verse",
];

const GREETINGS = [
  (name: string, voice: string) =>
    `Hi ${name}! I'm ${voice}. My tone is warm and welcoming, and I'm here whenever you need me.`,
  (name: string, voice: string) =>
    `Hello ${name}, this is ${voice}. I have a calm and soothing presence, perfect for our conversations together.`,
  (name: string, voice: string) =>
    `Hey there, ${name}! I'm ${voice}. Think of me as your thoughtful companion, always ready to listen.`,
  (name: string, voice: string) =>
    `Welcome, ${name}. I'm ${voice}, and my voice is gentle and reassuring. I look forward to our sessions.`,
  (name: string, voice: string) =>
    `Hi ${name}! This is ${voice} speaking. I bring a soft, empathetic energy to every conversation.`,
  (name: string, voice: string) =>
    `Hello there, ${name}. I'm ${voice}. I'll be right here with you, with a voice that feels like a warm hug.`,
  (name: string, voice: string) =>
    `Hey ${name}, it's ${voice}! I have a friendly and playful spirit. Let's make our time together meaningful.`,
  (name: string, voice: string) =>
    `Good to meet you, ${name}. I'm ${voice}. My voice is steady and clear, designed to put you at ease.`,
];

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const { voice, name, text: customText } = await request.json();

    if (!voice || !ALLOWED_VOICES.includes(voice)) {
      return NextResponse.json(
        { error: "Invalid voice" },
        { status: 400 }
      );
    }

    // If custom text is provided, speak it directly (for reading last AI message)
    // Otherwise, generate a random greeting for voice preview
    let text: string;
    if (customText) {
      text = customText;
    } else {
      const fullName = name || session.user.name || "there";
      const firstName = fullName.split(" ")[0];
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      text = greeting(firstName, voice);
    }

    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("[voice-preview] OpenAI TTS error:", ttsRes.status, errText);
      return NextResponse.json(
        { error: "Failed to generate voice preview" },
        { status: 502 }
      );
    }

    // Stream the audio back
    const audioBuffer = await ttsRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[voice-preview] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
