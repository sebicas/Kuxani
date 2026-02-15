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
  createdAt: string;
}

type ViewState = "loading" | "start" | "quiz" | "results";

export default function AttachmentStylesPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [userResult, setUserResult] = useState<AttachmentStyleResult | null>(null);
  const [partnerResult, setPartnerResult] = useState<AttachmentStyleResult | null>(null);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [scores, setScores] = useState<Record<AttachmentStyleKey, number>>({
    S: 0, N: 0, V: 0, F: 0,
  });

  // Real-time state
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/attachment-styles");
      if (res.ok) {
        const data = await res.json();
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
    // Initial data fetch
    (async () => {
      try {
        const res = await fetch("/api/attachment-styles");
        if (res.ok) {
          const data = await res.json();
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
    setScores({ S: 0, N: 0, V: 0, F: 0 });
    setCurrentQuestion(0);
    setView("quiz");
  }

  async function selectRating(rating: number) {
    const statement = QUIZ_STATEMENTS[currentQuestion];
    const newScores = {
      ...scores,
      [statement.style]: scores[statement.style] + rating,
    };
    setScores(newScores);

    if (currentQuestion < QUIZ_STATEMENTS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete — save results
      try {
        const res = await fetch("/api/attachment-styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secure: newScores.S,
            anxious: newScores.N,
            avoidant: newScores.V,
            fearfulAvoidant: newScores.F,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          setUserResult(result);
          setView("results");
        }
      } catch (err) {
        console.error("Failed to save results:", err);
      }
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

  const rankedUser = useMemo(
    () => (userResult ? getRankedStyles(userResult) : []),
    [userResult]
  );

  const rankedPartner = useMemo(
    () => (partnerResult ? getRankedStyles(partnerResult) : []),
    [partnerResult]
  );

  const maxScore = useMemo(() => {
    if (!userResult) return 1;
    return Math.max(
      userResult.secure,
      userResult.anxious,
      userResult.avoidant,
      userResult.fearfulAvoidant,
      1
    );
  }, [userResult]);

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
            build a more secure and fulfilling bond. Rate 20 statements to
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
    const statement = QUIZ_STATEMENTS[currentQuestion];
    const progress = ((currentQuestion + 1) / QUIZ_STATEMENTS.length) * 100;

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
                <span className={styles.likertLabel}>Strongly Disagree</span>
                <span className={styles.likertLabel}>Strongly Agree</span>
              </div>
              <div className={styles.likertScale}>
                {LIKERT_LABELS.map((label, index) => (
                  <button
                    key={index}
                    className={styles.likertBtn}
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
        </div>
      </div>
    );
  }

  // ── Results State ──
  const topStyle = rankedUser[0];

  return (
    <div>
      <div className={styles.asHeader}>
        <h1 className="heading-2">Attachment Styles 🔗</h1>
      </div>

      <div className={styles.resultsContainer}>
        {/* Top Result */}
        <div className={`card ${styles.resultsSummary}`}>
          <span className={styles.resultsTopEmoji}>
            {topStyle ? ATTACHMENT_STYLE_EMOJIS[topStyle.key] : "🔗"}
          </span>
          <div className={styles.resultsTopLabel}>Your primary attachment style</div>
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
          {rankedUser.map((style) => (
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

        {/* Partner Comparison */}
        <div className={styles.comparisonSection}>
          <h2 className="heading-3">Partner Comparison</h2>
          {partnerResult ? (
            <div className={`card ${styles.comparisonGrid}`}>
              <div className={styles.comparisonCard}>
                <div className={styles.comparisonLabel}>You</div>
                <div className={styles.comparisonEmoji}>
                  {topStyle ? ATTACHMENT_STYLE_EMOJIS[topStyle.key] : "🔗"}
                </div>
                <div className={styles.comparisonName}>
                  {topStyle ? ATTACHMENT_STYLE_NAMES[topStyle.key] : ""}
                </div>
              </div>
              <div className={styles.comparisonCard}>
                <div className={styles.comparisonLabel}>Your Partner</div>
                <div className={styles.comparisonEmoji}>
                  {ATTACHMENT_STYLE_EMOJIS[rankedPartner[0]?.key || "S"]}
                </div>
                <div className={styles.comparisonName}>
                  {ATTACHMENT_STYLE_NAMES[rankedPartner[0]?.key || "S"]}
                </div>
              </div>
            </div>
          ) : (
            <div className={`card ${styles.comparisonWaiting}`}>
              <p>
                Your partner hasn&apos;t taken the quiz yet. Once they do,
                you&apos;ll see a side-by-side comparison here.
              </p>
            </div>
          )}
        </div>

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
