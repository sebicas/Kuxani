"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./attachment-styles.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { ATTACHMENT_STYLE_UPDATED } from "@/lib/socket/events";
import {
  QUIZ_STATEMENTS,
  LIKERT_LABELS,
  ATTACHMENT_STYLE_NAMES,
  ATTACHMENT_STYLE_EMOJIS,
  ATTACHMENT_STYLE_COLORS,
  ATTACHMENT_STYLE_DESCRIPTIONS,
  type AttachmentStyleKey,
} from "@/lib/data/attachment-styles";

interface AttachmentStyleResult {
  id: string;
  secure: number;
  anxious: number;
  avoidant: number;
  fearfulAvoidant: number;
  answers?: number[] | null;
  createdAt: string;
}

type ViewState = "loading" | "start" | "quiz" | "results";
type SelectedPartner = "user" | "partner";

export default function AttachmentStylesPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [userResult, setUserResult] = useState<AttachmentStyleResult | null>(null);
  const [partnerResult, setPartnerResult] = useState<AttachmentStyleResult | null>(null);
  const [userName, setUserName] = useState("You");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<SelectedPartner>("user");

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(QUIZ_STATEMENTS.length).fill(null)
  );
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  // Derive scores from answers array
  const _scores = useMemo(() => {
    const s: Record<AttachmentStyleKey, number> = { S: 0, N: 0, V: 0, F: 0 };
    for (let i = 0; i < answers.length; i++) {
      if (answers[i] !== null) {
        s[QUIZ_STATEMENTS[i].style] += answers[i]!;
      }
    }
    return s;
  }, [answers]);

  // Real-time state
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/attachment-styles");
      if (res.ok) {
        const data = await res.json();
        if (data.userName) setUserName(data.userName);
        if (data.partnerName) setPartnerName(data.partnerName);
        if (data.userResult) {
          setUserResult(data.userResult);
          setPartnerResult(data.partnerResult);
          if (view === "loading") setView("results");
        } else if (view === "loading") {
          setView("start");
        }
      } else if (view === "loading") {
        setView("start");
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
      if (view === "loading") setView("start");
    }
  }, [view]);

  useEffect(() => {
    // Initial data fetch — inline async IIFE to avoid calling setState synchronously via fetchResults
    (async () => {
      try {
        const res = await fetch("/api/attachment-styles");
        if (res.ok) {
          const data = await res.json();
          if (data.userName) setUserName(data.userName);
          if (data.partnerName) setPartnerName(data.partnerName);
          if (data.userResult) {
            setUserResult(data.userResult);
            setPartnerResult(data.partnerResult);
            setView("results");
          } else {
            setView("start");
          }
        } else {
          setView("start");
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
        setView("start");
      }
    })();
    // Fetch couple + user info for real-time
    fetch("/api/couples")
      .then((r) => r.json())
      .then((data) => {
        if (data.couple?.id) setCoupleId(data.couple.id);
      })
      .catch(() => {});
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});
  }, []);

  // Real-time: auto-refresh when partner completes the quiz
  useCoupleSocket(coupleId, ATTACHMENT_STYLE_UPDATED, currentUserId, fetchResults);

  function startQuiz() {
    setAnswers(Array(QUIZ_STATEMENTS.length).fill(null));
    setCurrentQuestion(0);
    // Fisher-Yates shuffle for random question order
    const order = Array.from({ length: QUIZ_STATEMENTS.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setShuffledOrder(order);
    setView("quiz");
  }

  function selectRating(rating: number) {
    const originalIdx = shuffledOrder[currentQuestion];
    const updated = [...answers];
    updated[originalIdx] = rating;
    setAnswers(updated);

    if (currentQuestion < QUIZ_STATEMENTS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function goBack() {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  }

  function goForward() {
    const originalIdx = shuffledOrder[currentQuestion];
    if (currentQuestion < QUIZ_STATEMENTS.length - 1 && answers[originalIdx] !== null) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  async function submitQuiz() {
    // Derive final scores from answers
    const finalScores: Record<AttachmentStyleKey, number> = { S: 0, N: 0, V: 0, F: 0 };
    for (let i = 0; i < answers.length; i++) {
      if (answers[i] !== null) {
        finalScores[QUIZ_STATEMENTS[i].style] += answers[i]!;
      }
    }
    try {
      const res = await fetch("/api/attachment-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secure: finalScores.S,
          anxious: finalScores.N,
          avoidant: finalScores.V,
          fearfulAvoidant: finalScores.F,
          answers: answers.filter((a): a is number => a !== null),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setUserResult(result);
        // MANDATORY: Fetch partner result — they may have already completed the quiz
        try {
          const fullRes = await fetch("/api/attachment-styles");
          if (fullRes.ok) {
            const data = await fullRes.json();
            if (data.partnerResult) setPartnerResult(data.partnerResult);
            if (data.userName) setUserName(data.userName);
            if (data.partnerName) setPartnerName(data.partnerName);
          }
        } catch { /* partner result is optional */ }
        setView("results");
      }
    } catch (err) {
      console.error("Failed to save results:", err);
    }
  }

  /** Convert a result object to ranked style array */
  function getRankedStyles(result: AttachmentStyleResult) {
    const entries: Array<{ key: AttachmentStyleKey; score: number }> = [
      { key: "S", score: result.secure },
      { key: "N", score: result.anxious },
      { key: "V", score: result.avoidant },
      { key: "F", score: result.fearfulAvoidant },
    ];
    return entries.sort((a, b) => b.score - a.score);
  }

  // Active result = whichever partner is selected
  const activeResult = selectedPartner === "user" ? userResult : partnerResult;
  const activeName = selectedPartner === "user" ? userName : (partnerName || "Partner");

  const rankedActive = useMemo(
    () => (activeResult ? getRankedStyles(activeResult) : []),
    [activeResult]
  );

  const maxScore = useMemo(() => {
    if (!activeResult) return 1;
    return Math.max(
      activeResult.secure,
      activeResult.anxious,
      activeResult.avoidant,
      activeResult.fearfulAvoidant,
      1
    );
  }, [activeResult]);

  if (view === "loading") {
    return (
      <div>
        <div className={styles.asHeader}>
          <h1 className="heading-2">Attachment Styles 🔗</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-3xl)" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // ── Start State ──
  if (view === "start") {
    return (
      <div>
        <div className={styles.asHeader}>
          <h1 className="heading-2">Attachment Styles 🔗</h1>
        </div>
        <div className={`card ${styles.startCard}`}>
          <span className={styles.startIcon}>🔗</span>
          <h2 className={styles.startTitle}>Discover Your Attachment Style</h2>
          <p className={styles.startDescription}>
            Understanding your attachment style can help you and your partner
            build a more secure and fulfilling bond. Rate 40 statements to
            discover your primary attachment style.
          </p>
          <div className={styles.stylePreview}>
            {(Object.keys(ATTACHMENT_STYLE_NAMES) as AttachmentStyleKey[]).map((key) => (
              <span key={key} className={styles.styleTag}>
                {ATTACHMENT_STYLE_EMOJIS[key]} {ATTACHMENT_STYLE_NAMES[key]}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startQuiz}>
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz State ──
  if (view === "quiz") {
    const originalIdx = shuffledOrder[currentQuestion];
    const statement = QUIZ_STATEMENTS[originalIdx];
    const progress = ((currentQuestion + 1) / QUIZ_STATEMENTS.length) * 100;
    const currentAnswer = answers[originalIdx];
    const allAnswered = answers.every((a) => a !== null);
    const isLast = currentQuestion === QUIZ_STATEMENTS.length - 1;

    return (
      <div>
        <div className={styles.asHeader}>
          <h1 className="heading-2">Attachment Styles 🔗</h1>
        </div>

        <div className={styles.quizContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.progressText}>
            Question {currentQuestion + 1} of {QUIZ_STATEMENTS.length}
          </p>

          <div className={styles.questionCard}>
            <p className={styles.statementText}>
              &ldquo;{statement.text}&rdquo;
            </p>

            <div className={styles.likertContainer}>
              <div className={styles.likertLabels}>
                <span className={`${styles.likertLabel} ${styles.likertLabelDisagree}`}>No, Strongly Disagree</span>
                <span className={`${styles.likertLabel} ${styles.likertLabelAgree}`}>Yes, Strongly Agree</span>
              </div>
              <div className={styles.likertScale}>
                {LIKERT_LABELS.map((label, index) => (
                  <button
                    key={index}
                    className={`${styles.likertBtn}${currentAnswer === index + 1 ? ` ${styles.likertBtnSelected}` : ""}`}
                    onClick={() => selectRating(index + 1)}
                    title={label}
                    aria-label={label}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.quizNav}>
            <button
              className={`${styles.navBtn}${currentQuestion === 0 ? ` ${styles.navBtnDisabled}` : ""}`}
              onClick={goBack}
              disabled={currentQuestion === 0}
            >
              ← Back
            </button>

            {isLast && allAnswered ? (
              <button className="btn btn-primary" onClick={submitQuiz}>
                Submit
              </button>
            ) : (
              <button
                className={`${styles.navBtn}${currentAnswer === null ? ` ${styles.navBtnDisabled}` : ""}`}
                onClick={goForward}
                disabled={currentAnswer === null}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Results State ──
  const topStyle = rankedActive[0];
  const activeAnswers = activeResult?.answers as number[] | null | undefined;

  return (
    <div>
      <div className={styles.asHeader}>
        <h1 className="heading-2">Attachment Styles 🔗</h1>
      </div>

      <div className={styles.resultsContainer}>
        {/* Partner Toggle */}
        <div className={styles.partnerToggle}>
          <button
            className={`${styles.partnerTab}${selectedPartner === "user" ? ` ${styles.partnerTabActive}` : ""}`}
            onClick={() => setSelectedPartner("user")}
          >
            <span className={styles.partnerTabEmoji}>👤</span>
            <span>{userName}</span>
            {userResult && (
              <span className={styles.partnerTabBadge} style={{ background: ATTACHMENT_STYLE_COLORS[getRankedStyles(userResult)[0].key] }}>
                {ATTACHMENT_STYLE_EMOJIS[getRankedStyles(userResult)[0].key]}
              </span>
            )}
          </button>
          <button
            className={`${styles.partnerTab}${selectedPartner === "partner" ? ` ${styles.partnerTabActive}` : ""}${!partnerResult ? ` ${styles.partnerTabDisabled}` : ""}`}
            onClick={() => partnerResult && setSelectedPartner("partner")}
            disabled={!partnerResult}
          >
            <span className={styles.partnerTabEmoji}>💑</span>
            <span>{partnerName || "Partner"}</span>
            {partnerResult ? (
              <span className={styles.partnerTabBadge} style={{ background: ATTACHMENT_STYLE_COLORS[getRankedStyles(partnerResult)[0].key] }}>
                {ATTACHMENT_STYLE_EMOJIS[getRankedStyles(partnerResult)[0].key]}
              </span>
            ) : (
              <span className={styles.partnerTabPending}>Pending</span>
            )}
          </button>
        </div>

        {/* Active Result Content */}
        {activeResult ? (
          <>
            {/* Top Result */}
            <div className={`card ${styles.resultsSummary}`}>
              <span className={styles.resultsTopEmoji}>
                {topStyle ? ATTACHMENT_STYLE_EMOJIS[topStyle.key] : "🔗"}
              </span>
              <div className={styles.resultsTopLabel}>{activeName}&apos;s primary attachment style</div>
              <div
                className={styles.resultsTopName}
                style={{ color: topStyle ? ATTACHMENT_STYLE_COLORS[topStyle.key] : undefined }}
              >
                {topStyle ? ATTACHMENT_STYLE_NAMES[topStyle.key] : ""}
              </div>
              <p className={styles.resultsDescription}>
                {topStyle ? ATTACHMENT_STYLE_DESCRIPTIONS[topStyle.key] : ""}
              </p>
            </div>

            {/* Bar Chart */}
            <div className={styles.barChart}>
              {rankedActive.map((style) => (
                <div key={style.key} className={styles.barRow}>
                  <div className={styles.barLabel}>
                    <span>{ATTACHMENT_STYLE_EMOJIS[style.key]}</span>
                    {ATTACHMENT_STYLE_NAMES[style.key]}
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(style.score / Math.max(maxScore, 1)) * 100}%`,
                        background: ATTACHMENT_STYLE_COLORS[style.key],
                      }}
                    >
                      <span className={styles.barScore}>{style.score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quiz Answers */}
            {activeAnswers && activeAnswers.length > 0 && (
              <div className={styles.answersSection}>
                <h2 className="heading-3">Quiz Answers</h2>
                <div className={styles.answersList}>
                  {QUIZ_STATEMENTS.map((stmt, idx) => {
                    const rating = activeAnswers[idx];

                    return (
                      <div key={stmt.id} className={styles.answerItem}>
                        <div className={styles.answerNumber}>Q{stmt.id}</div>
                        <div className={styles.answerContent}>
                          <div className={styles.answerStatement}>{stmt.text}</div>
                          <div className={styles.answerRatingRow}>
                            <span
                              className={styles.answerStyleTag}
                              style={{ color: ATTACHMENT_STYLE_COLORS[stmt.style] }}
                            >
                              {ATTACHMENT_STYLE_EMOJIS[stmt.style]} {ATTACHMENT_STYLE_NAMES[stmt.style]}
                            </span>
                            <div className={styles.answerLikert}>
                              {LIKERT_LABELS.map((label, i) => (
                                <span
                                  key={i}
                                  className={`${styles.answerDot}${rating === i + 1 ? ` ${styles.answerDotSelected}` : ""}`}
                                  style={rating === i + 1 ? { background: ATTACHMENT_STYLE_COLORS[stmt.style], borderColor: ATTACHMENT_STYLE_COLORS[stmt.style] } : undefined}
                                  title={label}
                                >
                                  {i + 1}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`card ${styles.comparisonWaiting}`}>
            <p>
              {partnerName || "Your partner"} hasn&apos;t taken the quiz yet. Once they do,
              you&apos;ll see their results here.
            </p>
          </div>
        )}

        {/* Retake */}
        <div className={styles.retakeRow}>
          <button className="btn btn-secondary" onClick={startQuiz}>
            Retake Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
