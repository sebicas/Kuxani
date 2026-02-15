"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./gratitude.module.css";

interface GratitudeEntry {
  id: string;
  content: string;
  category: "gratitude" | "love_note" | "appreciation";
  aiPrompt: string | null;
  shared: boolean;
  createdAt: string;
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
  const [feedFilter, setFeedFilter] = useState<"all" | "shared">("all");

  useEffect(() => {
    fetchEntries();
    fetchPrompt();
  }, []);

  async function fetchEntries() {
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
  }

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
        const entry = await res.json();
        setEntries((prev) => [entry, ...prev]);
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
    if (feedFilter === "shared") return entries.filter((e) => e.shared);
    return entries;
  }, [entries, feedFilter]);

  // Monthly contribution grid (last 28 days)
  const monthDays = useMemo(() => {
    const days: Array<{ date: string; dayNum: number; hasEntry: boolean }> = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const hasEntry = entries.some((e) => new Date(e.createdAt).toDateString() === dateStr);
      days.push({ date: dateStr, dayNum: d.getDate(), hasEntry });
    }
    return days;
  }, [entries]);

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
        <div className={styles.monthDayLabels}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className={styles.monthDayLabel}>{d}</span>
          ))}
        </div>
        <div className={styles.monthGrid}>
          {monthDays.map((day) => (
            <div
              key={day.date}
              className={`${styles.monthDay} ${
                day.hasEntry ? styles.monthDayFilled : styles.monthDayEmpty
              }`}
              title={day.hasEntry ? `Entry on day ${day.dayNum}` : `No entry on day ${day.dayNum}`}
            >
              {day.dayNum}
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
              💌 Love Notes
            </button>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyEmoji}>✨</div>
            <p>No entries yet. Start by responding to today&apos;s prompt!</p>
          </div>
        ) : (
          <div className={styles.feedGrid}>
            {filteredEntries.map((entry) => {
              const cat = CATEGORY_LABELS[entry.category] || CATEGORY_LABELS.gratitude;
              return (
                <div key={entry.id} className={styles.entryCard}>
                  <div className={styles.entryMeta}>
                    <span className="badge badge-primary">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className={styles.entryDate}>{formatDate(entry.createdAt)}</span>
                  </div>
                  <div className={styles.entryContent}>{entry.content}</div>
                  {entry.aiPrompt && (
                    <div className={styles.entryPrompt}>Prompt: {entry.aiPrompt}</div>
                  )}
                  <div style={{ marginTop: "var(--space-sm)" }}>
                    <span className={`badge ${entry.shared ? "badge-success" : "badge-primary"}`}>
                      {entry.shared ? "💌 Shared" : "🔒 Private"}
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
