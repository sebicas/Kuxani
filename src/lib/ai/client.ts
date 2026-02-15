import OpenAI from "openai";

let _openai: OpenAI | null = null;

/** Lazy-initialized OpenAI client (avoids constructor at import time during build) */
export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * @deprecated Use getOpenAI() instead — kept for backward compatibility.
 * This is a proxy that lazily initializes the OpenAI client on first use.
 */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return Reflect.get(getOpenAI(), prop);
  },
});

/** Primary reasoning model for therapeutic analysis */
export const REASONING_MODEL = "gpt-4.1";

/** Lightweight model for summaries and pattern detection */
export const LIGHT_MODEL = "gpt-4.1-mini";

/** Voice transcription model */
export const TRANSCRIBE_MODEL = "gpt-4o-transcribe";

/** Text-to-speech model */
export const TTS_MODEL = "gpt-4o-mini-tts";

