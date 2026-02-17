"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../challenges.module.css";
import { useChallengeSocket } from "@/lib/hooks/useChallengeSocket";

/* ── Types ── */
interface Perspective {
  id: string;
  userId: string;
  perspectiveText: string | null;
  submitted: boolean;
  submittedAt: string | null;
  userName: string | null;
}

interface Message {
  id: string;
  senderId: string | null;
  senderType: "user" | "ai";
  content: string;
  pinned: boolean;
  createdAt: string;
  senderName: string | null;
}

interface Request {
  id: string;
  requestedBy: string;
  requestText: string;
  category: string;
  acceptedByPartner: boolean;
  fulfilled: boolean;
  createdAt: string;
  requestedByName: string | null;
}

interface Member {
  userId: string;
  role: string;
  colorCode: string;
  userName: string | null;
}

interface ChallengeDetail {
  id: string;
  coupleId: string;
  createdBy: string;
  title: string;
  category: string;
  status: string;
  aiNeutralDescription: string | null;
  acceptedByA: boolean;
  acceptedByB: boolean;
  rejectionFeedback: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  perspectives: Perspective[];
  messages: Message[];
  requests: Request[];
  members: Member[];
  currentUserPartner: "a" | "b";
  bothPerspectivesSubmitted: boolean;
}

const PHASES = ["created", "perspectives", "submitted", "synthesis", "review", "discussion", "commitments", "resolved"];
const PHASE_LABELS = ["Created", "Perspectives", "Submitted", "Synthesis", "Review", "Discussion", "Commitments", "Resolved"];

const CATEGORY_LABELS: Record<string, string> = {
  apology: "Apology",
  behavior_change: "Behavior Change",
  reassurance: "Reassurance",
  boundary: "Boundary",
  other: "Other",
};

