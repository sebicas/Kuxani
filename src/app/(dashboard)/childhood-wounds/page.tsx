"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/client";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { CHILDHOOD_WOUNDS_UPDATED } from "@/lib/socket/events";
import styles from "./childhood-wounds.module.css";

interface ChildhoodWound {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  source: "self" | "partner" | "ai";
  intensity: number;
  suggestedBy: string | null;
  status: "active" | "suggested" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

interface AiSuggestion {
  title: string;
  description: string;
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  self: { label: "Self", className: "sourceSelf" },
  partner: { label: "Partner", className: "sourcePartner" },
  ai: { label: "AI", className: "sourceAi" },
};

export default function ChildhoodWoundsPage() {
  const { data: session } = useSession();
  const [myWounds, setMyWounds] = useState<ChildhoodWound[]>([]);
  const [partnerWounds, setPartnerWounds] = useState<ChildhoodWound[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addIntensity, setAddIntensity] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIntensity, setEditIntensity] = useState(5);

  // Partner suggestion
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [suggestIntensity, setSuggestIntensity] = useState(5);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const fetchWounds = useCallback(async () => {
    try {
      const res = await fetch("/api/childhood-wounds");
      if (res.ok) {
        const data = await res.json();
        setMyWounds(data.myWounds || []);
        setPartnerWounds(data.partnerWounds || []);
        setPartnerName(data.partnerName || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch couple ID for socket
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/couples")
      .then((r) => r.json())
      .then((data) => {
        if (data.couple?.id) setCoupleId(data.couple.id);
      })
      .catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    if (session?.user) fetchWounds();
  }, [session?.user, fetchWounds]);

  // Real-time updates
  useCoupleSocket(
    coupleId,
    CHILDHOOD_WOUNDS_UPDATED,
    session?.user?.id ?? null,
    fetchWounds
  );

  // Derived data
  const activeWounds = myWounds.filter((w) => w.status === "active");
  const pendingSuggestions = myWounds.filter((w) => w.status === "suggested");

  /* ── Handlers ── */

  const handleAddWound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/childhood-wounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDescription.trim() || null,
          intensity: addIntensity,
        }),
      });
      if (res.ok) {
        setAddTitle("");
        setAddDescription("");
        setAddIntensity(5);
        setShowAddForm(false);
        fetchWounds();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditWound = async (id: string) => {
    if (!editTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/childhood-wounds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          intensity: editIntensity,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchWounds();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWound = async (id: string) => {
    if (!confirm("Remove this wound?")) return;
    await fetch(`/api/childhood-wounds/${id}`, { method: "DELETE" });
    fetchWounds();
  };

  const handleAcceptSuggestion = async (id: string) => {
    await fetch(`/api/childhood-wounds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    fetchWounds();
  };

  const handleDismissSuggestion = async (id: string) => {
    await fetch(`/api/childhood-wounds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    fetchWounds();
  };

  const handleSuggestToPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/childhood-wounds/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestTitle.trim(),
          description: suggestDescription.trim() || null,
          intensity: suggestIntensity,
        }),
      });
      if (res.ok) {
        setSuggestTitle("");
        setSuggestDescription("");
        setSuggestIntensity(5);
        setShowSuggestForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setShowAiPanel(true);
    try {
      const res = await fetch("/api/childhood-wounds/ai-suggest", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data.suggestions || []);
      }
    } catch {
      /* ignore */
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAiSuggestion = async (suggestion: AiSuggestion) => {
    const res = await fetch("/api/childhood-wounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: suggestion.title,
        description: suggestion.description,
        source: "ai",
      }),
    });
    if (res.ok) {
      setAiSuggestions((prev) =>
        prev.filter((s) => s.title !== suggestion.title)
      );
      fetchWounds();
    }
  };

  const startEditing = (wound: ChildhoodWound) => {
    setEditingId(wound.id);
    setEditTitle(wound.title);
    setEditDescription(wound.description || "");
    setEditIntensity(wound.intensity || 5);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const userName = session?.user?.name || "Me";

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Childhood Wounds</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
            Explore and track emotional patterns from your past
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowSuggestForm(false);
            }}
          >
            {showAddForm ? "Cancel" : "➕ Add Wound"}
          </button>
          {coupleId && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowSuggestForm(!showSuggestForm);
                setShowAddForm(false);
              }}
            >
              {showSuggestForm ? "Cancel" : "💡 Suggest to Partner"}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleAiSuggest}
            disabled={aiLoading}
          >
            {aiLoading ? "Thinking..." : "🤖 AI Suggestions"}
          </button>
        </div>
      </div>

      {/* ── Pending Suggestions ── */}
      {pendingSuggestions.length > 0 && (
        <div className={styles.suggestionsBanner}>
          <div className={styles.suggestionsBannerTitle}>
            💭 Pending Suggestions ({pendingSuggestions.length})
          </div>
          {pendingSuggestions.map((wound) => (
            <div key={wound.id} className={styles.suggestionCard}>
              <div className={styles.suggestionInfo}>
                <div className={styles.suggestionTitle}>{wound.title}</div>
                {wound.description && (
                  <div className={styles.suggestionDescription}>
                    {wound.description}
                  </div>
                )}
                <div className={styles.suggestionSource}>
                  Suggested by{" "}
                  {wound.source === "ai" ? "AI Therapist" : "your partner"}
                  {" · "}Intensity: {wound.intensity}/10
                </div>
              </div>
              <div className={styles.suggestionActions}>
                <button
                  className={styles.acceptBtn}
                  onClick={() => handleAcceptSuggestion(wound.id)}
                  title="Accept"
                >
                  ✅
                </button>
                <button
                  className={styles.dismissBtn}
                  onClick={() => handleDismissSuggestion(wound.id)}
                  title="Dismiss"
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Wound Form ── */}
      {showAddForm && (
        <div className={`card ${styles.formCard}`}>
          <h3 style={{ marginBottom: "var(--space-md)" }}>Add a Childhood Wound</h3>
          <form onSubmit={handleAddWound} className={styles.formGrid}>
            <input
              type="text"
              placeholder="Title (e.g., Fear of abandonment)"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className={styles.formInput}
              required
              id="childhood-wound-title"
            />
            <textarea
              placeholder="Description (optional) — How does this show up in your relationships?"
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              className={styles.formTextarea}
              id="childhood-wound-description"
            />
            <div className={styles.intensityRow}>
              <label htmlFor="childhood-wound-intensity" className={styles.intensityLabel}>
                Intensity: <strong>{addIntensity}</strong>/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={addIntensity}
                onChange={(e) => setAddIntensity(Number(e.target.value))}
                className={styles.intensitySlider}
                id="childhood-wound-intensity"
              />
            </div>
            <div className={styles.formFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !addTitle.trim()}
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Suggest to Partner Form ── */}
      {showSuggestForm && (
        <div className={`card ${styles.formCard} ${styles.suggestForm}`}>
          <h3 style={{ marginBottom: "var(--space-md)" }}>
            💡 Suggest a Wound to {partnerName || "Your Partner"}
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              marginBottom: "var(--space-md)",
            }}
          >
            Your partner will see this as a suggestion. They can choose to accept
            or dismiss it.
          </p>
          <form onSubmit={handleSuggestToPartner} className={styles.formGrid}>
            <input
              type="text"
              placeholder="Title"
              value={suggestTitle}
              onChange={(e) => setSuggestTitle(e.target.value)}
              className={styles.formInput}
              required
              id="suggest-wound-title"
            />
            <textarea
              placeholder="Description (optional)"
              value={suggestDescription}
              onChange={(e) => setSuggestDescription(e.target.value)}
              className={styles.formTextarea}
              id="suggest-wound-description"
            />
            <div className={styles.intensityRow}>
              <label htmlFor="suggest-wound-intensity" className={styles.intensityLabel}>
                Intensity: <strong>{suggestIntensity}</strong>/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={suggestIntensity}
                onChange={(e) => setSuggestIntensity(Number(e.target.value))}
                className={styles.intensitySlider}
                id="suggest-wound-intensity"
              />
            </div>
            <div className={styles.formFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSuggestForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !suggestTitle.trim()}
              >
                {submitting ? "Sending..." : "Send Suggestion"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── AI Suggestions Panel ── */}
      {showAiPanel && (
        <div className={`card ${styles.aiPanel}`}>
          <div className={styles.aiPanelHeader}>
            <div className={styles.aiPanelTitle}>🤖 AI-Suggested Wounds</div>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAiPanel(false)}
              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
            >
              Close
            </button>
          </div>
          {aiLoading ? (
            <div className={styles.loading}>
              Analyzing patterns...
            </div>
          ) : aiSuggestions.length > 0 ? (
            aiSuggestions.map((s, i) => (
              <div key={i} className={styles.aiSuggestionCard}>
                <div className={styles.suggestionInfo}>
                  <div className={styles.suggestionTitle}>{s.title}</div>
                  <div className={styles.suggestionDescription}>
                    {s.description}
                  </div>
                </div>
                <button
                  className={styles.addSuggestionBtn}
                  onClick={() => handleAddAiSuggestion(s)}
                >
                  + Add
                </button>
              </div>
            ))
          ) : (
            <div className={styles.loading}>
              No suggestions available. Try again later.
            </div>
          )}
        </div>
      )}

      {/* ── Two-Column Wounds Display ── */}
      <div className={styles.twoColumnGrid}>
        {/* ── My Wounds Column ── */}
        <div className={styles.woundsColumn}>
          <div className={styles.columnHeader}>
            <span className={styles.columnIcon}>👤</span>
            <span>{userName}&apos;s Wounds ({activeWounds.length})</span>
          </div>

          {activeWounds.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyEmoji}>🩹</div>
              <h3>No wounds yet</h3>
              <p>Add your first wound to begin understanding how your past shapes your relationship.</p>
            </div>
          ) : (
            <div className={styles.woundsGrid}>
              {activeWounds.map((wound) => (
                <div key={wound.id} className={styles.woundCard}>
                  {editingId === wound.id ? (
                    /* Edit Mode */
                    <div className={styles.formGrid}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={styles.formInput}
                        id={`edit-wound-title-${wound.id}`}
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className={styles.formTextarea}
                        id={`edit-wound-description-${wound.id}`}
                      />
                      <div className={styles.intensityRow}>
                        <label htmlFor={`edit-wound-intensity-${wound.id}`} className={styles.intensityLabel}>
                          Intensity: <strong>{editIntensity}</strong>/10
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={editIntensity}
                          onChange={(e) => setEditIntensity(Number(e.target.value))}
                          className={styles.intensitySlider}
                          id={`edit-wound-intensity-${wound.id}`}
                        />
                      </div>
                      <div className={styles.formFooter}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleEditWound(wound.id)}
                          disabled={submitting || !editTitle.trim()}
                        >
                          {submitting ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                      <div className={styles.woundHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                          <div className={styles.woundTitle}>{wound.title}</div>
                          <span className={styles.intensityBadge} data-level={wound.intensity >= 7 ? "high" : wound.intensity >= 4 ? "mid" : "low"}>
                            {wound.intensity}/10
                          </span>
                        </div>
                        <div className={styles.woundActions}>
                          <button
                            className={styles.woundActionBtn}
                            onClick={() => startEditing(wound)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className={styles.woundActionBtn}
                            onClick={() => handleDeleteWound(wound.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      {wound.description && (
                        <div className={styles.woundDescription}>
                          {wound.description}
                        </div>
                      )}
                      <div className={styles.woundMeta}>
                        <span
                          className={`${styles.sourceBadge} ${
                            styles[SOURCE_LABELS[wound.source]?.className || "sourceSelf"]
                          }`}
                        >
                          {SOURCE_LABELS[wound.source]?.label || wound.source}
                        </span>
                        <span className={styles.woundDate}>
                          {formatDate(wound.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Partner's Wounds Column ── */}
        <div className={styles.woundsColumn}>
          <div className={`${styles.columnHeader} ${styles.columnHeaderPartner}`}>
            <span className={styles.columnIcon}>💕</span>
            <span>{partnerName || "Partner"}&apos;s Wounds ({partnerWounds.length})</span>
          </div>

          {!partnerName ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyEmoji}>💑</div>
              <h3>No partner yet</h3>
              <p>Invite your partner to see their childhood wounds here.</p>
            </div>
          ) : partnerWounds.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyEmoji}>🌱</div>
              <h3>No wounds added yet</h3>
              <p>{partnerName} hasn&apos;t added any childhood wounds yet.</p>
            </div>
          ) : (
            <div className={styles.woundsGrid}>
              {partnerWounds.map((wound) => (
                <div key={wound.id} className={`${styles.woundCard} ${styles.partnerWoundCard}`}>
                  <div className={styles.woundHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      <div className={styles.woundTitle}>{wound.title}</div>
                      <span className={styles.intensityBadge} data-level={wound.intensity >= 7 ? "high" : wound.intensity >= 4 ? "mid" : "low"}>
                        {wound.intensity}/10
                      </span>
                    </div>
                  </div>
                  {wound.description && (
                    <div className={styles.woundDescription}>
                      {wound.description}
                    </div>
                  )}
                  <div className={styles.woundMeta}>
                    <span
                      className={`${styles.sourceBadge} ${
                        styles[SOURCE_LABELS[wound.source]?.className || "sourceSelf"]
                      }`}
                    >
                      {SOURCE_LABELS[wound.source]?.label || wound.source}
                    </span>
                    <span className={styles.woundDate}>
                      {formatDate(wound.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
