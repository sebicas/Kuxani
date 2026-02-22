"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../personal.module.css";

interface VoiceSessionProps {
  chatId: string;
  lastAIMessage?: string;
  onTranscript: (role: "user" | "assistant", content: string) => void;
  onDisconnect: () => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

export default function VoiceSession({
  chatId,
  lastAIMessage,
  onTranscript,
  onDisconnect,
}: VoiceSessionProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Connect to realtime session
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // 1. Get ephemeral session key from our server
        const sessionRes = await fetch(
          `/api/realtime/session?module=personal&id=${chatId}`,
          { method: "POST" }
        );

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({ error: "Session creation failed" }));
          throw new Error(errData.error || "Failed to create session");
        }

        const { client_secret, model } = await sessionRes.json();

        if (cancelled) return;

        // 2. Get microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // 3. Create peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 4. Set up remote audio playback
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audioRef.current = audio;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        // 5. Add mic track
        pc.addTrack(stream.getTracks()[0]);

        // 6. Create data channel for events
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.addEventListener("open", () => {
          if (!cancelled) {
            setStatus("connected");

            // Play the last AI message via TTS (separate from realtime)
            if (lastAIMessage) {
              playLastMessageTTS(lastAIMessage);
            }
          }
        });

        dc.addEventListener("message", (e) => {
          try {
            const event = JSON.parse(e.data);
            handleRealtimeEvent(event);
          } catch {
            // Ignore non-JSON messages
          }
        });

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            if (!cancelled) {
              setStatus("disconnected");
              setError("Connection lost");
            }
          }
        };

        // 7. Create SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 8. Send SDP offer directly to OpenAI with the ephemeral key
        const sdpRes = await fetch(`${OPENAI_REALTIME_URL}?model=${model}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpRes.ok) {
          const errText = await sdpRes.text();
          console.error("[voice] OpenAI SDP error:", errText);
          throw new Error("Failed to establish WebRTC connection");
        }

        const sdpAnswer = await sdpRes.text();
        await pc.setRemoteDescription({
          type: "answer",
          sdp: sdpAnswer,
        });
      } catch (err) {
        console.error("[voice] Connection error:", err);
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
            onTranscript("assistant", transcript);
            setIsAISpeaking(false);
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const transcript = (event as { transcript?: string }).transcript;
          if (transcript) {
            onTranscript("user", transcript);
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
      ttsAudioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Play last AI message via TTS API (separate from realtime session)
  async function playLastMessageTTS(text: string) {
    try {
      setIsAISpeaking(true);

      // Fetch user's voice preference
      let voice = "sage";
      try {
        const settingsRes = await fetch("/api/profile/settings");
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          voice = data.voicePreference || "sage";
        }
      } catch {
        // Use default
      }

      const res = await fetch("/api/profile/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, text }),
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setIsAISpeaking(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsAISpeaking(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
      };

      await audio.play();
    } catch {
      setIsAISpeaking(false);
    }
  }

  // Handle disconnect
  function handleDisconnect() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    audioRef.current?.remove();
    ttsAudioRef.current?.pause();

    setStatus("disconnected");
    onDisconnect();
  }

  return (
    <div className={styles.voiceSession}>
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
          {status === "connected" && (isAISpeaking ? "Kuxani is speaking..." : "Listening...")}
          {status === "disconnected" && "Disconnected"}
          {status === "error" && (error || "Connection error")}
        </span>
      </div>

      {/* Waveform animation */}
      <div className={styles.voiceWaveContainer}>
        <div className={`${styles.voiceWave} ${isAISpeaking ? styles.voiceWaveActive : ""} ${status === "connected" && !isAISpeaking ? styles.voiceWaveListening : ""}`}>
          {[...Array(5)].map((_, i) => (
            <span key={i} className={styles.voiceWaveBar} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <span className={styles.voiceWaveLabel}>
          {isAISpeaking ? "🗣️ Kuxani" : "🎙️ You"}
        </span>
      </div>

      {/* Disconnect button */}
      <button
        className={styles.voiceDisconnect}
        onClick={handleDisconnect}
        disabled={status === "disconnected"}
      >
        {status === "connecting" ? "Cancel" : "End Voice Session"}
      </button>
    </div>
  );
}
