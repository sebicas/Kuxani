"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./deescalation.module.css";

type Phase = "breathing" | "timer" | "prompts" | "reflection";

interface AiPrompt {
  type: "grounding" | "reframe" | "phrase";
  text: string;
}

export default function DeescalationPage() {
  const [phase, setPhase] = useState<Phase>("breathing");
  const [completedPhases, setCompletedPhases] = useState<Set<Phase>>(new Set());

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Breathing state
  const [breathingCount, setBreathingCount] = useState(0);
  const [breathPhase, setBreathPhase] = useState<"Breathe In" | "Hold" | "Breathe Out">("Breathe In");
  const breathingInterval = useRef<NodeJS.Timeout | null>(null);
  const [breathingStarted, setBreathingStarted] = useState(false);

  // Timer state
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Prompts state
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);

  // Reflection state
  const [triggerReason, setTriggerReason] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolved, setResolved] = useState(false);

  // Create session on mount
  useEffect(() => {
    createSession();
  }, []);

  async function createSession() {
    try {
      const res = await fetch("/api/deescalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.id);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }

  async function updateSession(updates: Record<string, unknown>) {
    if (!sessionId) return;
    try {
      await fetch("/api/deescalation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, ...updates }),
      });
    } catch (err) {
      console.error("Failed to update session:", err);
    }
  }

  // ── Breathing Logic (4-7-8) ──
  const startBreathing = useCallback(() => {
    setBreathingStarted(true);
    let seconds = 0;
    const CYCLE = 19; // 4 + 7 + 8

    breathingInterval.current = setInterval(() => {
      seconds++;
      const pos = seconds % CYCLE;

      if (pos < 4) {
        setBreathPhase("Breathe In");
        setBreathingCount(4 - pos);
      } else if (pos < 11) {
        setBreathPhase("Hold");
        setBreathingCount(11 - pos);
      } else {
        setBreathPhase("Breathe Out");
        setBreathingCount(CYCLE - pos);
      }
    }, 1000);
  }, []);

  function completeBreathing() {
    if (breathingInterval.current) clearInterval(breathingInterval.current);
    setCompletedPhases((prev) => new Set([...prev, "breathing"]));
    updateSession({ breathingCompleted: true });
    setPhase("timer");
  }

  // ── Timer Logic ──
  function startTimer(minutes: number) {
    setTimerMinutes(minutes);
    setTimerSeconds(minutes * 60);
    setTimerRunning(true);
  }

  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerInterval.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            setCompletedPhases((p) => new Set([...p, "timer"]));
            updateSession({ cooldownMinutes: timerMinutes });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  function skipTimer() {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setTimerRunning(false);
    setCompletedPhases((p) => new Set([...p, "timer"]));
    setPhase("prompts");
  }

  function formatTime(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ── Prompts ──
  async function fetchPrompts() {
    setPromptsLoading(true);
    try {
      const res = await fetch("/api/deescalation/prompts");
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.prompts || []);
      }
    } catch {
      setPrompts([
        { type: "grounding", text: "Name 5 things you can see, 4 you can touch, 3 you can hear." },
        { type: "reframe", text: "This is you and your partner vs. the problem, not vs. each other." },
        { type: "phrase", text: "I need a moment to collect my thoughts so I can respond with care." },
      ]);
    } finally {
      setPromptsLoading(false);
    }
  }

  useEffect(() => {
    if (phase === "prompts" && prompts.length === 0) {
      fetchPrompts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function completePrompts() {
    setCompletedPhases((p) => new Set([...p, "prompts"]));
    updateSession({ aiPromptsUsed: prompts.map((p) => p.text) });
    setPhase("reflection");
  }

  // ── Resolve ──
  async function handleResolve() {
    setSaving(true);
    await updateSession({
      triggerReason: triggerReason || null,
      reflection: reflection || null,
      resolved: true,
    });
    setResolved(true);
    setCompletedPhases((p) => new Set([...p, "reflection"]));
    setSaving(false);
  }

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (breathingInterval.current) clearInterval(breathingInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  if (resolved) {
    return (
      <div>
        <div className={styles.deescHeader}>
          <h1 className="heading-2">De-escalation Complete 🕊️</h1>
        </div>
        <div className={styles.resolvedBanner}>
          <div className={styles.resolvedEmoji}>🕊️</div>
          <div className={styles.resolvedText}>
            You took a moment to pause and reflect. That&apos;s a powerful step.
          </div>
          <p className="text-muted" style={{ marginTop: "var(--space-md)" }}>
            When you&apos;re ready, return to each other with openness and care.
          </p>
          <a href="/dashboard" className="btn btn-primary" style={{ marginTop: "var(--space-xl)", display: "inline-block" }}>
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.deescHeader}>
        <h1 className="heading-2">Emergency De-escalation 🚨</h1>
        <p className={styles.deescSubtitle}>
          Take a moment. Let&apos;s work through this together.
        </p>
      </div>

      {/* ── Phase Navigation ── */}
      <div className={styles.phaseNav}>
        {(["breathing", "timer", "prompts", "reflection"] as Phase[]).map((p) => (
          <button
            key={p}
            className={`${styles.phaseBtn} ${
              phase === p ? styles.phaseBtnActive : ""
            } ${completedPhases.has(p) ? styles.phaseBtnDone : ""}`}
            onClick={() => setPhase(p)}
          >
            {completedPhases.has(p) ? "✓ " : ""}
            {p === "breathing" ? "🌬️ Breathe" : ""}
            {p === "timer" ? "⏱️ Cool Down" : ""}
            {p === "prompts" ? "💡 Prompts" : ""}
            {p === "reflection" ? "📝 Reflect" : ""}
          </button>
        ))}
      </div>

      {/* ── Phase 1: Breathing ── */}
      {phase === "breathing" && (
        <div className={styles.breathingSection}>
          <div className={styles.breathingCircle}>
            <div className={styles.breathingLabel}>
              {breathingStarted ? breathPhase : "Ready?"}
            </div>
          </div>

          {breathingStarted ? (
            <>
              <div className={styles.breathingCount}>{breathingCount}</div>
              <div className={styles.breathingPhase}>{breathPhase}</div>
              <p className="text-muted" style={{ marginTop: "var(--space-md)" }}>
                4-7-8 breathing: Inhale 4s, Hold 7s, Exhale 8s
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: "var(--space-xl)" }}
                onClick={completeBreathing}
              >
                I Feel Calmer →
              </button>
            </>
          ) : (
            <>
              <p className={styles.breathingInstruction}>
                Follow the circle. Breathe in as it grows, hold, then breathe out as it shrinks.
              </p>
              <button className="btn btn-primary btn-lg" onClick={startBreathing}>
                Start Breathing Exercise
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Phase 2: Cooling Timer ── */}
      {phase === "timer" && (
        <div className={styles.timerSection}>
          <div className={styles.timerDisplay}>{formatTime(timerSeconds)}</div>

          {!timerRunning && timerSeconds === 0 ? (
            <>
              <p className="text-muted" style={{ marginBottom: "var(--space-lg)" }}>
                Choose how long you need to cool down.
              </p>
              <div className={styles.timerOptions}>
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    className={`${styles.timerBtn} ${timerMinutes === m ? styles.timerBtnActive : ""}`}
                    onClick={() => startTimer(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </>
          ) : timerRunning ? (
            <>
              <p className={styles.timerMessage}>
                Take this time for yourself. It&apos;s okay to need space.
                You&apos;re building the strength to reconnect with care.
              </p>
              <button className="btn btn-secondary" style={{ marginTop: "var(--space-xl)" }} onClick={skipTimer}>
                Skip →
              </button>
            </>
          ) : (
            <>
              <p className="text-muted" style={{ marginBottom: "var(--space-lg)" }}>
                ✓ Cooldown complete. Ready for the next step?
              </p>
              <button className="btn btn-primary" onClick={() => setPhase("prompts")}>
                Continue to Prompts →
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Phase 3: AI Prompts ── */}
      {phase === "prompts" && (
        <div className={styles.promptsSection}>
          <h2 className="heading-3" style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
            Grounding & Reframing
          </h2>

          {promptsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className={styles.promptsGrid}>
              {prompts.map((prompt, i) => (
                <div key={i} className={styles.promptCard}>
                  <div
                    className={`${styles.promptType} ${
                      prompt.type === "grounding"
                        ? styles.promptGrounding
                        : prompt.type === "reframe"
                        ? styles.promptReframe
                        : styles.promptPhrase
                    }`}
                  >
                    {prompt.type === "grounding" && "🌿 Grounding"}
                    {prompt.type === "reframe" && "🔄 Reframe"}
                    {prompt.type === "phrase" && "💬 De-escalation Phrase"}
                  </div>
                  <div className={styles.promptText}>{prompt.text}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "var(--space-xl)" }}>
            <button className="btn btn-primary" onClick={completePrompts}>
              Continue to Reflection →
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 4: Reflection ── */}
      {phase === "reflection" && (
        <div className={styles.reflectionSection}>
          <h2 className="heading-3" style={{ marginBottom: "var(--space-md)" }}>
            Quick Reflection
          </h2>

          <div className="card" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-lg)" }}>
            <label className="text-sm" style={{ fontWeight: 500 }}>
              What triggered this? (optional)
            </label>
            <textarea
              className={styles.reflectionTextarea}
              placeholder="What happened before you needed to de-escalate?"
              value={triggerReason}
              onChange={(e) => setTriggerReason(e.target.value)}
              rows={2}
            />
          </div>

          <div className="card" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-lg)" }}>
            <label className="text-sm" style={{ fontWeight: 500 }}>
              How do you feel now? (optional)
            </label>
            <textarea
              className={styles.reflectionTextarea}
              placeholder="Describe how you're feeling after taking this time..."
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={2}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={handleResolve}
            disabled={saving}
          >
            {saving ? "Saving…" : "Complete Session 🕊️"}
          </button>
        </div>
      )}
    </div>
  );
}
