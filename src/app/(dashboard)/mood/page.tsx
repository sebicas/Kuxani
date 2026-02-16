"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./mood.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { MOOD_UPDATED } from "@/lib/socket/events";

/* ── Plutchik's primary emotions with colors ── */
const EMOTIONS = [
  { name: "joy", emoji: "😊", color: "#fbbf24", secondaries: ["serenity", "ecstasy"] },
  { name: "trust", emoji: "🤝", color: "#34d399", secondaries: ["acceptance", "admiration"] },
  { name: "fear", emoji: "😰", color: "#60a5fa", secondaries: ["apprehension", "terror"] },
  { name: "surprise", emoji: "😲", color: "#a78bfa", secondaries: ["distraction", "amazement"] },
  { name: "sadness", emoji: "😢", color: "#93c5fd", secondaries: ["pensiveness", "grief"] },
  { name: "disgust", emoji: "🤢", color: "#86efac", secondaries: ["boredom", "loathing"] },
  { name: "anger", emoji: "😤", color: "#f87171", secondaries: ["annoyance", "rage"] },
  { name: "anticipation", emoji: "🤔", color: "#fb923c", secondaries: ["interest", "vigilance"] },
] as const;

interface MoodEntry {
  id: string;
  primaryEmotion: string;
  secondaryEmotion: string | null;
  intensity: number;
  notes: string | null;
  sharedWithPartner: boolean;
  createdAt: string;
  isPartnerEntry?: boolean;
  partnerName?: string;
}

