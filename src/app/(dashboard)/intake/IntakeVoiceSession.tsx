/**
 * IntakeVoiceSession — WebRTC Voice Intake Interview
 *
 * Connects to OpenAI's Realtime API via WebRTC for a live voice
 * intake interview. Mirrors the VoiceSession component from
 * personal/[chatId]/VoiceSession.tsx.
 *
 * After the voice session ends, the transcript is sent to
 * /api/intake/chat for structured data extraction.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./intake.module.css";

interface IntakeVoiceSessionProps {
  onComplete: () => void;
  onDisconnect: () => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

export default function IntakeVoiceSession({
  onComplete,
  onDisconnect,
}: IntakeVoiceSessionProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [extracting, setExtracting] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptsRef = useRef<typeof transcripts>([]);

  // Keep ref in sync for cleanup callback
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Connect to realtime session
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // 1. Get ephemeral session key
        const sessionRes = await fetch(
          `/api/realtime/session?module=intake&id=1`,
          { method: "POST" }
        );

        if (!sessionRes.ok) {
          const errData = await sessionRes
            .json()
            .catch(() => ({ error: "Session creation failed" }));
          throw new Error(errData.error || "Failed to create session");
        }

        const { client_secret, model } = await sessionRes.json();
        if (cancelled) return;

        // 2. Get microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // 3. Create peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 4. Remote audio playback
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audioRef.current = audio;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        // 5. Add mic track
        pc.addTrack(stream.getTracks()[0]);

        // 6. Data channel for events
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.addEventListener("open", () => {
          if (!cancelled) setStatus("connected");
        });

        dc.addEventListener("message", (e) => {
          try {
            const event = JSON.parse(e.data);
            handleRealtimeEvent(event);
          } catch {
            // Ignore non-JSON
          }
        });

        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
          ) {
            if (!cancelled) {
              setStatus("disconnected");
              setError("Connection lost");
            }
          }
        };

        // 7. SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 8. Send to OpenAI
        const sdpRes = await fetch(`${OPENAI_REALTIME_URL}?model=${model}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpRes.ok) {
          throw new Error("Failed to establish WebRTC connection");
        }

        if (cancelled) return;

        const sdpAnswer = await sdpRes.text();
        if (pc.signalingState !== "closed") {
          await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });
        }
      } catch (err) {
        console.error("[IntakeVoice] Connection error:", err);
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to connect");
        }
      }
    }

    function handleRealtimeEvent(event: Record<string, unknown>) {
      switch (event.type) {
        case "response.audio_transcript.done": {
          const transcript = (event as { transcript?: string }).transcript;
          if (transcript) {
            setTranscripts((prev) => [
              ...prev,
              { role: "assistant", content: transcript },
            ]);
            setIsAISpeaking(false);
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const transcript = (event as { transcript?: string }).transcript;
          if (transcript) {
            setTranscripts((prev) => [
              ...prev,
              { role: "user", content: transcript },
            ]);
          }
          break;
        }

        case "response.audio.delta": {
          setIsAISpeaking(true);
          break;
        }

        case "response.done": {
          setIsAISpeaking(false);
          break;
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      dcRef.current?.close();
      pcRef.current?.close();
      audioRef.current?.remove();
    };
  }, []);

  /**
   * On disconnect, extract structured data from the conversation
   * by sending the full transcript through the chat API.
   */
  const handleDisconnect = useCallback(async () => {
    // Stop WebRTC
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    audioRef.current?.remove();
    setStatus("disconnected");

    const currentTranscripts = transcriptsRef.current;

    if (currentTranscripts.length > 0) {
      setExtracting(true);

      // Build a summary of the conversation for extraction
      const conversationSummary = currentTranscripts
        .map(
          (t) =>
            `${t.role === "user" ? "Client" : "Therapist"}: ${t.content}`
        )
        .join("\n\n");

      try {
        // Send to the chat API for extraction
        const extractionMessage = `[VOICE TRANSCRIPT - Please extract all intake data from this conversation]\n\n${conversationSummary}\n\n[END TRANSCRIPT - Output intake_data blocks for all information gathered]`;

        const res = await fetch("/api/intake/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: extractionMessage,
            history: [],
          }),
        });

        if (res.ok) {
          // Read through the stream to trigger extraction
          const reader = res.body?.getReader();
          if (reader) {
            let isComplete = false;
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.complete) isComplete = true;
                  } catch {
                    /* skip */
                  }
                }
              }
            }
            if (isComplete) {
              setTimeout(() => onComplete(), 1000);
              return;
            }
          }
        }
      } catch (err) {
        console.error("[IntakeVoice] Extraction error:", err);
      } finally {
        setExtracting(false);
      }
    }

    onDisconnect();
  }, [onComplete, onDisconnect]);

  return (
    <div className={styles.voiceContainer}>
      {/* Status bar */}
      <div className={styles.voiceStatusBar}>
        <div
          className={`${styles.voiceStatusDot} ${
            status === "connected"
              ? styles.voiceStatusConnected
              : status === "connecting"
              ? styles.voiceStatusConnecting
              : styles.voiceStatusDisconnected
          }`}
        />
        <span className={styles.voiceStatusText}>
          {status === "connecting" && "Connecting..."}
          {status === "connected" &&
            (isAISpeaking ? "Kuxani is speaking..." : "Listening...")}
          {status === "disconnected" && "Disconnected"}
          {status === "error" && (error || "Connection error")}
        </span>
      </div>

      {/* Waveform */}
      <div className={styles.voiceWaveContainer}>
        <div
          className={`${styles.voiceWave} ${
            isAISpeaking ? styles.voiceWaveActive : ""
          } ${
            status === "connected" && !isAISpeaking
              ? styles.voiceWaveListening
              : ""
          }`}
        >
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className={styles.voiceWaveBar}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        <span className={styles.voiceWaveLabel}>
          {isAISpeaking ? "🗣️ Kuxani" : "🎙️ You"}
        </span>
      </div>

      {/* Live transcript preview */}
      {transcripts.length > 0 && (
        <div className={styles.voiceTranscript}>
          <div className={styles.voiceTranscriptHeader}>
            Live Transcript ({transcripts.length} messages)
          </div>
          <div className={styles.voiceTranscriptBody}>
            {transcripts.slice(-3).map((t, i) => (
              <div
                key={i}
                className={`${styles.voiceTranscriptLine} ${
                  t.role === "user"
                    ? styles.voiceTranscriptUser
                    : styles.voiceTranscriptAi
                }`}
              >
                <span className={styles.voiceTranscriptRole}>
                  {t.role === "user" ? "You" : "Kuxani"}:
                </span>{" "}
                {t.content.slice(0, 120)}
                {t.content.length > 120 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracting indicator */}
      {extracting && (
        <div className={styles.voiceExtracting}>
          <div className="spinner" style={{ width: 18, height: 18 }} />
          <span>Processing your answers...</span>
        </div>
      )}

      {/* Disconnect button */}
      <button
        className={styles.voiceDisconnect}
        onClick={handleDisconnect}
        disabled={status === "disconnected" || extracting}
      >
        {status === "connecting"
          ? "Cancel"
          : extracting
          ? "Processing..."
          : "End Voice Session"}
      </button>
    </div>
  );
}
