"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./disagreements.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { DISAGREEMENT_STATUS } from "@/lib/socket/events";

interface DisagreementItem {
  id: string;
  title: string | null;
  category: string;
  status: string;
  visibility: string;
  createdAt: string;
  resolvedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  intake: "Starting",
  clarifying: "Exploring",
  confirmed: "Confirmed",
  invite_sent: "Invited",
  partner_joined: "Together",
  active: "Active",
  resolving: "Resolving",
  resolved: "Resolved",
};

const CATEGORY_ICONS: Record<string, string> = {
  communication: "💬",
  finances: "💰",
  intimacy: "❤️",
  parenting: "👶",
  chores: "🏠",
  boundaries: "🚧",
  trust: "🤝",
  other: "🗣️",
};

export default function DisagreementsPage() {
  const router = useRouter();
  const [disagreements, setDisagreements] = useState<DisagreementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    fetchDisagreements();
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

  const fetchDisagreements = useCallback(async () => {
    try {
      const res = await fetch("/api/disagreements");
      if (res.ok) {
        setDisagreements(await res.json());
      }
    } catch (err) {
      console.error("Failed to load disagreements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time updates
  useCoupleSocket(coupleId, DISAGREEMENT_STATUS, currentUserId, fetchDisagreements);

  async function createDisagreement(category: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/disagreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/disagreements/${data.id}`);
      }
    } catch (err) {
      console.error("Failed to create disagreement:", err);
    } finally {
      setCreating(false);
      setShowCategoryPicker(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div>
        <div className={styles.listHeader}>
          <h1 className="heading-2">Disagreements 🗣️</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const active = disagreements.filter((d) => d.status !== "resolved");
  const resolved = disagreements.filter((d) => d.status === "resolved");

  return (
    <div>
      <div className={styles.listHeader}>
        <div>
          <h1 className="heading-2">Disagreements 🗣️</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Talk through conflicts with AI-guided support.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCategoryPicker(!showCategoryPicker)}
          disabled={creating}
        >
          {creating ? "Creating…" : "New Conversation"}
        </button>
      </div>

      {/* Category Picker */}
      {showCategoryPicker && (
        <div className={styles.categoryPicker}>
          <p className={styles.categoryPickerTitle}>What&apos;s it about?</p>
          <div className={styles.categoryGrid}>
            {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
              <button
                key={key}
                className={styles.categoryBtn}
                onClick={() => createDisagreement(key)}
                disabled={creating}
              >
                <span className={styles.categoryBtnIcon}>{icon}</span>
                <span className={styles.categoryBtnLabel}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {disagreements.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🌿</span>
          <h2 className="heading-3" style={{ marginBottom: "var(--space-sm)" }}>
            No conversations yet
          </h2>
          <p className={`text-muted ${styles.emptyText}`}>
            When something comes up between you and your partner,
            start a private conversation here. Our AI therapist will help
            you explore your feelings and, when you&apos;re ready, bring your partner in.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "var(--space-lg)" }}
            onClick={() => setShowCategoryPicker(true)}
          >
            Start Your First Conversation
          </button>
        </div>
      ) : (
        <>
          {/* Active Disagreements */}
          {active.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Active</div>
              <div className={styles.disagreementGrid}>
                {active.map((d) => (
                  <Link
                    key={d.id}
                    href={`/disagreements/${d.id}`}
                    className={styles.disagreementCard}
                  >
                    <div className={styles.cardLeft}>
                      <div className={styles.disagreementIcon}>
                        {CATEGORY_ICONS[d.category] || "🗣️"}
                      </div>
                      <div className={styles.disagreementInfo}>
                        <div className={styles.disagreementTitle}>
                          {d.title || `${d.category.charAt(0).toUpperCase() + d.category.slice(1)} conversation`}
                        </div>
                        <div className={styles.disagreementMeta}>
                          <span className={`${styles.statusBadge} ${styles[`status${d.status.charAt(0).toUpperCase() + d.status.slice(1).replace(/_([a-z])/g, (_, l: string) => l.toUpperCase())}`] || ""}`}>
                            {STATUS_LABELS[d.status] || d.status}
                          </span>
                          <span className={styles.messageCountBadge}>
                            💬 {d.messageCount}
                          </span>
                          {d.visibility === "shared" && (
                            <span className={styles.sharedBadge}>👥 Shared</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.disagreementDate}>
                      {d.lastMessageAt
                        ? formatDate(d.lastMessageAt)
                        : formatDate(d.createdAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Resolved Disagreements */}
          {resolved.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Resolved</div>
              <div className={styles.disagreementGrid}>
                {resolved.map((d) => (
                  <Link
                    key={d.id}
                    href={`/disagreements/${d.id}`}
                    className={`${styles.disagreementCard} ${styles.disagreementCardResolved}`}
                  >
                    <div className={styles.cardLeft}>
                      <div className={styles.disagreementIcon}>
                        {CATEGORY_ICONS[d.category] || "🗣️"}
                      </div>
                      <div className={styles.disagreementInfo}>
                        <div className={styles.disagreementTitle}>
                          {d.title || `${d.category.charAt(0).toUpperCase() + d.category.slice(1)} conversation`}
                        </div>
                        <div className={styles.disagreementMeta}>
                          <span className={`${styles.statusBadge} ${styles.statusResolved}`}>
                            ✅ Resolved
                          </span>
                          <span className={styles.messageCountBadge}>
                            💬 {d.messageCount}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.disagreementDate}>
                      {d.resolvedAt
                        ? `Resolved ${formatDate(d.resolvedAt)}`
                        : formatDate(d.createdAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
