/**
 * VoiceButton — Push-to-Talk / Toggle Voice Input
 *
 * Shared component for voice input in chat interfaces.
 * Shows audio level visualization and processing state.
 */
"use client";

import styles from "./VoiceButton.module.css";

interface VoiceButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  onToggle: () => void;
  disabled?: boolean;
}

export default function VoiceButton({
  isRecording,
  isProcessing,
  audioLevel,
  onToggle,
  disabled = false,
}: VoiceButtonProps) {
  return (
    <button
      className={`${styles.voiceBtn} ${
        isRecording ? styles.voiceBtnRecording : ""
      } ${isProcessing ? styles.voiceBtnProcessing : ""}`}
      onClick={onToggle}
      disabled={disabled || isProcessing}
      title={isRecording ? "Stop recording" : "Voice input"}
      type="button"
    >
      {/* Audio level ring */}
      {isRecording && (
        <div
          className={styles.audioRing}
          style={{
            transform: `scale(${1 + audioLevel * 0.4})`,
            opacity: 0.3 + audioLevel * 0.5,
          }}
        />
      )}

      {/* Icon */}
      <span className={styles.voiceIcon}>
        {isProcessing ? "⏳" : isRecording ? "⏹️" : "🎤"}
      </span>
    </button>
  );
}
