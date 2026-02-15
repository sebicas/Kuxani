"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../dashboard.module.css";
import inviteStyles from "../../invite/invite.module.css";
import { usePartnerSocket } from "@/lib/hooks/usePartnerSocket";

interface CoupleData {
  couple: {
    id: string;
    inviteCode: string;
    inviteLink: string;
    status: "pending" | "active";
    createdAt: string;
  } | null;
  role?: string;
  partner?: {
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function DashboardPage() {
  const [coupleData, setCoupleData] = useState<CoupleData | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const fetchCouple = useCallback(async () => {
    try {
      const res = await fetch("/api/couples");
      if (res.ok) {
        const data = await res.json();
        setCoupleData(data);
      }
    } catch {
      // silently fail — card will show "create" state
    }
  }, []);

  useEffect(() => {
    fetchCouple();
  }, [fetchCouple]);

  // Real-time: listen for partner joining while status is "pending"
  const pendingCoupleId =
    coupleData?.couple?.status === "pending" ? coupleData.couple.id : null;

  usePartnerSocket(pendingCoupleId, (partner) => {
    setCoupleData((prev) => {
      if (!prev?.couple) return prev;
      return {
        ...prev,
        couple: { ...prev.couple, status: "active" },
        partner,
      };
    });
  });

  const handleCreateCouple = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/couples", { method: "POST" });
      if (res.ok) {
        await fetchCouple();
      }
    } catch {
      // handle error silently
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string, type: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback: select text
    }
  };

  const renderPartnerCard = () => {
    // No couple yet
    if (!coupleData?.couple) {
      return (
        <div className={`card ${inviteStyles.partnerCard}`}>
          <div className={inviteStyles.partnerHeader}>
            <span>💑</span>
            <h3 className="heading-3">Your Partner</h3>
          </div>
          <p className="text-muted text-sm">
            Start your journey together by creating a couple and inviting your
            partner to join Kuxani.
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: "var(--space-md)" }}
            onClick={handleCreateCouple}
            disabled={creating}
          >
            {creating ? <span className="spinner" /> : "Create Couple & Get Invite Code"}
          </button>
        </div>
      );
    }

    // Couple pending — waiting for partner
    if (coupleData.couple.status === "pending") {
      return (
        <div className={`card ${inviteStyles.partnerCard}`}>
          <div className={inviteStyles.partnerHeader}>
            <span>💑</span>
            <h3 className="heading-3">Your Partner</h3>
            <span className={`${inviteStyles.partnerStatusBadge} ${inviteStyles.pending}`}>
              <span className={`${inviteStyles.statusDot} ${inviteStyles.pulse}`} />
              Waiting
            </span>
          </div>
          <p className="text-muted text-sm">
            Share this invite code or link with your partner so they can join
            you on Kuxani.
          </p>

          <div className={inviteStyles.inviteCodeSection}>
            <div className={inviteStyles.inviteCodeLabel}>Invite Code</div>
            <div className={inviteStyles.inviteCodeBox}>
              <span className={inviteStyles.inviteCodeValue}>
                {coupleData.couple.inviteCode}
              </span>
              <button
                className={`${inviteStyles.copyBtn} ${copied === "code" ? inviteStyles.copied : ""}`}
                onClick={() =>
                  handleCopy(coupleData.couple!.inviteCode, "code")
                }
              >
                {copied === "code" ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <div className={inviteStyles.inviteLinkBox}>
              <span className={inviteStyles.inviteLinkValue}>
                {coupleData.couple.inviteLink}
              </span>
              <button
                className={`${inviteStyles.copyBtn} ${copied === "link" ? inviteStyles.copied : ""}`}
                onClick={() =>
                  handleCopy(coupleData.couple!.inviteLink, "link")
                }
              >
                {copied === "link" ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Couple active — show partner info
    return (
      <div className={`card ${inviteStyles.partnerCard}`}>
        <div className={inviteStyles.partnerHeader}>
          <span>💑</span>
          <h3 className="heading-3">Your Partner</h3>
          <span className={`${inviteStyles.partnerStatusBadge} ${inviteStyles.active}`}>
            <span className={inviteStyles.statusDot} />
            Connected
          </span>
        </div>

        {coupleData.partner && (
          <div className={inviteStyles.partnerInfo}>
            <div className={inviteStyles.partnerAvatar}>
              {coupleData.partner.name.charAt(0).toUpperCase()}
            </div>
            <div className={inviteStyles.partnerDetails}>
              <div className={inviteStyles.partnerName}>
                {coupleData.partner.name}
              </div>
              <div className={inviteStyles.partnerEmail}>
                {coupleData.partner.email}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.mainHeader}>
        <div>
          <h1 className="heading-2">Good afternoon 💜</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Here&apos;s how your relationship is growing.
          </p>
        </div>
        <Link href="/challenges/new" className="btn btn-primary">New Challenge</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-lg)" }}>
        {/* ── Partner Status (Dynamic) ── */}
        {renderPartnerCard()}

        {/* ── Active Challenges ── */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <span>🔮</span>
            <h3 className="heading-3">Active Challenges</h3>
          </div>
          <p className="text-muted text-sm">
            No active challenges. When both partners write their perspectives on
            a conflict, the AI helps you find common ground.
          </p>
          <Link href="/challenges/new" className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }}>
            Create Your First Challenge
          </Link>
        </div>

        {/* ── Mood Today ── */}
        <Link href="/mood" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              <span>🫶</span>
              <h3 className="heading-3">Mood Tracker</h3>
            </div>
            <p className="text-muted text-sm">
              How are you feeling? Check in with your emotional state and
              track your mood over time.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)", display: "inline-block" }}>
              Check In →
            </span>
          </div>
        </Link>

        {/* ── Love Languages ── */}
        <Link href="/love-languages" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              <span>💕</span>
              <h3 className="heading-3">Love Languages</h3>
            </div>
            <p className="text-muted text-sm">
              Discover your love language and understand how you and your
              partner express and receive love.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)", display: "inline-block" }}>
              Take the Quiz →
            </span>
          </div>
        </Link>

        {/* ── Private Therapy ── */}
        <Link href="/personal" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              <span>💬</span>
              <h3 className="heading-3">Private Therapy</h3>
            </div>
            <p className="text-muted text-sm">
              Chat privately with your AI therapist for personal reflection
              and growth. Nothing is shared unless you choose.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)", display: "inline-block" }}>
              Start a Chat →
            </span>
          </div>
        </Link>

        {/* ── Recent Gratitude ── */}
        <Link href="/gratitude" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              <span>✨</span>
              <h3 className="heading-3">Gratitude</h3>
            </div>
            <p className="text-muted text-sm">
              Write something you appreciate about your partner today. It can be
              shared as a love note.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)", display: "inline-block" }}>
              Write a Note →
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
