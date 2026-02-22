"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./intake.module.css";
import {
  INTAKE_QUESTIONS,
  INTAKE_CATEGORIES,
  type IntakeQuestion,
} from "@/lib/data/intake-questions";

/* ── Types ── */

type ViewState = "loading" | "intro" | "interview" | "complete";

interface Child {
  name: string;
  age: number;
  relationship: "bio" | "step" | "adopted";
}

/* ── Component ── */

export default function IntakeWizardPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [saving, setSaving] = useState(false);

  // Track which phases we've already loaded
  const loadedPhases = useRef(new Set<number>());
  // Track dirty answers that need saving
  const dirtyPhases = useRef(new Set<number>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Derived state ── */
  const question = INTAKE_QUESTIONS[currentIndex];
  const totalQuestions = INTAKE_QUESTIONS.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;
  const category = question ? INTAKE_CATEGORIES[question.category] : null;

  // Group questions by phase for save payloads
  const questionsByPhase = useMemo(() => {
    const map: Record<number, IntakeQuestion[]> = {};
    for (const q of INTAKE_QUESTIONS) {
      if (!map[q.phase]) map[q.phase] = [];
      map[q.phase].push(q);
    }
    return map;
  }, []);

  /* ── Load existing data ── */

  const loadPhaseData = useCallback(
    async (phase: number) => {
      if (loadedPhases.current.has(phase)) return;
      loadedPhases.current.add(phase);

      try {
        const res = await fetch(`/api/intake/phase/${phase}`);
        if (!res.ok) return;
        const data = await res.json();

        const newAnswers: Record<string, unknown> = {};
        const phaseQuestions = questionsByPhase[phase] || [];

        for (const q of phaseQuestions) {
          let value: unknown;

          if (q.storage === "coupleFacts" && data.coupleFacts) {
            value = data.coupleFacts[q.field];
          } else if (q.storage === "responses" && data.responses) {
            value = data.responses[q.field];
          } else if (q.storage === "individualData" && data.individualData) {
            value = data.individualData[q.field];
          }

          if (value !== undefined && value !== null) {
            newAnswers[q.id] = value;
          }
        }

        if (Object.keys(newAnswers).length > 0) {
          setAnswers((prev) => ({ ...prev, ...newAnswers }));
        }
      } catch {
        /* non-critical */
      }
    },
    [questionsByPhase]
  );

  // Initial load: check progress to determine view state + load phase data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intake/progress");
        if (!res.ok) {
          setView("intro");
          return;
        }
        const data = await res.json();

        // Determine how far the user got
        const completedPhases = (data.phases || [])
          .filter(
            (p: { status: string }) => p.status === "completed"
          )
          .map((p: { phase: number }) => p.phase);

        const inProgressPhases = (data.phases || [])
          .filter(
            (p: { status: string }) => p.status === "in_progress"
          )
          .map((p: { phase: number }) => p.phase);

        // If all 6 content phases are complete, show complete
        if ([1, 2, 3, 4, 5, 6].every((p) => completedPhases.includes(p))) {
          setView("complete");
          // Load all data for display
          for (let p = 1; p <= 6; p++) await loadPhaseData(p);
          return;
        }

        // If any phase has been started, resume at the right question
        if (completedPhases.length > 0 || inProgressPhases.length > 0) {
          // Find the first unanswered phase
          const allStarted = [
            ...new Set([...completedPhases, ...inProgressPhases]),
          ].sort((a: number, b: number) => a - b);

          // Load data for all started phases
          for (const p of allStarted) {
            await loadPhaseData(p);
          }

          // Find the first question in the first incomplete phase
          let resumePhase = 1;
          for (let p = 1; p <= 6; p++) {
            if (!completedPhases.includes(p)) {
              resumePhase = p;
              break;
            }
          }

          const resumeIndex = INTAKE_QUESTIONS.findIndex(
            (q) => q.phase === resumePhase
          );
          if (resumeIndex >= 0) setCurrentIndex(resumeIndex);

          setView("interview");
        } else {
          setView("intro");
        }
      } catch {
        setView("intro");
      }
    })();
  }, [loadPhaseData]);

  /* ── Save logic ── */

  const buildPhasePayload = useCallback(
    (phase: number) => {
      const phaseQuestions = questionsByPhase[phase] || [];
      const payload: Record<string, unknown> = {};

      const coupleFacts: Record<string, unknown> = {};
      const responses: Record<string, unknown> = {};
      const individualData: Record<string, unknown> = {};

      for (const q of phaseQuestions) {
        const val = answers[q.id];
        if (val === undefined || val === null) continue;

        if (q.storage === "coupleFacts") {
          coupleFacts[q.field] = val;
        } else if (q.storage === "responses") {
          responses[q.field] = val;
        } else if (q.storage === "individualData") {
          individualData[q.field] = val;
        }
      }

      if (Object.keys(coupleFacts).length > 0) payload.coupleFacts = coupleFacts;
      if (Object.keys(responses).length > 0) payload.responses = responses;
      if (Object.keys(individualData).length > 0)
        payload.individualData = individualData;

      return payload;
    },
    [answers, questionsByPhase]
  );

  const savePhase = useCallback(
    async (phase: number) => {
      const payload = buildPhasePayload(phase);
      if (Object.keys(payload).length === 0) return;

      setSaving(true);
      try {
        await fetch(`/api/intake/phase/${phase}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        dirtyPhases.current.delete(phase);
      } finally {
        setSaving(false);
      }
    },
    [buildPhasePayload]
  );

  // Debounced auto-save
  const scheduleSave = useCallback(
    (phase: number) => {
      dirtyPhases.current.add(phase);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        for (const p of dirtyPhases.current) {
          savePhase(p);
        }
      }, 1500);
    },
    [savePhase]
  );

  // Save on unmount
  useEffect(() => {
    const currentDirtyPhases = dirtyPhases.current;
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Fire-and-forget save for any dirty phases
      for (const phase of currentDirtyPhases) {
        const phaseQuestions = questionsByPhase[phase] || [];
        const payload: Record<string, unknown> = {};
        const coupleFacts: Record<string, unknown> = {};
        const responses: Record<string, unknown> = {};
        const individualData: Record<string, unknown> = {};

        for (const q of phaseQuestions) {
          const val = answers[q.id];
          if (val === undefined || val === null) continue;
          if (q.storage === "coupleFacts") coupleFacts[q.field] = val;
          else if (q.storage === "responses") responses[q.field] = val;
          else if (q.storage === "individualData") individualData[q.field] = val;
        }

        if (Object.keys(coupleFacts).length > 0) payload.coupleFacts = coupleFacts;
        if (Object.keys(responses).length > 0) payload.responses = responses;
        if (Object.keys(individualData).length > 0)
          payload.individualData = individualData;

        if (Object.keys(payload).length > 0) {
          navigator.sendBeacon(
            `/api/intake/phase/${phase}`,
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Mark phase complete when all its questions are answered ── */

  const markPhaseComplete = useCallback(async (phase: number) => {
    await fetch("/api/intake/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, status: "completed", modality: "form" }),
    });
  }, []);

  const markPhaseInProgress = useCallback(async (phase: number) => {
    await fetch("/api/intake/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, status: "in_progress", modality: "form" }),
    });
  }, []);

  /* ── Answer handlers ── */

  const setAnswer = useCallback(
    (questionId: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      const q = INTAKE_QUESTIONS.find((q) => q.id === questionId);
      if (q) scheduleSave(q.phase);
    },
    [scheduleSave]
  );

  /* ── Navigation ── */

  const goForward = useCallback(async () => {
    // Load next phase data if we're crossing a phase boundary
    const currentPhase = INTAKE_QUESTIONS[currentIndex].phase;
    const nextIndex = currentIndex + 1;

    // Save current phase before advancing
    await savePhase(currentPhase);

    if (nextIndex >= totalQuestions) {
      // Mark last phase as complete
      await markPhaseComplete(currentPhase);
      // Mark all phases as complete
      for (let p = 1; p <= 6; p++) {
        await markPhaseComplete(p);
      }
      setView("complete");
      return;
    }

    const nextPhase = INTAKE_QUESTIONS[nextIndex].phase;
    if (nextPhase !== currentPhase) {
      // Phase boundary — mark current as complete, next as in_progress
      await markPhaseComplete(currentPhase);
      await markPhaseInProgress(nextPhase);
      await loadPhaseData(nextPhase);
    }

    setDirection("forward");
    setCurrentIndex(nextIndex);
  }, [
    currentIndex,
    totalQuestions,
    savePhase,
    markPhaseComplete,
    markPhaseInProgress,
    loadPhaseData,
  ]);

  const goBackward = useCallback(() => {
    if (currentIndex > 0) {
      setDirection("backward");
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const skipQuestion = useCallback(async () => {
    if (currentIndex < totalQuestions - 1) {
      const currentPhase = INTAKE_QUESTIONS[currentIndex].phase;
      const nextPhase = INTAKE_QUESTIONS[currentIndex + 1].phase;

      if (nextPhase !== currentPhase) {
        await loadPhaseData(nextPhase);
        await markPhaseInProgress(nextPhase);
      }

      setDirection("forward");
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalQuestions, loadPhaseData, markPhaseInProgress]);

  const startInterview = useCallback(async () => {
    await markPhaseInProgress(1);
    await loadPhaseData(1);
    setView("interview");
  }, [markPhaseInProgress, loadPhaseData]);

  /* ── Render helpers ── */

  const renderInput = (q: IntakeQuestion) => {
    const value = answers[q.id];

    switch (q.type) {
      case "select":
        return (
          <div className={styles.selectGroup}>
            {(q.options || []).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.selectOption} ${
                  value === opt.value ? styles.selectOptionSelected : ""
                }`}
                onClick={() => setAnswer(q.id, opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );

      case "boolean":
        return (
          <div className={styles.selectGroup}>
            <button
              type="button"
              className={`${styles.selectOption} ${
                value === true ? styles.selectOptionSelected : ""
              }`}
              onClick={() => setAnswer(q.id, true)}
            >
              Yes, usually
            </button>
            <button
              type="button"
              className={`${styles.selectOption} ${
                value === false ? styles.selectOptionSelected : ""
              }`}
              onClick={() => setAnswer(q.id, false)}
            >
              Not really
            </button>
          </div>
        );

      case "date":
        return (
          <input
            type="date"
            className={styles.dateInput}
            value={(value as string) || ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        );

      case "text":
        return (
          <input
            type="text"
            className={styles.textInput}
            placeholder={q.helpText || "Type your answer..."}
            value={(value as string) || ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        );

      case "textarea":
        return (
          <textarea
            className={styles.textArea}
            placeholder={q.helpText || "Share your thoughts..."}
            value={(value as string) || ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            rows={4}
          />
        );

      case "tags": {
        const tags = (value as string[]) || [];
        const tagInput = tagInputs[q.id] || "";
        return (
          <div className={styles.tagsContainer}>
            {/* Preset chips */}
            {q.presets && q.presets.length > 0 && (
              <div className={styles.chipGroup}>
                {q.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.chip} ${
                      tags.includes(preset) ? styles.chipSelected : ""
                    }`}
                    onClick={() => {
                      if (tags.includes(preset)) {
                        setAnswer(
                          q.id,
                          tags.filter((t) => t !== preset)
                        );
                      } else {
                        setAnswer(q.id, [...tags, preset]);
                      }
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            {/* Custom tag chips */}
            {tags.filter((t) => !(q.presets || []).includes(t)).length > 0 && (
              <div className={styles.chipGroup}>
                {tags
                  .filter((t) => !(q.presets || []).includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.chip} ${styles.chipSelected}`}
                      onClick={() =>
                        setAnswer(
                          q.id,
                          tags.filter((t) => t !== tag)
                        )
                      }
                    >
                      {tag} ✕
                    </button>
                  ))}
              </div>
            )}
            {/* Input */}
            <div className={styles.tagInputRow}>
              <input
                className={styles.tagInputField}
                placeholder="Add your own..."
                value={tagInput}
                onChange={(e) =>
                  setTagInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim())) {
                      setAnswer(q.id, [...tags, tagInput.trim()]);
                    }
                    setTagInputs((prev) => ({ ...prev, [q.id]: "" }));
                  }
                }}
              />
              <button
                type="button"
                className={styles.tagAddBtn}
                onClick={() => {
                  if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                    setAnswer(q.id, [...tags, tagInput.trim()]);
                    setTagInputs((prev) => ({ ...prev, [q.id]: "" }));
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
        );
      }

      case "children": {
        const kids = (value as Child[]) || [];
        return (
          <div className={styles.childrenContainer}>
            {kids.map((child, i) => (
              <div key={i} className={styles.childRow}>
                <input
                  className={styles.childInput}
                  placeholder="Name"
                  value={child.name}
                  onChange={(e) => {
                    const updated = [...kids];
                    updated[i] = { ...updated[i], name: e.target.value };
                    setAnswer(q.id, updated);
                  }}
                />
                <input
                  className={styles.childInput}
                  type="number"
                  placeholder="Age"
                  style={{ maxWidth: 80 }}
                  value={child.age || ""}
                  onChange={(e) => {
                    const updated = [...kids];
                    updated[i] = {
                      ...updated[i],
                      age: parseInt(e.target.value) || 0,
                    };
                    setAnswer(q.id, updated);
                  }}
                />
                <select
                  className={styles.childSelect}
                  value={child.relationship}
                  onChange={(e) => {
                    const updated = [...kids];
                    updated[i] = {
                      ...updated[i],
                      relationship: e.target.value as Child["relationship"],
                    };
                    setAnswer(q.id, updated);
                  }}
                >
                  <option value="bio">Biological</option>
                  <option value="step">Step</option>
                  <option value="adopted">Adopted</option>
                </select>
                <button
                  type="button"
                  className={styles.childRemoveBtn}
                  onClick={() =>
                    setAnswer(
                      q.id,
                      kids.filter((_, j) => j !== i)
                    )
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.childAddBtn}
              onClick={() =>
                setAnswer(q.id, [
                  ...kids,
                  { name: "", age: 0, relationship: "bio" as const },
                ])
              }
            >
              + Add Child
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const hasAnswer = answers[question?.id] !== undefined && answers[question?.id] !== null && answers[question?.id] !== "";
  const isLast = currentIndex === totalQuestions - 1;

  /* ── View: Loading ── */
  if (view === "loading") {
    return (
      <div>
        <div className={styles.intakeHeader}>
          <h1 className="heading-2">Get to Know You 💬</h1>
        </div>
        <div className={styles.loadingSpinner}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  /* ── View: Intro ── */
  if (view === "intro") {
    return (
      <div>
        <div className={styles.intakeHeader}>
          <h1 className="heading-2">Get to Know You 💬</h1>
        </div>
        <div className={`card ${styles.introCard}`}>
          <span className={styles.introIcon}>🗣️</span>
          <h2 className={styles.introTitle}>Your Intake Interview</h2>
          <p className={styles.introDescription}>
            Help your AI therapist understand you, your relationship, and what
            you&apos;re hoping to work on. Answer one question at a time —
            skip anything you&apos;re not ready for.
          </p>
          <div className={styles.categoryPreview}>
            {Object.entries(INTAKE_CATEGORIES).map(([key, cat]) => (
              <span key={key} className={styles.categoryTag}>
                {cat.icon} {cat.name}
              </span>
            ))}
          </div>
          <div className={styles.introMeta}>
            <span>📋 {totalQuestions} questions</span>
            <span>⏱️ ~15 minutes</span>
            <span>⏭️ Skip any question</span>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={startInterview}
            id="start-interview"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  /* ── View: Complete ── */
  if (view === "complete") {
    return (
      <div>
        <div className={styles.intakeHeader}>
          <h1 className="heading-2">Get to Know You 💬</h1>
        </div>
        <div className={`card ${styles.completeCard}`}>
          <span className={styles.completeIcon}>✨</span>
          <h2 className={styles.completeTitle}>Interview Complete!</h2>
          <p className={styles.completeDescription}>
            Thank you for sharing. Your AI therapist now has a much better
            understanding of you and your relationship. This information will
            help provide more personalized support.
          </p>
          <div className={styles.completeActions}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setCurrentIndex(0);
                setView("interview");
              }}
              id="review-answers"
            >
              Review Answers
            </button>
            <a href="/dashboard" className="btn btn-secondary">
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ── View: Interview ── */
  return (
    <div>
      <div className={styles.intakeHeader}>
        <h1 className="heading-2">Get to Know You 💬</h1>
      </div>

      <div className={styles.wizardContainer}>
        {/* Progress */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.progressMeta}>
          <span className={styles.progressText}>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {saving && <span className={styles.savingIndicator}>Saving...</span>}
        </div>

        {/* Category badge */}
        {category && (
          <div className={styles.categoryBadge}>
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </div>
        )}

        {/* Question card */}
        <div
          className={`${styles.questionCard} ${
            direction === "forward"
              ? styles.slideInRight
              : styles.slideInLeft
          }`}
          key={question.id}
        >
          <p className={styles.questionText}>{question.question}</p>
          {question.helpText && question.type !== "textarea" && question.type !== "text" && (
            <p className={styles.helpText}>{question.helpText}</p>
          )}
          <div className={styles.inputArea}>{renderInput(question)}</div>
        </div>

        {/* Modality toggle */}
        <div className={styles.modalityBar}>
          <button
            className={`${styles.modalityBtn} ${styles.modalityBtnActive}`}
            id="modality-type"
          >
            📝 Type
          </button>
          <button
            className={`${styles.modalityBtn} ${styles.modalityBtnDisabled}`}
            disabled
            id="modality-chat"
          >
            💬 Chat
          </button>
          <button
            className={`${styles.modalityBtn} ${styles.modalityBtnDisabled}`}
            disabled
            id="modality-voice"
          >
            🎙️ Voice
          </button>
        </div>

        {/* Navigation */}
        <div className={styles.wizardNav}>
          <button
            className={`${styles.navBtn} ${
              currentIndex === 0 ? styles.navBtnDisabled : ""
            }`}
            onClick={goBackward}
            disabled={currentIndex === 0}
            id="nav-back"
          >
            ← Back
          </button>

          <button
            className={styles.skipBtn}
            onClick={skipQuestion}
            disabled={isLast}
            id="nav-skip"
          >
            Skip
          </button>

          {isLast ? (
            <button
              className="btn btn-primary"
              onClick={goForward}
              id="nav-finish"
            >
              Finish ✓
            </button>
          ) : (
            <button
              className={`${styles.navBtn} ${styles.navBtnForward} ${
                !hasAnswer ? styles.navBtnSubtle : ""
              }`}
              onClick={goForward}
              id="nav-next"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
