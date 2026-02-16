"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./gratitude.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { GRATITUDE_UPDATED } from "@/lib/socket/events";

interface GratitudeEntry {
  id: string;
  userId: string;
  content: string;
  category: "gratitude" | "love_note" | "appreciation";
  aiPrompt: string | null;
  shared: boolean;
  createdAt: string;
  isPartnerEntry?: boolean;
  partnerName?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  gratitude: { label: "Gratitude", emoji: "🙏" },
  love_note: { label: "Love Note", emoji: "💌" },
  appreciation: { label: "Appreciation", emoji: "💝" },
};

export default function GratitudePage() {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("gratitude");
  const [shared, setShared] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Prompt state
  const [dailyPrompt, setDailyPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(true);

  // Feed filter
  const [feedFilter, setFeedFilter] = useState<"all" | "shared" | "partner">("all");

  // Real-time state
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchPrompt();
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
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/gratitude?days=90");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to load gratitude entries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time: auto-refresh when partner shares an entry
  useCoupleSocket(coupleId, GRATITUDE_UPDATED, currentUserId, fetchEntries);

  async function fetchPrompt() {
    try {
      const res = await fetch("/api/gratitude/prompts");
      if (res.ok) {
        const data = await res.json();
        setDailyPrompt(data.prompt);
      }
    } catch (err) {
      console.error("Failed to load prompt:", err);
      setDailyPrompt("What's one thing your partner did recently that made you feel loved?");
    } finally {
      setPromptLoading(false);
    }
  }

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          category,
          shared,
          aiPrompt: dailyPrompt,
        }),
      });

      if (res.ok) {
        // Re-fetch to get updated list including partner entries
        await fetchEntries();
        setContent("");
        setShowForm(false);
        setCategory("gratitude");
        setShared(false);
      }
    } catch (err) {
      console.error("Failed to save entry:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function usePromptAsInspiration() {
    setShowForm(true);
    setContent("");
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

  // Filtered entries for feed
  const filteredEntries = useMemo(() => {
    if (feedFilter === "shared") return entries.filter((e) => e.shared && !e.isPartnerEntry);
    if (feedFilter === "partner") return entries.filter((e) => e.isPartnerEntry);
    return entries;
  }, [entries, feedFilter]);

  // Only count own entries for the monthly grid
  const ownEntries = useMemo(() => entries.filter((e) => !e.isPartnerEntry), [entries]);

  // Monthly contribution grid (last 28 days, descending — today first)
  const monthDays = useMemo(() => {
    const days: Array<{ date: string; dayNum: number; month: string; hasEntry: boolean; isToday: boolean }> = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const hasEntry = ownEntries.some((e) => new Date(e.createdAt).toDateString() === dateStr);
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        hasEntry,
        isToday: i === 0,
      });
    }
    return days;
  }, [ownEntries]);

  // Count partner love notes
  const partnerEntryCount = useMemo(
    () => entries.filter((e) => e.isPartnerEntry).length,
    [entries]
  );

  if (loading) {
    return (
      <div>
        <div className={styles.gratitudeHeader}>
          <h1 className="heading-2">Gratitude Journal ✨</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.gratitudeHeader}>
        <div>
          <h1 className="heading-2">Gratitude Journal ✨</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Nurture appreciation and love in your relationship.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Entry"}
        </button>
      </div>

      {/* ── Daily Prompt ── */}
      {!promptLoading && dailyPrompt && !showForm && (
        <div className={styles.promptCard}>
          <p className={styles.promptText}>&ldquo;{dailyPrompt}&rdquo;</p>
          <div className={styles.promptActions}>
            <button className={styles.promptBtn} onClick={usePromptAsInspiration}>
              Write About This
            </button>
            <button className={styles.promptBtn} onClick={fetchPrompt}>
              New Prompt
            </button>
          </div>
        </div>
      )}

      {/* ── Entry Form ── */}
      {showForm && (
        <div className={`card ${styles.formCard}`}>
          <h3 className="heading-3" style={{ marginBottom: "var(--space-md)" }}>
            {dailyPrompt
              ? `Prompt: "${dailyPrompt}"`
              : "Write what you're grateful for"}
          </h3>

          {/* Category Picker */}
          <div className={styles.categoryPicker}>
            {Object.entries(CATEGORY_LABELS).map(([key, { label, emoji }]) => (
              <button
                key={key}
                className={`${styles.categoryBtn} ${
                  category === key ? styles.categoryBtnActive : ""
                }`}
                onClick={() => setCategory(key)}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            className={styles.entryTextarea}
            placeholder="What are you grateful for today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
          />

          {/* Footer: share toggle + submit */}
          <div className={styles.formFooter}>
            <div className={styles.shareRow}>
              <span className="text-sm">Share as love note</span>
              <button
                className={`${styles.shareSwitch} ${
                  shared ? styles.shareSwitchActive : ""
                }`}
                onClick={() => setShared(!shared)}
                type="button"
              >
                <div className={styles.shareSwitchKnob} />
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
            >
              {submitting ? "Saving…" : "Save Entry"}
            </button>
          </div>
        </div>
      )}

      {/* ── Monthly Grid ── */}
      <div className={styles.monthlySection}>
        <h2 className="heading-3">Last 28 Days</h2>
        <div className={styles.monthGrid}>
          {monthDays.map((day) => (
            <div
              key={day.date}
              className={`${styles.monthDay} ${
                day.hasEntry ? styles.monthDayFilled : styles.monthDayEmpty
              } ${day.isToday ? styles.monthDayToday : ""}`}
              title={day.hasEntry ? `Entry on day ${day.dayNum}` : `No entry on day ${day.dayNum}`}
            >
              <span className={styles.monthDayMonth}>{day.month}</span>
              <span className={styles.monthDayNum}>{day.dayNum}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div className={styles.feedSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
          <h2 className="heading-3">Entries</h2>
          <div className={styles.feedTabs}>
            <button
              className={`${styles.feedTab} ${feedFilter === "all" ? styles.feedTabActive : ""}`}
              onClick={() => setFeedFilter("all")}
            >
              All
            </button>
            <button
              className={`${styles.feedTab} ${feedFilter === "shared" ? styles.feedTabActive : ""}`}
              onClick={() => setFeedFilter("shared")}
            >
              💌 My Love Notes
            </button>
            {partnerEntryCount > 0 && (
              <button
                className={`${styles.feedTab} ${feedFilter === "partner" ? styles.feedTabActive : ""}`}
                onClick={() => setFeedFilter("partner")}
              >
                💕 From Partner ({partnerEntryCount})
              </button>
            )}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyEmoji}>✨</div>
            <p>
              {feedFilter === "partner"
                ? "No shared entries from your partner yet."
                : "No entries yet. Start by responding to today\u0027s prompt!"}
            </p>
          </div>
        ) : (
          <div className={styles.feedGrid}>
            {filteredEntries.map((entry) => {
              const cat = CATEGORY_LABELS[entry.category] || CATEGORY_LABELS.gratitude;
              return (
                <div
                  key={entry.id}
                  className={`${styles.entryCard} ${
                    entry.isPartnerEntry ? styles.entryCardPartner : ""
                  }`}
                >
                  <div className={styles.entryMeta}>
                    <span className="badge badge-primary">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className={styles.entryDate}>{formatDate(entry.createdAt)}</span>
                  </div>
                  {entry.isPartnerEntry && (
                    <div className={styles.partnerLabel}>
                      💕 From {entry.partnerName || "Partner"}
                    </div>
                  )}
                  <div className={styles.entryContent}>{entry.content}</div>
                  {entry.aiPrompt && (
                    <div className={styles.entryPrompt}>Prompt: {entry.aiPrompt}</div>
                  )}
                  <div style={{ marginTop: "var(--space-sm)" }}>
                    <span className={`badge ${entry.shared ? "badge-success" : "badge-primary"}`}>
                      {entry.isPartnerEntry
                        ? "💕 Shared with you"
                        : entry.shared
                        ? "💌 Shared"
                        : "🔒 Private"}
                    </span>
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
