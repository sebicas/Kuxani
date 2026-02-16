"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../disagreements.module.css";
import { useDisagreementSocket } from "@/lib/hooks/useDisagreementSocket";
import PartnerActivityBar from "@/components/PartnerActivityBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceSession } from "@/lib/hooks/useVoiceSession";
import { getSocket } from "@/lib/socket/socketClient";
import { PARTNER_ACTIVITY } from "@/lib/socket/events";

/* ── Types ── */
interface MessageItem {
  id: string;
  senderId: string | null;
  senderType: "user" | "ai" | "system";
  content: string;
  visibleTo: string;
  createdAt: string;
  senderName: string | null;
}

interface DisagreementDetail {
  id: string;
  userId: string;
  coupleId: string | null;
  title: string | null;
  category: string;
  status: string;
  visibility: string;
  creatorPerspective: string | null;
  partnerPerspective: string | null;
  aiSummary: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  creatorName: string | null;
  messageCount: number;
  isCreator: boolean;
}

const STATUS_LABELS: Record<string, { label: string; desc: string }> = {
  intake: { label: "Starting", desc: "Share what's on your mind" },
  clarifying: { label: "Exploring", desc: "Let's understand this better" },
  confirmed: { label: "Confirmed", desc: "Ready to invite your partner" },
  invite_sent: { label: "Invited", desc: "Waiting for partner to join" },
  partner_joined: { label: "Together", desc: "Both partners are here" },
  active: { label: "Active", desc: "Working through it together" },
  resolving: { label: "Resolving", desc: "Finding common ground" },
  resolved: { label: "Resolved", desc: "Great work! 🎉" },
};

const PHASES = ["intake", "clarifying", "confirmed", "invite_sent", "partner_joined", "active", "resolving", "resolved"];
const PHASE_LABELS = ["Start", "Explore", "Confirm", "Invite", "Joined", "Active", "Resolve", "Done"];

