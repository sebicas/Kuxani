"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./commitments.module.css";
import { useCommitmentsSocket } from "@/lib/hooks/useCommitmentsSocket";

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  sourceType: string;
  requestedBy: string;
  requestedOf: string;
  dueDate: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  requestedByName: string | null;
}

interface CompromiseItem {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  proposedBy: string;
  partnerACommitment: string;
  partnerBCommitment: string;
  status: string;
  acceptedByA: boolean;
  acceptedByB: boolean;
  checkInFrequency: string;
  createdAt: string;
  proposedByName: string | null;
}

const STATUS_CLASSES: Record<string, string> = {
  proposed: "statusProposed",
  accepted: "statusAccepted",
  in_progress: "statusInProgress",
  active: "statusActive",
  fulfilled: "statusFulfilled",
  broken: "statusBroken",
  declined: "statusDeclined",
};

const PRIORITY_ICONS: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

export default function CommitmentsPage() {
  const [tab, setTab] = useState<"requests" | "compromises">("requests");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [compromises, setCompromises] = useState<CompromiseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
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

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, compRes] = await Promise.all([
        fetch("/api/commitments/requests"),
        fetch("/api/commitments/compromises"),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (compRes.ok) setCompromises(await compRes.json());
    } catch (err) {
      console.error("Failed to load commitments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useCommitmentsSocket(coupleId, currentUserId, fetchAll);

  async function updateRequestStatus(id: string, status: string) {
    try {
      await fetch(`/api/commitments/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchAll();
    } catch (err) {
      console.error("Update error:", err);
    }
  }

  async function acceptCompromise(id: string) {
    try {
      await fetch(`/api/commitments/compromises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true }),
      });
      await fetchAll();
    } catch (err) {
      console.error("Accept error:", err);
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
        <div className={styles.header}>
          <h1 className="heading-2">Commitments 📝</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const activeRequests = requests.filter((r) => !["fulfilled", "declined", "broken"].includes(r.status));
  const completedRequests = requests.filter((r) => ["fulfilled", "declined", "broken"].includes(r.status));
  const activeCompromises = compromises.filter((c) => !["fulfilled", "broken"].includes(c.status));
  const completedCompromises = compromises.filter((c) => ["fulfilled", "broken"].includes(c.status));

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className="heading-2">Commitments 📝</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Track requests and compromises from your conversations.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "requests" ? styles.tabActive : ""}`}
          onClick={() => setTab("requests")}
        >
          📋 Requests
          {activeRequests.length > 0 && (
            <span className={styles.tabBadge}>{activeRequests.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === "compromises" ? styles.tabActive : ""}`}
          onClick={() => setTab("compromises")}
        >
          🤝 Compromises
          {activeCompromises.length > 0 && (
            <span className={styles.tabBadge}>{activeCompromises.length}</span>
          )}
        </button>
      </div>

      {/* Requests Tab */}
      {tab === "requests" && (
        <div>
          {requests.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <h3 className="heading-3">No requests yet</h3>
              <p className="text-muted" style={{ maxWidth: 400, margin: "var(--space-sm) auto 0" }}>
                Requests are created when you resolve a disagreement or manually add them.
              </p>
            </div>
          ) : (
            <>
              {activeRequests.length > 0 && (
                <>
                  <div className={styles.sectionLabel}>Active</div>
                  <div className={styles.itemGrid}>
                    {activeRequests.map((req) => (
                      <div key={req.id} className={styles.itemCard}>
                        <div className={styles.itemHeader}>
                          <span className={styles.priorityIcon}>
                            {PRIORITY_ICONS[req.priority] || "🟡"}
                          </span>
                          <span className={styles.itemTitle}>{req.title}</span>
                          <span className={`${styles.itemStatus} ${styles[STATUS_CLASSES[req.status] || ""]}`}>
                            {req.status.replace("_", " ")}
                          </span>
                        </div>
                        {req.description && (
                          <p className={styles.itemDescription}>{req.description}</p>
                        )}
                        <div className={styles.itemMeta}>
                          <span>From {req.requestedByName || "Partner"}</span>
                          <span>•</span>
                          <span>{req.sourceType === "manual" ? "Manual" : `From ${req.sourceType}`}</span>
                          <span>•</span>
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                        {req.requestedOf === currentUserId && req.status === "proposed" && (
                          <div className={styles.itemActions}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => updateRequestStatus(req.id, "accepted")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => updateRequestStatus(req.id, "declined")}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {req.status === "accepted" && req.requestedOf === currentUserId && (
                          <div className={styles.itemActions}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => updateRequestStatus(req.id, "fulfilled")}
                            >
                              ✅ Mark Fulfilled
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {completedRequests.length > 0 && (
                <>
                  <div className={styles.sectionLabel}>Completed</div>
                  <div className={styles.itemGrid}>
                    {completedRequests.map((req) => (
                      <div key={req.id} className={`${styles.itemCard} ${styles.itemCardCompleted}`}>
                        <div className={styles.itemHeader}>
                          <span className={styles.priorityIcon}>
                            {req.status === "fulfilled" ? "✅" : req.status === "declined" ? "❌" : "⚠️"}
                          </span>
                          <span className={styles.itemTitle}>{req.title}</span>
                          <span className={`${styles.itemStatus} ${styles[STATUS_CLASSES[req.status] || ""]}`}>
                            {req.status}
                          </span>
                        </div>
                        <div className={styles.itemMeta}>
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Compromises Tab */}
      {tab === "compromises" && (
        <div>
          {compromises.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🤝</span>
              <h3 className="heading-3">No compromises yet</h3>
              <p className="text-muted" style={{ maxWidth: 400, margin: "var(--space-sm) auto 0" }}>
                Compromises are created when you resolve disagreements together.
              </p>
            </div>
          ) : (
            <>
              {activeCompromises.length > 0 && (
                <>
                  <div className={styles.sectionLabel}>Active</div>
                  <div className={styles.itemGrid}>
                    {activeCompromises.map((comp) => (
                      <div key={comp.id} className={styles.itemCard}>
                        <div className={styles.itemHeader}>
                          <span className={styles.itemTitle}>{comp.title}</span>
                          <span className={`${styles.itemStatus} ${styles[STATUS_CLASSES[comp.status] || ""]}`}>
                            {comp.status}
                          </span>
                        </div>
                        {comp.description && (
                          <p className={styles.itemDescription}>{comp.description}</p>
                        )}
                        <div className={styles.compromiseCommitments}>
                          <div className={styles.commitmentBlock}>
                            <div className={styles.commitmentLabel}>
                              Partner A {comp.acceptedByA ? "✅" : "⏳"}
                            </div>
                            <p>{comp.partnerACommitment}</p>
                          </div>
                          <div className={styles.commitmentBlock}>
                            <div className={styles.commitmentLabel}>
                              Partner B {comp.acceptedByB ? "✅" : "⏳"}
                            </div>
                            <p>{comp.partnerBCommitment}</p>
                          </div>
                        </div>
                        <div className={styles.itemMeta}>
                          <span>Proposed by {comp.proposedByName || "Partner"}</span>
                          <span>•</span>
                          <span>{formatDate(comp.createdAt)}</span>
                          {comp.checkInFrequency !== "none" && (
                            <>
                              <span>•</span>
                              <span>Check-in: {comp.checkInFrequency}</span>
                            </>
                          )}
                        </div>
                        {comp.status === "proposed" && (
                          <div className={styles.itemActions}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => acceptCompromise(comp.id)}
                            >
                              ✅ Accept
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {completedCompromises.length > 0 && (
                <>
                  <div className={styles.sectionLabel}>Completed</div>
                  <div className={styles.itemGrid}>
                    {completedCompromises.map((comp) => (
                      <div key={comp.id} className={`${styles.itemCard} ${styles.itemCardCompleted}`}>
                        <div className={styles.itemHeader}>
                          <span className={styles.itemTitle}>{comp.title}</span>
                          <span className={`${styles.itemStatus} ${styles[STATUS_CLASSES[comp.status] || ""]}`}>
                            {comp.status === "fulfilled" ? "✅ Fulfilled" : "⚠️ Broken"}
                          </span>
                        </div>
                        <div className={styles.itemMeta}>
                          <span>{formatDate(comp.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
