import Link from "next/link";
import styles from "../dashboard.module.css";

export default function DashboardPage() {
  return (
    <div>
      <div className={styles.mainHeader}>
        <div>
          <h1 className="heading-2">Good afternoon 💜</h1>
          <p className="text-muted" style={{ marginTop: "var(--space-xs)" }}>
            Here&apos;s how your relationship is growing.
          </p>
        </div>
        <button className="btn btn-primary">New Challenge</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-lg)" }}>
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
          <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }}>
            Create Your First Challenge
          </button>
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

        {/* ── Partner Status ── */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <span>💑</span>
            <h3 className="heading-3">Your Partner</h3>
          </div>
          <p className="text-muted text-sm">
            Invite your partner to join Kuxani and start your journey together.
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-md)" }}>
            Send Invite
          </button>
        </div>

        {/* ── Recent Gratitude ── */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <span>✨</span>
            <h3 className="heading-3">Gratitude</h3>
          </div>
          <p className="text-muted text-sm">
            Write something you appreciate about your partner today. It can be
            shared as a love note.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }}>
            Write a Note
          </button>
        </div>
      </div>
    </div>
  );
}