export default function MoodPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Check-in form state
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState("");
  const [shareWithPartner, setShareWithPartner] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(true);

  // Real-time state
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/mood?days=30");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);

        // Check if user already checked in today (own entries only)
        const today = new Date().toDateString();
        const todayEntry = data.find(
          (e: MoodEntry) =>
            !e.isPartnerEntry && new Date(e.createdAt).toDateString() === today
        );
        if (todayEntry) {
          setShowCheckIn(false);
        }
      }
    } catch (err) {
      console.error("Failed to load mood entries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    // Fetch couple + user info for real-time
    fetch("/api/couples")
      .then((r) => r.json())
      .then((data) => {
        if (data.couple?.id) setCoupleId(data.couple.id);
      })
      .catch(() => {});
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});
  }, [fetchEntries]);

  // Real-time: auto-refresh when partner shares a mood
  useCoupleSocket(coupleId, MOOD_UPDATED, currentUserId, fetchEntries);

  async function handleSubmit() {
    if (!selectedEmotion) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryEmotion: selectedEmotion,
          secondaryEmotion: null,
          intensity,
          notes: notes || null,
          sharedWithPartner: shareWithPartner,
        }),
      });

      if (res.ok) {
        // Re-fetch to get updated list including partner entries
        await fetchEntries();
        setShowCheckIn(false);
        setSelectedEmotion(null);
        setIntensity(5);
        setNotes("");
      }
    } catch (err) {
      console.error("Failed to save mood:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function getEmotionData(name: string) {
    return EMOTIONS.find((e) => e.name === name);
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  // Today's entry (own only, not partner)
  const todayEntry = useMemo(() => {
    const today = new Date().toDateString();
    return entries.find(
      (e) => !e.isPartnerEntry && new Date(e.createdAt).toDateString() === today
    );
  }, [entries]);

  // Only own entries for weekly trend
  const ownEntries = useMemo(
    () => entries.filter((e) => !e.isPartnerEntry),
    [entries]
  );

  // Last 7 days for trend (own entries only)
  const weekEntries = useMemo(() => {
    const days: Array<{ day: string; entry: MoodEntry | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toDateString();
      const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
      const entry = ownEntries.find((e) => new Date(e.createdAt).toDateString() === dayStr) || null;
      days.push({ day: dayLabel, entry });
    }
    return days;
  }, [ownEntries]);

  if (loading) {
    return (
      <div>
        <div className={styles.moodHeader}>
          <h1 className="heading-2">Mood Tracker 🫶</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.moodHeader}>
        <div>
          <h1 className="heading-2">Mood Tracker 🫶</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Check in with your emotional state daily.
          </p>
        </div>
        {!showCheckIn && (
          <button className="btn btn-secondary" onClick={() => setShowCheckIn(true)}>
            New Check-In
          </button>
        )}
      </div>

      {/* ── Check-In Section ── */}
      {showCheckIn ? (
        <div className={styles.wheelSection}>
          <div className="card">
            <h2 className="heading-3" style={{ marginBottom: "var(--space-lg)" }}>
              How are you feeling right now?
            </h2>

            <div className={styles.wheelContainer}>
              {/* Emotion Wheel Grid */}
              <div className={styles.emotionWheel}>
                {EMOTIONS.map((emotion) => (
                  <button
                    key={emotion.name}
                    className={`${styles.emotionBtn} ${
                      selectedEmotion === emotion.name ? styles.emotionBtnSelected : ""
                    }`}
                    style={{
                      borderColor:
                        selectedEmotion === emotion.name ? emotion.color : undefined,
                      background:
                        selectedEmotion === emotion.name
                          ? `${emotion.color}15`
                          : undefined,
                    }}
                    onClick={() => setSelectedEmotion(emotion.name)}
                  >
                    <span className={styles.emotionEmoji}>{emotion.emoji}</span>
                    <span className={styles.emotionLabel}>{emotion.name}</span>
                  </button>
                ))}
              </div>

              {/* Intensity Slider */}
              {selectedEmotion && (
                <>
                  <div className={styles.intensitySection}>
                    <div className={styles.intensityLabel}>
                      <span className="text-sm text-muted">Intensity</span>
                      <span
                        className={styles.intensityValue}
                        style={{
                          color: getEmotionData(selectedEmotion)?.color,
                        }}
                      >
                        {intensity}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={intensity}
                      onChange={(e) => setIntensity(parseInt(e.target.value))}
                      className={styles.intensitySlider}
                      style={{
                        background: `linear-gradient(to right, ${
                          getEmotionData(selectedEmotion)?.color
                        } ${(intensity / 10) * 100}%, var(--border-default) ${
                          (intensity / 10) * 100
                        }%)`,
                      }}
                    />
                    <div className={styles.intensityScale}>
                      <span>Mild</span>
                      <span>Moderate</span>
                      <span>Intense</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea
                    className={styles.notesInput}
                    placeholder="What's on your mind? (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />

                  {/* Share Toggle */}
                  <div className={styles.shareRow}>
                    <span className="text-sm">Share with partner</span>
                    <button
                      className={`${styles.shareSwitch} ${
                        shareWithPartner ? styles.shareSwitchActive : ""
                      }`}
                      onClick={() => setShareWithPartner(!shareWithPartner)}
                      type="button"
                    >
                      <div className={styles.shareSwitchKnob} />
                    </button>
                  </div>

                  {/* Submit */}
                  <div className={styles.submitRow}>
                    <button
                      className="btn btn-primary btn-lg"
                      style={{ width: "100%" }}
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Log My Mood"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : todayEntry ? (
        /* ── Today's Entry ── */
        <div className="card" style={{ marginBottom: "var(--space-2xl)" }}>
          <div className={styles.todayCard}>
            <span className={styles.todayEmoji}>
              {getEmotionData(todayEntry.primaryEmotion)?.emoji || "🫶"}
            </span>
            <div className={styles.todayEmotion}>{todayEntry.primaryEmotion}</div>
            <div className={styles.todayIntensity}>
              Intensity: {todayEntry.intensity}/10
            </div>
            {todayEntry.notes && (
              <div className={styles.todayNotes}>&ldquo;{todayEntry.notes}&rdquo;</div>
            )}
            <div style={{ marginTop: "var(--space-sm)" }}>
              <span
                className={`badge ${
                  todayEntry.sharedWithPartner ? "badge-success" : "badge-primary"
                }`}
              >
                {todayEntry.sharedWithPartner ? "👥 Shared" : "🔒 Private"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Weekly Trend ── */}
      <div className={styles.trendSection}>
        <h2 className="heading-3">Weekly Trend</h2>
        <div className={styles.trendBars}>
          {weekEntries.map(({ day, entry }) => (
            <div key={day} className={styles.trendBarWrapper}>
              <div
                className={styles.trendBar}
                style={{
                  height: entry ? `${(entry.intensity / 10) * 100}%` : "4px",
                  background: entry
                    ? getEmotionData(entry.primaryEmotion)?.color || "var(--accent-primary)"
                    : "var(--border-default)",
                }}
                title={entry ? `${entry.primaryEmotion} (${entry.intensity}/10)` : "No entry"}
              />
              <span className={styles.trendBarLabel}>{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── History ── */}
      <div className={styles.historySection}>
        <h2 className="heading-3">History</h2>
        {entries.length === 0 ? (
          <div className={styles.emptyHistory}>
            <p>No mood entries yet. Start your first check-in above!</p>
          </div>
        ) : (
          <div className={styles.historyGrid}>
            {entries.slice(0, 14).map((entry) => {
              const emotionData = getEmotionData(entry.primaryEmotion);
              return (
                <div
                  key={entry.id}
                  className={`${styles.historyCard} ${
                    entry.isPartnerEntry ? styles.historyCardPartner : ""
                  }`}
                >
                  <div className={styles.historyEmoji}>
                    {emotionData?.emoji || "🫶"}
                  </div>
                  {entry.isPartnerEntry && (
                    <div className={styles.partnerTag}>
                      💕 {entry.partnerName || "Partner"}
                    </div>
                  )}
                  <div className={styles.historyEmotion}>
                    {entry.primaryEmotion}
                  </div>
                  <div className={styles.historyDate}>
                    {formatDate(entry.createdAt)}
                  </div>
                  <div className={styles.historyIntensityBar}>
                    <div
                      className={styles.historyIntensityFill}
                      style={{
                        width: `${(entry.intensity / 10) * 100}%`,
                        background: emotionData?.color || "var(--accent-primary)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
