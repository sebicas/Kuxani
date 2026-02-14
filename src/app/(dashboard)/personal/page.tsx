"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./personal.module.css";

interface ChatItem {
  id: string;
  title: string;
  isShared: boolean;
  createdAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

export default function PersonalChatsPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  async function fetchChats() {
    try {
      const res = await fetch("/api/personal/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createChat() {
    setCreating(true);
    try {
      const res = await fetch("/api/personal/chats", { method: "POST" });
      if (res.ok) {
        const chat = await res.json();
        router.push(`/personal/${chat.id}`);
      }
    } catch (err) {
      console.error("Failed to create chat:", err);
    } finally {
      setCreating(false);
    }
  }

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div>
        <div className={styles.chatListHeader}>
          <h1 className="heading-2">Private Therapy 💬</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.chatListHeader}>
        <div>
          <h1 className="heading-2">Private Therapy 💬</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Your safe space for personal reflection and growth.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={createChat}
          disabled={creating}
        >
          {creating ? "Creating…" : "New Chat"}
        </button>
      </div>

      {chats.length === 0 ? (
        <div className={styles.chatListEmpty}>
          <span className={styles.chatListEmptyIcon}>🌱</span>
          <h2 className="heading-3" style={{ marginBottom: "var(--space-sm)" }}>
            Your private sanctuary
          </h2>
          <p className={`text-muted ${styles.chatListEmptyText}`}>
            Start a private conversation with your AI therapist to explore personal
            patterns, process emotions, and build self-awareness. Nothing here is
            shared with your partner unless you choose to.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "var(--space-lg)" }}
            onClick={createChat}
            disabled={creating}
          >
            Start Your First Chat
          </button>
        </div>
      ) : (
        <div className={styles.chatList}>
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/personal/${chat.id}`}
              className={styles.chatListItem}
            >
              <div className={styles.chatListItemIcon}>💬</div>
              <div className={styles.chatListItemContent}>
                <div className={styles.chatListItemTitle}>{chat.title}</div>
                <div className={styles.chatListItemPreview}>
                  {chat.lastMessage
                    ? chat.lastMessage.slice(0, 80)
                    : "No messages yet"}
                </div>
              </div>
              <div className={styles.chatListItemMeta}>
                <span className={styles.chatListItemTime}>
                  {formatTime(chat.lastMessageAt || chat.createdAt)}
                </span>
                <span
                  className={`${styles.privacyBadge} ${
                    chat.isShared
                      ? styles.privacyBadgeShared
                      : styles.privacyBadgePrivate
                  }`}
                >
                  {chat.isShared ? "👥 Shared" : "🔒 Private"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
