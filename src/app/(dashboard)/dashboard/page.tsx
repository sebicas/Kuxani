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
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <span>🫶</span>
            <h3 className="heading-3">Mood Today</h3>
          </div>
          <p className="text-muted text-sm">
            How are you feeling? Check in with your emotional state and
            optionally share it with your partner.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }}>
            Check In
          </button>
        </div>

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
