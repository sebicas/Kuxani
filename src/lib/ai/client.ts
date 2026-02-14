import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Primary reasoning model for therapeutic analysis */
export const REASONING_MODEL = "gpt-4.1";

/** Lightweight model for summaries and pattern detection */
export const LIGHT_MODEL = "gpt-4.1-mini";

/** Voice transcription model */
export const TRANSCRIBE_MODEL = "gpt-4o-transcribe";

/** Text-to-speech model */
export const TTS_MODEL = "gpt-4o-mini-tts";