export default function ChallengeWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [challengeId, setChallengeId] = useState("");
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Perspective writing
  const [perspectiveText, setPerspectiveText] = useState("");
  const [saving, setSaving] = useState(false);

  // Synthesis
  const [synthesisStreaming, setSynthesisStreaming] = useState(false);
  const [synthesisText, setSynthesisText] = useState("");
  const autoSynthesisTriggered = useRef(false);

  // Accept/Reject
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Discussion
  const [messageInput, setMessageInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Requests
  const [newRequestText, setNewRequestText] = useState("");
  const [newRequestCategory, setNewRequestCategory] = useState("other");

  // Resolve
  const [resolveNotes, setResolveNotes] = useState("");

  useEffect(() => {
    params.then((p) => setChallengeId(p.id));
  }, [params]);

  const fetchChallenge = useCallback(async () => {
    if (!challengeId) return;
    try {
      const res = await fetch(`/api/challenges/${challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
        // Pre-fill perspective text if we have a draft
        const mine = data.perspectives?.find(
          (p: Perspective) => p.userId === (data.currentUserPartner === "a" ? data.members[0]?.userId : data.members[1]?.userId)
        );
        if (mine && !mine.submitted && mine.perspectiveText) {
          setPerspectiveText(mine.perspectiveText);
        }
      } else if (res.status === 404) {
        router.push("/challenges");
      }
    } catch (err) {
      console.error("Failed to load challenge:", err);
    } finally {
      setLoading(false);
    }
  }, [challengeId, router]);

  useEffect(() => {
    if (challengeId) fetchChallenge();
  }, [challengeId, fetchChallenge]);

  // Compute IDs for socket hook (need these before render)
  const coupleId = challenge?.coupleId;
  const currentUserId = challenge
    ? (challenge.currentUserPartner === "a"
      ? challenge.members[0]?.userId
      : challenge.members[1]?.userId)
    : undefined;

  // Real-time updates: auto-refetch when partner takes action
  useChallengeSocket(coupleId, challengeId, currentUserId, fetchChallenge);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [challenge?.messages, streamingText]);

  // Auto-trigger synthesis when both perspectives are submitted
  useEffect(() => {
    if (
      challenge?.status === "submitted" &&
      !synthesisStreaming &&
      !autoSynthesisTriggered.current
    ) {
      autoSynthesisTriggered.current = true;
      generateSynthesis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.status]);

  /* ── Phase Index ── */
  const currentPhaseIndex = PHASES.indexOf(challenge?.status || "created");

  /* ── Helpers ── */
  function getMyPerspective() {
    if (!challenge) return null;
    const myUserId = challenge.currentUserPartner === "a"
      ? challenge.members[0]?.userId
      : challenge.members[1]?.userId;
    return challenge.perspectives.find((p) => p.userId === myUserId) || null;
  }

  function getPartnerPerspective() {
    if (!challenge) return null;
    const myUserId = challenge.currentUserPartner === "a"
      ? challenge.members[0]?.userId
      : challenge.members[1]?.userId;
    return challenge.perspectives.find((p) => p.userId !== myUserId) || null;
  }

  function getMyAccepted() {
    if (!challenge) return false;
    return challenge.currentUserPartner === "a" ? challenge.acceptedByA : challenge.acceptedByB;
  }

  function getPartnerAccepted() {
    if (!challenge) return false;
    return challenge.currentUserPartner === "a" ? challenge.acceptedByB : challenge.acceptedByA;
  }

  function getMemberForMessage(msg: Message): { label: string; partner: "a" | "b" | "ai" } {
    if (msg.senderType === "ai") return { label: "Kuxani", partner: "ai" };
    const isA = msg.senderId === challenge?.members[0]?.userId;
    return {
      label: msg.senderName || (isA ? "Partner A" : "Partner B"),
      partner: isA ? "a" : "b",
    };
  }

  /* ── Actions ── */
  async function savePerspective(submit: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/perspectives`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perspectiveText, submit }),
      });
      if (res.ok) {
        await fetchChallenge();
      }
    } catch (err) {
      console.error("Failed to save perspective:", err);
    } finally {
      setSaving(false);
    }
  }

  async function generateSynthesis() {
    setSynthesisStreaming(true);
    setSynthesisText("");

    try {
      const res = await fetch(`/api/challenges/${challengeId}/synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Failed to generate synthesis");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                full += parsed.text;
                setSynthesisText(full);
              }
            } catch { /* skip */ }
          }
        }
      }

      await fetchChallenge();
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setSynthesisStreaming(false);
    }
  }

  async function handleAcceptReject(accept: boolean) {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept,
          rejectionReason: accept ? undefined : rejectionReason,
        }),
      });

      if (res.ok) {
        setShowRejectForm(false);
        setRejectionReason("");
        await fetchChallenge();
      }
    } catch (err) {
      console.error("Accept/reject error:", err);
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || streaming) return;
    setMessageInput("");
    setStreaming(true);
    setStreamingText("");

    if (textareaRef.current) textareaRef.current.style.height = "44px";

    try {
      const res = await fetch(`/api/challenges/${challengeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!res.ok) throw new Error("Failed to send");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                full += parsed.text;
                setStreamingText(full);
              }
            } catch { /* skip */ }
          }
        }
      }

      setStreamingText("");
      await fetchChallenge();
    } catch (err) {
      console.error("Message error:", err);
    } finally {
      setStreaming(false);
    }
  }

  async function submitRequest() {
    if (!newRequestText.trim()) return;
    try {
      await fetch(`/api/challenges/${challengeId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestText: newRequestText.trim(),
          category: newRequestCategory,
        }),
      });
      setNewRequestText("");
      setNewRequestCategory("other");
      await fetchChallenge();
    } catch (err) {
      console.error("Request error:", err);
    }
  }

  async function updateRequest(requestId: string, updates: Record<string, boolean>) {
    try {
      await fetch(`/api/challenges/${challengeId}/requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...updates }),
      });
      await fetchChallenge();
    } catch (err) {
      console.error("Request update error:", err);
    }
  }

  async function resolveChallenge() {
    if (!resolveNotes.trim()) return;
    try {
      await fetch(`/api/challenges/${challengeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNotes: resolveNotes.trim() }),
      });
      await fetchChallenge();
    } catch (err) {
      console.error("Resolve error:", err);
    }
  }

  /* ── Markdown-like renderer ── */
  function renderContent(text: string) {
    return text.split("\n\n").map((para, i) => {
      if (para.match(/^[-*•]\s/m)) {
        const items = para.split(/\n/).filter((l) => l.trim());
        return <ul key={i}>{items.map((item, j) => <li key={j}>{formatInline(item.replace(/^[-*•]\s/, ""))}</li>)}</ul>;
      }
      if (para.match(/^#{1,3}\s/)) {
        const level = para.match(/^(#{1,3})\s/)![1].length;
        const text = para.replace(/^#{1,3}\s/, "");
        if (level === 1) return <h2 key={i}>{text}</h2>;
        if (level === 2) return <h3 key={i}>{text}</h3>;
        return <h4 key={i}>{text}</h4>;
      }
      return <p key={i}>{formatInline(para)}</p>;
    });
  }

  function formatInline(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  /* ── Loading ── */
  if (loading || !challenge) {
    return (
      <div className={styles.workspace}>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const myPerspective = getMyPerspective();
  const partnerPerspective = getPartnerPerspective();
  const myAccepted = getMyAccepted();
  const partnerAccepted = getPartnerAccepted();
  const myUserId = challenge.currentUserPartner === "a"
    ? challenge.members[0]?.userId
    : challenge.members[1]?.userId;

  return (
    <div className={styles.workspace}>
      {/* ── Header ── */}
      <div className={styles.workspaceHeader}>
        <Link href="/challenges" className={styles.backBtn}>←</Link>
        <div className={styles.workspaceTitle}>
          <h1 className="heading-2">{challenge.title}</h1>
          <div className={styles.challengeMeta}>
            <span className={styles.categoryBadge}>{challenge.category.replace("_", " ")}</span>
            <span className={`${styles.statusBadge} ${getStatusClass(challenge.status)}`}>
              {PHASE_LABELS[currentPhaseIndex] || challenge.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div>
        <div className={styles.progressBar}>
          {PHASES.map((phase, i) => (
            <div
              key={phase}
              className={`${styles.progressStep} ${
                i < currentPhaseIndex ? styles.progressStepDone :
                i === currentPhaseIndex ? styles.progressStepActive : ""
              }`}
            />
          ))}
        </div>
        <div className={styles.progressLabels}>
          {PHASE_LABELS.map((label, i) => (
            <span
              key={label}
              className={`${styles.progressLabel} ${
                i < currentPhaseIndex ? styles.progressLabelDone :
                i === currentPhaseIndex ? styles.progressLabelActive : ""
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
         Phase: Created / Perspectives / Submitted
         ══════════════════════════════════════ */}
      {(challenge.status === "created" || challenge.status === "perspectives" || challenge.status === "submitted") && (
        <div className={styles.perspectiveSection}>
          {/* My Perspective */}
          <div className={`${styles.perspectiveCard} ${
            challenge.currentUserPartner === "a" ? styles.perspectiveCardMine : styles.perspectiveCardPartner
          }`}>
            <div className={`${styles.perspectiveLabel} ${
              challenge.currentUserPartner === "a" ? styles.perspectiveLabelA : styles.perspectiveLabelB
            }`}>
              ✍️ Your Perspective
            </div>

            {myPerspective?.submitted ? (
              <>
                <div className={styles.submittedBadge}>✅ Submitted</div>
                <div style={{ marginTop: "var(--space-md)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
                  {myPerspective.perspectiveText}
                </div>
              </>
            ) : (
              <>
                <p className={styles.perspectivePrompts}>
                  💡 What happened? How did it make you feel? What do you need?
                </p>
                <textarea
                  className={styles.perspectiveTextarea}
                  value={perspectiveText}
                  onChange={(e) => setPerspectiveText(e.target.value)}
                  placeholder="Write your perspective honestly and openly. Your partner won't see this until they've also submitted theirs…"
                />
                <div className={styles.perspectiveActions}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => savePerspective(false)}
                    disabled={saving}
                  >
                    Save Draft
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => savePerspective(true)}
                    disabled={saving || !perspectiveText.trim()}
                  >
                    {saving ? "Saving…" : "Submit Perspective"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Partner's Perspective */}
          <div className={`${styles.perspectiveCard} ${
            challenge.currentUserPartner === "a" ? styles.perspectiveCardPartner : styles.perspectiveCardMine
          }`}>
            <div className={`${styles.perspectiveLabel} ${
              challenge.currentUserPartner === "a" ? styles.perspectiveLabelB : styles.perspectiveLabelA
            }`}>
              👤 Partner&apos;s Perspective
            </div>

            {partnerPerspective?.submitted && challenge.bothPerspectivesSubmitted ? (
              <>
                <div className={styles.submittedBadge}>✅ Submitted</div>
                <div style={{ marginTop: "var(--space-md)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
                  {partnerPerspective.perspectiveText}
                </div>
              </>
            ) : partnerPerspective?.submitted ? (
              <div className={styles.submittedBadge}>✅ Submitted — hidden until you submit too</div>
            ) : (
              <div className={styles.waitingBadge}>⏳ Waiting for partner to write…</div>
            )}
          </div>
        </div>
      )}

      {/* Auto-generating synthesis when both submitted */}
      {challenge.status === "submitted" && (
        <div className={styles.centerAction}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", justifyContent: "center" }}>
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <p className="text-muted" style={{ margin: 0 }}>✨ Both perspectives are in! Generating AI synthesis…</p>
          </div>
          {synthesisText && (
            <div className={styles.synthesisContent} style={{ marginTop: "var(--space-lg)", textAlign: "left" }}>
              {renderContent(synthesisText)}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
         Phase: Synthesis / Review
         ══════════════════════════════════════ */}
      {(challenge.status === "synthesis" || challenge.status === "review") && (
        <div className={styles.synthesisCard}>
          <div className={styles.synthesisHeader}>
            <span style={{ fontSize: "1.5rem" }}>🤖</span>
            <h2 className="heading-3">Neutral Synthesis</h2>
          </div>

          <div className={styles.synthesisContent}>
            {synthesisStreaming
              ? renderContent(synthesisText)
              : challenge.aiNeutralDescription
                ? renderContent(challenge.aiNeutralDescription)
                : <p className="text-muted">No synthesis generated yet.</p>
            }
          </div>

          {/* Rejection feedback warning */}
          {challenge.rejectionFeedback && (
            <div className={styles.rejectionArea}>
              <strong style={{ color: "var(--error)" }}>⚠️ A partner requested changes:</strong>
              <p style={{ marginTop: "var(--space-xs)", fontSize: "0.875rem" }}>
                {challenge.rejectionFeedback}
              </p>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: "var(--space-sm)" }}
                onClick={generateSynthesis}
                disabled={synthesisStreaming}
              >
                {synthesisStreaming ? "Regenerating…" : "🔄 Regenerate with Feedback"}
              </button>
            </div>
          )}

          {/* Acceptance status */}
          <div className={styles.acceptanceStatus}>
            <span className={`${styles.acceptBadge} ${myAccepted ? styles.acceptBadgeAccepted : styles.acceptBadgePending}`}>
              {myAccepted ? "✅ You accepted" : "⏳ Your review pending"}
            </span>
            <span className={`${styles.acceptBadge} ${partnerAccepted ? styles.acceptBadgeAccepted : styles.acceptBadgePending}`}>
              {partnerAccepted ? "✅ Partner accepted" : "⏳ Partner review pending"}
            </span>
          </div>

          {/* Accept/Reject actions */}
          {!myAccepted && !challenge.rejectionFeedback && (
            <div className={styles.synthesisActions}>
              <button
                className="btn btn-primary"
                onClick={() => handleAcceptReject(true)}
              >
                ✅ Accept Synthesis
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowRejectForm(!showRejectForm)}
              >
                ✏️ Request Changes
              </button>
            </div>
          )}

          {showRejectForm && (
            <div className={styles.rejectionArea}>
              <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                What doesn&apos;t feel accurate? Your feedback helps the AI improve the synthesis.
              </p>
              <textarea
                className={styles.rejectionTextarea}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., 'My feelings about X weren't captured accurately. I felt more hurt than angry…'"
              />
              <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleAcceptReject(false)}
                  disabled={!rejectionReason.trim()}
                >
                  Submit Feedback & Regenerate
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
         Phase: Discussion
         ══════════════════════════════════════ */}
      {(challenge.status === "discussion" || challenge.status === "commitments") && (
        <>
          {/* Show accepted synthesis as context */}
          {challenge.aiNeutralDescription && (
            <details className={styles.sectionCard}>
              <summary className={styles.sectionHeader} style={{ cursor: "pointer" }}>
                <span>🤖</span>
                <span className="heading-3">Accepted Synthesis</span>
              </summary>
              <div className={styles.synthesisContent} style={{ marginTop: "var(--space-md)" }}>
                {renderContent(challenge.aiNeutralDescription)}
              </div>
            </details>
          )}

          {/* Discussion Thread */}
          <div className={styles.discussionArea}>
            <div className={styles.messageList}>
              {challenge.messages.length === 0 && !streaming && (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-muted)" }}>
                  <p>💬 Start discussing the synthesis with your partner.</p>
                  <p style={{ fontSize: "0.8125rem", marginTop: "var(--space-xs)" }}>
                    Kuxani will provide therapeutic guidance throughout.
                  </p>
                </div>
              )}

              {challenge.messages.map((msg) => {
                const { label, partner } = getMemberForMessage(msg);
                return (
                  <div
                    key={msg.id}
                    className={`${styles.messageWrapper} ${
                      msg.senderType === "user" && msg.senderId === myUserId ? styles.messageWrapperUser : ""
                    }`}
                  >
                    <div className={`${styles.messageAvatar} ${
                      partner === "ai" ? styles.messageAvatarAi :
                      partner === "a" ? styles.messageAvatarA : styles.messageAvatarB
                    }`}>
                      {partner === "ai" ? "🌿" : partner === "a" ? "💜" : "💗"}
                    </div>
                    <div className={`${styles.messageBubble} ${
                      partner === "ai" ? styles.messageBubbleAi :
                      partner === "a" ? styles.messageBubbleA : styles.messageBubbleB
                    }`}>
                      <div className={`${styles.messageSenderName} ${
                        partner === "a" ? styles.messageSenderNameA : styles.messageSenderNameB
                      }`}>
                        {msg.senderType === "ai" ? "Kuxani 🌿" : label}
                      </div>
                      {msg.senderType === "ai" ? renderContent(msg.content) : msg.content}
                    </div>
                  </div>
                );
              })}

              {/* Streaming AI */}
              {streaming && (
                <div className={styles.messageWrapper}>
                  <div className={`${styles.messageAvatar} ${styles.messageAvatarAi}`}>🌿</div>
                  <div className={`${styles.messageBubble} ${styles.messageBubbleAi}`}>
                    <div className={styles.messageSenderName}>Kuxani 🌿</div>
                    {streamingText ? renderContent(streamingText) : (
                      <div className={styles.typingIndicator}>
                        <div className={styles.typingDot} />
                        <div className={styles.typingDot} />
                        <div className={styles.typingDot} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <textarea
                ref={textareaRef}
                className={styles.chatInput}
                value={messageInput}
                onChange={(e) => {
                  e.target.style.height = "44px";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                  setMessageInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(messageInput);
                  }
                }}
                placeholder="Share your thoughts…"
                rows={1}
                disabled={streaming}
              />
              <button
                className={styles.sendBtn}
                onClick={() => sendMessage(messageInput)}
                disabled={!messageInput.trim() || streaming}
              >
                ↑
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════
             Requests & Commitments
             ══════════════════════════════════════ */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span>🤝</span>
              <h2 className="heading-3">Requests & Commitments</h2>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: "var(--space-md)" }}>
              What do you need from your partner to forgive and move forward?
            </p>

            <div className={styles.requestsSection}>
              {/* My Requests */}
              <div className={`${styles.requestColumn} ${
                challenge.currentUserPartner === "a" ? styles.requestColumnA : styles.requestColumnB
              }`}>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
                  Your Requests
                </h4>
                {challenge.requests
                  .filter((r) => r.requestedBy === myUserId)
                  .map((r) => (
                    <div key={r.id} className={styles.requestItem}>
                      <div className={styles.requestText}>
                        {r.requestText}
                        <br />
                        <span className={styles.requestCategoryBadge}>{CATEGORY_LABELS[r.category] || r.category}</span>
                        {r.acceptedByPartner && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Accepted</span>}
                        {r.fulfilled && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Fulfilled</span>}
                      </div>
                    </div>
                  ))}

                <div className={styles.newRequestForm}>
                  <textarea
                    className={styles.newRequestInput}
                    value={newRequestText}
                    onChange={(e) => setNewRequestText(e.target.value)}
                    placeholder="What do you need from your partner?"
                  />
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                    <select
                      className={styles.formSelect}
                      value={newRequestCategory}
                      onChange={(e) => setNewRequestCategory(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="apology">Apology</option>
                      <option value="behavior_change">Behavior Change</option>
                      <option value="reassurance">Reassurance</option>
                      <option value="boundary">Boundary</option>
                      <option value="other">Other</option>
                    </select>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={submitRequest}
                      disabled={!newRequestText.trim()}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>

              {/* Partner's Requests */}
              <div className={`${styles.requestColumn} ${
                challenge.currentUserPartner === "a" ? styles.requestColumnB : styles.requestColumnA
              }`}>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
                  Partner&apos;s Requests
                </h4>
                {challenge.requests
                  .filter((r) => r.requestedBy !== myUserId)
                  .map((r) => (
                    <div key={r.id} className={styles.requestItem}>
                      <div className={styles.requestText}>
                        {r.requestText}
                        <br />
                        <span className={styles.requestCategoryBadge}>{CATEGORY_LABELS[r.category] || r.category}</span>
                      </div>
                      <div className={styles.requestActions}>
                        {!r.acceptedByPartner && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => updateRequest(r.id, { acceptedByPartner: true })}
                          >
                            Accept
                          </button>
                        )}
                        {r.acceptedByPartner && !r.fulfilled && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => updateRequest(r.id, { fulfilled: true })}
                          >
                            ✅ Mark Done
                          </button>
                        )}
                        {r.fulfilled && (
                          <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>
                            Fulfilled ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                {challenge.requests.filter((r) => r.requestedBy !== myUserId).length === 0 && (
                  <p className="text-muted text-sm">No requests from your partner yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Resolve button */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span>🕊️</span>
              <h2 className="heading-3">Resolve this Challenge</h2>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: "var(--space-md)" }}>
              Once commitments are accepted, share what you&apos;ve learned and mark this challenge as resolved.
            </p>
            <textarea
              className={styles.resolveTextarea}
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="What did you learn from this challenge? What will you do differently?"
            />
            <button
              className="btn btn-primary"
              onClick={resolveChallenge}
              disabled={!resolveNotes.trim()}
            >
              🕊️ Mark as Resolved
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
         Phase: Resolved — Full Detail View
         ══════════════════════════════════════ */}
      {challenge.status === "resolved" && (
        <div className={styles.resolvedSections}>
          {/* Resolution Header */}
          <div className={styles.resolutionCard}>
            <div className={styles.resolutionIcon}>🕊️</div>
            <h2 className="heading-2">Challenge Resolved</h2>
            <p className="text-muted" style={{ marginTop: "var(--space-sm)" }}>
              Resolved on {challenge.resolvedAt ? new Date(challenge.resolvedAt).toLocaleDateString() : "—"}
            </p>
            {challenge.resolutionNotes && (
              <div className={styles.resolutionNotes}>
                <strong>Lessons learned:</strong>
                <p style={{ marginTop: "var(--space-sm)" }}>{challenge.resolutionNotes}</p>
              </div>
            )}
          </div>

          {/* ── Perspectives ── */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span>✍️</span>
              <h2 className="heading-3">Perspectives</h2>
            </div>
            <div className={styles.perspectiveSection}>
              {challenge.perspectives.map((p) => {
                const isA = p.userId === challenge.members[0]?.userId;
                return (
                  <div
                    key={p.id}
                    className={`${styles.perspectiveCard} ${isA ? styles.perspectiveCardMine : styles.perspectiveCardPartner}`}
                  >
                    <div className={`${styles.perspectiveLabel} ${isA ? styles.perspectiveLabelA : styles.perspectiveLabelB}`}>
                      {isA ? "💜" : "💗"} {p.userName || (isA ? "Partner A" : "Partner B")}
                    </div>
                    <div style={{ marginTop: "var(--space-md)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
                      {p.perspectiveText || <span className="text-muted">No perspective submitted.</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Synthesis ── */}
          {challenge.aiNeutralDescription && (
            <div className={styles.synthesisCard}>
              <div className={styles.synthesisHeader}>
                <span style={{ fontSize: "1.5rem" }}>🤖</span>
                <h2 className="heading-3">AI Synthesis</h2>
              </div>
              <div className={styles.synthesisContent}>
                {renderContent(challenge.aiNeutralDescription)}
              </div>
            </div>
          )}

          {/* ── Discussion ── */}
          {challenge.messages.length > 0 && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <span>💬</span>
                <h2 className="heading-3">Discussion</h2>
              </div>
              <div className={styles.resolvedDiscussion}>
                <div className={styles.messageList}>
                  {challenge.messages.map((msg) => {
                    const { label, partner } = getMemberForMessage(msg);
                    return (
                      <div
                        key={msg.id}
                        className={`${styles.messageWrapper} ${
                          msg.senderType === "user" && msg.senderId === myUserId ? styles.messageWrapperUser : ""
                        }`}
                      >
                        <div className={`${styles.messageAvatar} ${
                          partner === "ai" ? styles.messageAvatarAi :
                          partner === "a" ? styles.messageAvatarA : styles.messageAvatarB
                        }`}>
                          {partner === "ai" ? "🌿" : partner === "a" ? "💜" : "💗"}
                        </div>
                        <div className={`${styles.messageBubble} ${
                          partner === "ai" ? styles.messageBubbleAi :
                          partner === "a" ? styles.messageBubbleA : styles.messageBubbleB
                        }`}>
                          <div className={`${styles.messageSenderName} ${
                            partner === "a" ? styles.messageSenderNameA : styles.messageSenderNameB
                          }`}>
                            {msg.senderType === "ai" ? "Kuxani 🌿" : label}
                          </div>
                          {msg.senderType === "ai" ? renderContent(msg.content) : msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Commitments ── */}
          {challenge.requests.length > 0 && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <span>🤝</span>
                <h2 className="heading-3">Commitments</h2>
              </div>
              <div className={styles.requestsSection}>
                {/* Partner A's Requests */}
                <div className={`${styles.requestColumn} ${styles.requestColumnA}`}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
                    {challenge.members[0]?.userName || "Partner A"}&apos;s Requests
                  </h4>
                  {challenge.requests
                    .filter((r) => r.requestedBy === challenge.members[0]?.userId)
                    .map((r) => (
                      <div key={r.id} className={styles.requestItem}>
                        <div className={styles.requestText}>
                          {r.requestText}
                          <br />
                          <span className={styles.requestCategoryBadge}>{CATEGORY_LABELS[r.category] || r.category}</span>
                          {r.acceptedByPartner && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Accepted</span>}
                          {r.fulfilled && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Fulfilled ✓</span>}
                        </div>
                      </div>
                    ))}
                  {challenge.requests.filter((r) => r.requestedBy === challenge.members[0]?.userId).length === 0 && (
                    <p className="text-muted text-sm">No requests.</p>
                  )}
                </div>

                {/* Partner B's Requests */}
                <div className={`${styles.requestColumn} ${styles.requestColumnB}`}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
                    {challenge.members[1]?.userName || "Partner B"}&apos;s Requests
                  </h4>
                  {challenge.requests
                    .filter((r) => r.requestedBy === challenge.members[1]?.userId)
                    .map((r) => (
                      <div key={r.id} className={styles.requestItem}>
                        <div className={styles.requestText}>
                          {r.requestText}
                          <br />
                          <span className={styles.requestCategoryBadge}>{CATEGORY_LABELS[r.category] || r.category}</span>
                          {r.acceptedByPartner && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Accepted</span>}
                          {r.fulfilled && <span className={styles.requestCategoryBadge} style={{ background: "var(--success-light)", color: "var(--success)" }}>Fulfilled ✓</span>}
                        </div>
                      </div>
                    ))}
                  {challenge.requests.filter((r) => r.requestedBy === challenge.members[1]?.userId).length === 0 && (
                    <p className="text-muted text-sm">No requests.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ textAlign: "center" }}>
            <Link
              href="/challenges"
              className="btn btn-secondary"
              style={{ marginTop: "var(--space-md)" }}
            >
              ← Back to Challenges
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper (outside component) ── */
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