export default function DisagreementChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [disagreementId, setDisagreementId] = useState("");
  const [disagreement, setDisagreement] = useState<DisagreementDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Chat
  const [messageInput, setMessageInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Invite
  const [inviting, setInviting] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Voice — append transcript to message input
  const handleVoiceTranscript = useCallback((text: string) => {
    setMessageInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const voice = useVoiceSession({
    disagreementId: disagreementId || "",
    currentUserId,
    isShared: disagreement?.visibility === "shared",
    onTranscript: handleVoiceTranscript,
  });

  useEffect(() => {
    params.then((p) => setDisagreementId(p.id));
  }, [params]);

  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});
  }, []);

  const fetchDisagreement = useCallback(async () => {
    if (!disagreementId) return;
    try {
      const [detailRes, msgRes] = await Promise.all([
        fetch(`/api/disagreements/${disagreementId}`),
        fetch(`/api/disagreements/${disagreementId}/messages`),
      ]);

      if (detailRes.ok) {
        setDisagreement(await detailRes.json());
      } else if (detailRes.status === 404) {
        router.push("/disagreements");
        return;
      }
      if (msgRes.ok) {
        setMessages(await msgRes.json());
      }
    } catch (err) {
      console.error("Failed to load disagreement:", err);
    } finally {
      setLoading(false);
    }
  }, [disagreementId, router]);

  useEffect(() => {
    if (disagreementId) fetchDisagreement();
  }, [disagreementId, fetchDisagreement]);

  // Real-time updates
  useDisagreementSocket(
    disagreement?.coupleId,
    disagreementId || null,
    currentUserId,
    fetchDisagreement
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Emit "online" activity when entering the chat
  useEffect(() => {
    if (!disagreementId || !currentUserId || !disagreement?.visibility || disagreement.visibility !== "shared") return;
    const socket = getSocket();
    socket.emit(PARTNER_ACTIVITY, {
      disagreementId,
      userId: currentUserId,
      activity: "online",
    });
    return () => {
      socket.emit(PARTNER_ACTIVITY, {
        disagreementId,
        userId: currentUserId,
        activity: "offline",
      });
    };
  }, [disagreementId, currentUserId, disagreement?.visibility]);

  /* ── Markdown-like renderer ── */
  function renderContent(text: string) {
    return text.split("\n\n").map((para, i) => {
      if (para.match(/^[-*•]\s/m)) {
        const items = para.split(/\n/).filter((l) => l.trim());
        return (
          <ul key={i}>
            {items.map((item, j) => (
              <li key={j}>{formatInline(item.replace(/^[-*•]\s/, ""))}</li>
            ))}
          </ul>
        );
      }
      if (para.match(/^#{1,3}\s/)) {
        const level = para.match(/^(#{1,3})\s/)![1].length;
        const heading = para.replace(/^#{1,3}\s/, "");
        if (level === 1) return <h2 key={i}>{heading}</h2>;
        if (level === 2) return <h3 key={i}>{heading}</h3>;
        return <h4 key={i}>{heading}</h4>;
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

  /* ── Send Message ── */
  async function sendMessage(content: string) {
    if (!content.trim() || streaming) return;
    setMessageInput("");
    setStreaming(true);
    setStreamingText("");

    if (textareaRef.current) textareaRef.current.style.height = "44px";

    try {
      const res = await fetch(`/api/disagreements/${disagreementId}/messages`, {
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
      await fetchDisagreement();
    } catch (err) {
      console.error("Message error:", err);
    } finally {
      setStreaming(false);
    }
  }

  /* ── Invite Partner ── */
  async function invitePartner() {
    setInviting(true);
    try {
      const res = await fetch(`/api/disagreements/${disagreementId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detailLevel: "summary" }),
      });
      if (res.ok) {
        await fetchDisagreement();
      }
    } catch (err) {
      console.error("Invite error:", err);
    } finally {
      setInviting(false);
    }
  }

  /* ── Resolve ── */
  async function resolveDisagreement() {
    setResolving(true);
    try {
      const res = await fetch(`/api/disagreements/${disagreementId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchDisagreement();
      }
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setResolving(false);
    }
  }

  /* ── Phase Index ── */
  const currentPhaseIndex = PHASES.indexOf(disagreement?.status || "intake");
  const statusInfo = STATUS_LABELS[disagreement?.status || "intake"];

  /* ── Loading ── */
  if (loading || !disagreement) {
    return (
      <div className={styles.chatWorkspace}>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const canInvite =
    disagreement.isCreator &&
    ["clarifying", "confirmed"].includes(disagreement.status);

  const canResolve =
    ["partner_joined", "active", "resolving"].includes(disagreement.status);

  const isResolved = disagreement.status === "resolved";

  return (
    <div className={styles.chatWorkspace}>
      {/* ── Header ── */}
      <div className={styles.chatHeader}>
        <Link href="/disagreements" className={styles.backBtn}>←</Link>
        <div className={styles.chatHeaderInfo}>
          <h1 className={styles.chatTitle}>
            {disagreement.title || `${disagreement.category.charAt(0).toUpperCase() + disagreement.category.slice(1)} Conversation`}
          </h1>
          <div className={styles.chatSubtitle}>
            <span className={`${styles.statusPill} ${styles[`statusPill${disagreement.status.charAt(0).toUpperCase() + disagreement.status.slice(1).replace(/_([a-z])/g, (_, l: string) => l.toUpperCase())}`] || ""}`}>
              {statusInfo?.label || disagreement.status}
            </span>
            <span className={styles.headerDesc}>{statusInfo?.desc}</span>
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          {canInvite && (
            <button
              className={`btn btn-primary btn-sm ${styles.inviteBtn}`}
              onClick={invitePartner}
              disabled={inviting}
            >
              {inviting ? "Inviting…" : "👥 Invite Partner"}
            </button>
          )}
          {canResolve && (
            <button
              className={`btn btn-secondary btn-sm ${styles.resolveBtn}`}
              onClick={resolveDisagreement}
              disabled={resolving}
            >
              {resolving ? "Resolving…" : "✅ Resolve"}
            </button>
          )}
        </div>
      </div>

      {/* ── Partner Activity Status Bar ── */}
      {disagreement.visibility === "shared" && (
        <PartnerActivityBar
          disagreementId={disagreementId}
          currentUserId={currentUserId}
        />
      )}

      {/* ── Progress Bar ── */}
      <div className={styles.progressSection}>
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

      {/* ── AI Summary (once confirmed) ── */}
      {disagreement.aiSummary && (
        <details className={styles.summaryCard}>
          <summary className={styles.summaryHeader}>
            🤖 AI Summary
          </summary>
          <div className={styles.summaryContent}>
            {renderContent(disagreement.aiSummary)}
          </div>
        </details>
      )}

      {/* ── Resolution Info ── */}
      {isResolved && disagreement.resolutionNotes && (
        <div className={styles.resolvedBanner}>
          <span className={styles.resolvedIcon}>🎉</span>
          <div>
            <strong>Resolved</strong>
            <p>{disagreement.resolutionNotes}</p>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className={styles.chatMessages}>
        {messages.length === 0 && !streaming && (
          <div className={styles.chatEmpty}>
            <p>🌿 Starting your conversation…</p>
          </div>
        )}

        {messages.map((msg) => {
          const isSystem = msg.senderType === "system";
          const isAi = msg.senderType === "ai";
          const isMine = msg.senderId === currentUserId;

          if (isSystem) {
            return (
              <div key={msg.id} className={styles.systemMessage}>
                {msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`${styles.messageWrapper} ${
                isMine ? styles.messageWrapperUser : ""
              }`}
            >
              <div
                className={`${styles.messageAvatar} ${
                  isAi ? styles.messageAvatarAi :
                  isMine ? styles.messageAvatarUser : styles.messageAvatarPartner
                }`}
              >
                {isAi ? "🌿" : isMine ? "💜" : "💗"}
              </div>
              <div
                className={`${styles.messageBubble} ${
                  isAi ? styles.messageBubbleAi :
                  isMine ? styles.messageBubbleUser : styles.messageBubblePartner
                }`}
              >
                <div className={styles.messageSender}>
                  {isAi ? "Kuxani 🌿" : msg.senderName || (isMine ? "You" : "Partner")}
                </div>
                <div className={styles.messageContent}>
                  {isAi ? renderContent(msg.content) : msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming AI Response */}
        {streaming && (
          <div className={styles.messageWrapper}>
            <div className={`${styles.messageAvatar} ${styles.messageAvatarAi}`}>
              🌿
            </div>
            <div className={`${styles.messageBubble} ${styles.messageBubbleAi}`}>
              <div className={styles.messageSender}>Kuxani 🌿</div>
              <div className={styles.messageContent}>
                {streamingText ? (
                  renderContent(streamingText)
                ) : (
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDot} />
                    <div className={styles.typingDot} />
                    <div className={styles.typingDot} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      {!isResolved && (
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
            onFocus={() => {
              if (disagreement.visibility === "shared" && currentUserId) {
                getSocket().emit(PARTNER_ACTIVITY, {
                  disagreementId,
                  userId: currentUserId,
                  activity: "typing",
                });
              }
            }}
            onBlur={() => {
              if (disagreement.visibility === "shared" && currentUserId) {
                getSocket().emit(PARTNER_ACTIVITY, {
                  disagreementId,
                  userId: currentUserId,
                  activity: "online",
                });
              }
            }}
            placeholder="Share your thoughts…"
            rows={1}
            disabled={streaming}
          />
          <VoiceButton
            isRecording={voice.isRecording}
            isProcessing={voice.isProcessing}
            audioLevel={voice.audioLevel}
            onToggle={voice.toggleRecording}
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
      )}
    </div>
  );
}
