/**
 * useVoiceSession — Browser Audio Capture & Playback Hook
 *
 * Manages:
 * - MediaRecorder for STT (speech-to-text) capture
 * - Audio playback for TTS responses
 * - Connection to the /api/disagreements/[id]/voice API
 * - Partner activity emission (speaking state)
 */
"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/socketClient";
import { PARTNER_ACTIVITY } from "@/lib/socket/events";

interface UseVoiceSessionProps {
  disagreementId: string;
  currentUserId: string | null;
  isShared: boolean; // whether partner activity should be emitted
  onTranscript: (text: string) => void; // called with transcribed text
}

export function useVoiceSession({
  disagreementId,
  currentUserId,
  isShared,
  onTranscript,
}: UseVoiceSessionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  const emitActivity = useCallback(
    (activity: string) => {
      if (!isShared || !currentUserId) return;
      getSocket().emit(PARTNER_ACTIVITY, {
        disagreementId,
        userId: currentUserId,
        activity,
      });
    },
    [disagreementId, currentUserId, isShared]
  );

  // Visualize audio level
  const startVisualization = useCallback(
    (stream: MediaStream) => {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1)); // normalize 0–1
        animFrameRef.current = requestAnimationFrame(update);
      };
      update();
    },
    []
  );

  const stopVisualization = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopVisualization();
        emitActivity("online");

        if (chunksRef.current.length === 0) {
          setIsProcessing(false);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setIsProcessing(true);

        try {
          // Send to voice API for STT
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch(
            `/api/disagreements/${disagreementId}/voice`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (res.ok) {
            const data = await res.json();
            if (data.transcript) {
              onTranscript(data.transcript);
            }
          }
        } catch (err) {
          console.error("Voice processing error:", err);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // 250ms chunks
      setIsRecording(true);
      emitActivity("speaking");
      startVisualization(stream);
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  }, [disagreementId, onTranscript, emitActivity, startVisualization, stopVisualization]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    isSpeaking,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording,
    setIsSpeaking,
  };
}
