/**
 * IntakeChatView — Conversational AI Intake Interview
 *
 * In-page chat component that conducts the intake interview through
 * natural conversation. Uses SSE streaming via /api/intake/chat.
 * Extracted data is saved automatically by the API.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./intake.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface IntakeChatViewProps {
  onComplete: () => void;
}

/**
 * Strip intake_data blocks from visible text.
 * These are hidden data blocks the AI outputs for extraction.
 */
function stripIntakeData(text: string): string {
  return text.replace(/```intake_data\s*\n[\s\S]*?```/g, "").trim();
}

const STORAGE_KEY = "kuxani-intake-chat";

export default function IntakeChatView({ onComplete }: IntakeChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Restore from localStorage on mount
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as ChatMessage[];
      } catch { /* ignore */ }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check intake progress to determine first-time vs returning
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intake/progress");
        if (!res.ok) return;
        const data = await res.json();
        const hasProgress = (data.phases || []).some(
          (p: { status: string }) =>
            p.status === "in_progress" || p.status === "completed"
        );
        setIsReturning(hasProgress);
      } catch { /* non-critical */ }
    })();
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch { /* quota exceeded — ignore */ }
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || streaming) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setStreaming(true);
      setStreamingText("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }

      try {
        // Build history from existing messages (strip intake_data for context)
        const history = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.role === "assistant" ? stripIntakeData(m.content) : m.content,
        }));

        const res = await fetch("/api/intake/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            history: history.slice(0, -1), // Don't include current message (API adds it)
          }),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let fullText = "";
        let isComplete = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullText += parsed.text;
                  // Show text without intake_data blocks
                  setStreamingText(stripIntakeData(fullText));
                }
                if (parsed.complete) {
                  isComplete = true;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Add AI message (with raw content for context, display strips blocks)
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: fullText,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setStreamingText("");

        if (isComplete) {
          // Clear saved chat on completion
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
          // Short delay to let user read the final message
          setTimeout(() => onComplete(), 2000);
        }
      } catch (err) {
        console.error("[IntakeChatView] Send error:", err);
      } finally {
        setStreaming(false);
      }
    },
    [streaming, messages, onComplete]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const textarea = e.target;
    textarea.style.height = "44px";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    setInput(textarea.value);
  }

  /** Simple markdown renderer for bold text */
  function renderContent(text: string) {
    const cleaned = stripIntakeData(text);
    const paragraphs = cleaned.split("\n\n");
    return paragraphs.map((para, i) => {
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
      if (para.match(/^\d+\.\s/m)) {
        const items = para.split(/\n/).filter((l) => l.trim());
        return (
          <ol key={i}>
            {items.map((item, j) => (
              <li key={j}>{formatInline(item.replace(/^\d+\.\s/, ""))}</li>
            ))}
          </ol>
        );
      }
      return <p key={i}>{formatInline(para)}</p>;
    });
  }

  function formatInline(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className={styles.chatContainer}>
      {/* Messages area */}
      <div className={styles.chatMessages}>
        {messages.length === 0 && !streaming && (
          <div className={styles.chatWelcome}>
            <span className={styles.chatWelcomeIcon}>🗣️</span>
            <h3 className={styles.chatWelcomeTitle}>
              {isReturning
                ? "Welcome back! Ready to continue?"
                : "Chat with your AI therapist"}
            </h3>
            <p className={styles.chatWelcomeText}>
              {isReturning
                ? "Pick up right where you left off. Your therapist remembers everything you've shared so far."
                : "Have a natural conversation instead of filling out a form. Your therapist will guide the discussion and learn about you along the way."}
            </p>
            <button
              className="btn btn-primary"
              onClick={() =>
                sendMessage(
                  isReturning
                    ? "Hi, I'm ready to continue my intake interview"
                    : "Hi, I'm ready to start my intake interview"
                )
              }
              id="chat-start"
            >
              {isReturning ? "Continue Conversation" : "Start Conversation"}
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.chatBubbleWrap} ${
              msg.role === "user" ? styles.chatBubbleWrapUser : ""
            }`}
          >
            <div
              className={`${styles.chatAvatar} ${
                msg.role === "assistant"
                  ? styles.chatAvatarAi
                  : styles.chatAvatarUser
              }`}
            >
              {msg.role === "assistant" ? "🌿" : "👤"}
            </div>
            <div
              className={`${styles.chatBubble} ${
                msg.role === "assistant"
                  ? styles.chatBubbleAi
                  : styles.chatBubbleUser
              }`}
            >
              {msg.role === "assistant"
                ? renderContent(msg.content)
                : msg.content}
            </div>
          </div>
        ))}

        {/* Streaming AI response */}
        {streaming && (
          <div className={styles.chatBubbleWrap}>
            <div className={`${styles.chatAvatar} ${styles.chatAvatarAi}`}>
              🌿
            </div>
            <div className={`${styles.chatBubble} ${styles.chatBubbleAi}`}>
              {streamingText ? (
                renderContent(streamingText)
              ) : (
                <div className={styles.chatTyping}>
                  <div className={styles.chatTypingDot} />
                  <div className={styles.chatTypingDot} />
                  <div className={styles.chatTypingDot} />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.chatInputArea}>
        <div className={styles.chatInputWrap}>
          <textarea
            ref={textareaRef}
            className={styles.chatInput}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind…"
            rows={1}
            disabled={streaming}
          />
        </div>
        <button
          className={styles.chatSendBtn}
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
          title="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
