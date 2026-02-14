"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../personal.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Chat {
  id: string;
  title: string;
  isShared: boolean;
  messages: Message[];
}

const STARTER_PROMPTS = [
  "I've been feeling anxious lately…",
  "Help me understand my attachment style",
  "I want to process something before talking to my partner",
  "What are my emotional patterns?",
];

export default function PersonalChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    params.then((p) => {
      setChatId(p.chatId);
    });
  }, [params]);

  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch(`/api/personal/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setChat(data);
        setMessages(data.messages || []);
      } else if (res.status === 404) {
        router.push("/personal");
      }
    } catch (err) {
      console.error("Failed to load chat:", err);
    } finally {
      setLoading(false);
    }
  }, [chatId, router]);

  useEffect(() => {
    if (chatId) fetchChat();
  }, [chatId, fetchChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || streaming || !chatId) return;

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setStreaming(true);
      setStreamingText("");

      // Auto-resize textarea back
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }

      try {
        const res = await fetch(`/api/personal/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let fullText = "";

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
                  setStreamingText(fullText);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Add the complete AI message
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: fullText,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setStreamingText("");

        // Update chat title if it changed (auto-title)
        if (chat?.title === "New Chat") {
          fetchChat();
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      } finally {
        setStreaming(false);
      }
    },
    [chatId, streaming, chat, fetchChat]
  );

  async function toggleShare() {
    if (!chat) return;
    try {
      const res = await fetch(`/api/personal/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShared: !chat.isShared }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChat(updated);
      }
    } catch (err) {
      console.error("Failed to toggle share:", err);
    }
  }

  async function deleteChat() {
    if (!confirm("Delete this chat? This action cannot be undone.")) return;
    try {
      await fetch(`/api/personal/chats/${chatId}`, { method: "DELETE" });
      router.push("/personal");
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  }

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

  /** Simple markdown-like renderer for bold, italic, lists */
  function renderContent(text: string) {
    // Split into paragraphs
    const paragraphs = text.split("\n\n");
    return paragraphs.map((para, i) => {
      // Check for list items
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
    // Bold: **text** or __text__
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  if (loading) {
    return (
      <div className={styles.chatContainer}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!chat) return null;

  return (
    <div className={styles.chatContainer}>
      {/* ── Header ── */}
      <div className={styles.chatHeader}>
        <Link href="/personal" className={styles.chatBackBtn}>
          ←
        </Link>
        <div className={styles.chatHeaderTitle}>{chat.title}</div>
        <div className={styles.chatHeaderActions}>
          <button
            className={styles.shareToggle}
            onClick={toggleShare}
            title={chat.isShared ? "Make private" : "Share with partner"}
          >
            <span
              className={`${styles.privacyBadge} ${
                chat.isShared
                  ? styles.privacyBadgeShared
                  : styles.privacyBadgePrivate
              }`}
            >
              {chat.isShared ? "👥 Shared" : "🔒 Private"}
            </span>
          </button>
          <button
            className={styles.deleteBtn}
            onClick={deleteChat}
            title="Delete chat"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={styles.messageArea}>
        {messages.length === 0 && !streaming ? (
          <div className={styles.welcomeState}>
            <span className={styles.welcomeIcon}>🌿</span>
            <h2 className={styles.welcomeTitle}>Your safe space</h2>
            <p className={styles.welcomeText}>
              This is your private therapy session. Explore personal patterns,
              process emotions, and build self-awareness. Everything here stays
              between you and your AI therapist.
            </p>
            <div className={styles.welcomePrompts}>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className={styles.welcomePrompt}
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.messageWrapper} ${
                  msg.role === "user" ? styles.messageWrapperUser : ""
                }`}
              >
                <div
                  className={`${styles.messageAvatar} ${
                    msg.role === "assistant"
                      ? styles.messageAvatarAi
                      : styles.messageAvatarUser
                  }`}
                >
                  {msg.role === "assistant" ? "🌿" : "👤"}
                </div>
                <div
                  className={`${styles.messageBubble} ${
                    msg.role === "assistant"
                      ? styles.messageBubbleAi
                      : styles.messageBubbleUser
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
              <div className={styles.messageWrapper}>
                <div className={`${styles.messageAvatar} ${styles.messageAvatarAi}`}>
                  🌿
                </div>
                <div className={`${styles.messageBubble} ${styles.messageBubbleAi}`}>
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
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
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
          className={styles.sendBtn}
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
