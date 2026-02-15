"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./challenges.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { CHALLENGE_UPDATED } from "@/lib/socket/events";

interface ChallengeItem {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  perspectivesSubmitted: number;
}

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  perspectives: "Writing",
  submitted: "Submitted",
  synthesis: "Synthesis",
  review: "Review",
  discussion: "Discussion",
  commitments: "Commitments",
  resolved: "Resolved",
};

const CATEGORY_ICONS: Record<string, string> = {
  communication: "💬",
  finances: "💰",
  parenting: "👶",
  intimacy: "❤️",
  household: "🏠",
  trust: "🤝",
  boundaries: "🚧",
  family: "👨‍👩‍👧",
  work_life: "⚖️",
  other: "🔮",
};

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    created: styles.statusCreated,
    perspectives: styles.statusPerspectives,
    submitted: styles.statusSubmitted,
    synthesis: styles.statusSynthesis,
    review: styles.statusReview,
    discussion: styles.statusDiscussion,
    commitments: styles.statusCommitments,
    resolved: styles.statusResolved,
  };
  return map[status] || styles.statusCreated;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenges();
    // Fetch couple info for real-time
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

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch("/api/challenges");
      if (res.ok) {
        setChallenges(await res.json());
      }
    } catch (err) {
      console.error("Failed to load challenges:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time: auto-refresh when partner creates/updates a challenge
  useCoupleSocket(coupleId, CHALLENGE_UPDATED, currentUserId, fetchChallenges);

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
          <h1 className="heading-2">Challenges 🔮</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.listHeader}>
        <div>
          <h1 className="heading-2">Challenges 🔮</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Work through conflicts together with AI-guided resolution.
          </p>
        </div>
        <Link href="/challenges/new" className="btn btn-primary">
          New Challenge
        </Link>
      </div>

      {challenges.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🌿</span>
          <h2 className="heading-3" style={{ marginBottom: "var(--space-sm)" }}>
            No challenges yet
          </h2>
          <p className={`text-muted ${styles.emptyText}`}>
            When a conflict arises, create a Challenge. Both partners write their
            perspective independently, then AI helps find common ground and guide
            you toward resolution.
          </p>
          <Link
            href="/challenges/new"
            className="btn btn-primary"
            style={{ marginTop: "var(--space-lg)" }}
          >
            Create Your First Challenge
          </Link>
        </div>
      ) : (
        <div className={styles.challengeGrid}>
          {challenges.map((c) => (
            <Link
              key={c.id}
              href={`/challenges/${c.id}`}
              className={styles.challengeCard}
            >
              <div className={styles.challengeIcon}>
                {CATEGORY_ICONS[c.category] || "🔮"}
              </div>
              <div className={styles.challengeInfo}>
                <div className={styles.challengeTitle}>{c.title}</div>
                <div className={styles.challengeMeta}>
                  <span className={styles.categoryBadge}>{c.category.replace("_", " ")}</span>
                  <span className={`${styles.statusBadge} ${getStatusClass(c.status)}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                  <span className={styles.perspectiveCount}>
                    {c.perspectivesSubmitted}/2 perspectives
                  </span>
                </div>
              </div>
              <div className={styles.challengeDate}>
                {c.resolvedAt ? `Resolved ${formatDate(c.resolvedAt)}` : formatDate(c.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
