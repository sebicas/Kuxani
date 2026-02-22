"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./love-languages.module.css";
import { useCoupleSocket } from "@/lib/hooks/useCoupleSocket";
import { LOVE_LANGUAGE_UPDATED } from "@/lib/socket/events";
import {
  QUIZ_QUESTIONS,
  LOVE_LANGUAGE_NAMES,
  LOVE_LANGUAGE_EMOJIS,
  LOVE_LANGUAGE_COLORS,
  LOVE_LANGUAGE_DESCRIPTIONS,
  type LoveLanguageKey,
} from "@/lib/data/love-languages";

interface LoveLanguageResult {
  id: string;
  wordsOfAffirmation: number;
  actsOfService: number;
  receivingGifts: number;
  qualityTime: number;
  physicalTouch: number;
  answers?: LoveLanguageKey[] | null;
  createdAt: string;
}

type ViewState = "loading" | "start" | "quiz" | "results";
type SelectedPartner = "user" | "partner";

export default function LoveLanguagesPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [userResult, setUserResult] = useState<LoveLanguageResult | null>(null);
  const [partnerResult, setPartnerResult] = useState<LoveLanguageResult | null>(null);
  const [userName, setUserName] = useState("You");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<SelectedPartner>("user");

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(LoveLanguageKey | null)[]>(
    () => Array(QUIZ_QUESTIONS.length).fill(null)
  );

  // Derive scores from answers array
  const _scores = useMemo(() => {
    const s: Record<LoveLanguageKey, number> = { W: 0, A: 0, G: 0, Q: 0, T: 0 };
    for (const a of answers) {
      if (a) s[a]++;
    }
    return s;
  }, [answers]);

  // Real-time state
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/love-languages");
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
        const res = await fetch("/api/love-languages");
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
  useCoupleSocket(coupleId, LOVE_LANGUAGE_UPDATED, currentUserId, fetchResults);

  function startQuiz() {
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
    setCurrentQuestion(0);
    setView("quiz");
  }

  function selectOption(language: LoveLanguageKey) {
    const updated = [...answers];
    updated[currentQuestion] = language;
    setAnswers(updated);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function goBack() {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  }

  function goForward() {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1 && answers[currentQuestion] !== null) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  async function submitQuiz() {
    // Derive final scores from answers
    const finalScores: Record<LoveLanguageKey, number> = { W: 0, A: 0, G: 0, Q: 0, T: 0 };
    for (const a of answers) {
      if (a) finalScores[a]++;
    }
    try {
      const res = await fetch("/api/love-languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordsOfAffirmation: finalScores.W,
          actsOfService: finalScores.A,
          receivingGifts: finalScores.G,
          qualityTime: finalScores.Q,
          physicalTouch: finalScores.T,
          answers: answers.filter((a): a is LoveLanguageKey => a !== null),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setUserResult(result);
        // MANDATORY: Fetch partner result — they may have already completed the quiz
        try {
          const fullRes = await fetch("/api/love-languages");
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

  /** Convert a result object to ranked language array */
  function getRankedLanguages(result: LoveLanguageResult) {
    const entries: Array<{ key: LoveLanguageKey; score: number }> = [
      { key: "W", score: result.wordsOfAffirmation },
      { key: "A", score: result.actsOfService },
      { key: "G", score: result.receivingGifts },
      { key: "Q", score: result.qualityTime },
      { key: "T", score: result.physicalTouch },
    ];
    return entries.sort((a, b) => b.score - a.score);
  }

  // Active result = whichever partner is selected
  const activeResult = selectedPartner === "user" ? userResult : partnerResult;
  const activeName = selectedPartner === "user" ? userName : (partnerName || "Partner");

  const rankedActive = useMemo(
    () => (activeResult ? getRankedLanguages(activeResult) : []),
    [activeResult]
  );

  const maxScore = useMemo(() => {
    if (!activeResult) return 1;
    return Math.max(
      activeResult.wordsOfAffirmation,
      activeResult.actsOfService,
      activeResult.receivingGifts,
      activeResult.qualityTime,
      activeResult.physicalTouch,
      1
    );
  }, [activeResult]);

  if (view === "loading") {
    return (
      <div>
        <div className={styles.llHeader}>
          <h1 className="heading-2">Love Languages 💕</h1>
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
        <div className={styles.llHeader}>
          <h1 className="heading-2">Love Languages 💕</h1>
        </div>
        <div className={`card ${styles.startCard}`}>
          <span className={styles.startIcon}>💕</span>
          <h2 className={styles.startTitle}>Discover Your Love Language</h2>
          <p className={styles.startDescription}>
            Understanding how you and your partner express and receive love can
            transform your relationship. Take this 30-question quiz to discover
            your primary love language.
          </p>
          <div className={styles.languagePreview}>
            {(Object.keys(LOVE_LANGUAGE_NAMES) as LoveLanguageKey[]).map((key) => (
              <span key={key} className={styles.languageTag}>
                {LOVE_LANGUAGE_EMOJIS[key]} {LOVE_LANGUAGE_NAMES[key]}
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
    const question = QUIZ_QUESTIONS[currentQuestion];
    const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;
    const currentAnswer = answers[currentQuestion];
    const allAnswered = answers.every((a) => a !== null);
    const isLast = currentQuestion === QUIZ_QUESTIONS.length - 1;

    return (
      <div>
        <div className={styles.llHeader}>
          <h1 className="heading-2">Love Languages 💕</h1>
        </div>

        <div className={styles.quizContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.progressText}>
            Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
          </p>

          <div className={styles.questionCard}>
            <p className={styles.questionText}>
              Which statement resonates more with you?
            </p>

            <div className={styles.optionsList}>
              <button
                className={`${styles.optionBtn}${currentAnswer === question.optionA.language ? ` ${styles.selectedOption}` : ""}`}
                onClick={() => selectOption(question.optionA.language)}
              >
                <div className={styles.optionLabel}>Option A</div>
                {question.optionA.text}
              </button>
              <button
                className={`${styles.optionBtn}${currentAnswer === question.optionB.language ? ` ${styles.selectedOption}` : ""}`}
                onClick={() => selectOption(question.optionB.language)}
              >
                <div className={styles.optionLabel}>Option B</div>
                {question.optionB.text}
              </button>
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
  const topLanguage = rankedActive[0];
  const activeAnswers = activeResult?.answers as LoveLanguageKey[] | null | undefined;

  return (
    <div>
      <div className={styles.llHeader}>
        <h1 className="heading-2">Love Languages 💕</h1>
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
              <span className={styles.partnerTabBadge} style={{ background: LOVE_LANGUAGE_COLORS[getRankedLanguages(userResult)[0].key] }}>
                {LOVE_LANGUAGE_EMOJIS[getRankedLanguages(userResult)[0].key]}
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
              <span className={styles.partnerTabBadge} style={{ background: LOVE_LANGUAGE_COLORS[getRankedLanguages(partnerResult)[0].key] }}>
                {LOVE_LANGUAGE_EMOJIS[getRankedLanguages(partnerResult)[0].key]}
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
                {topLanguage ? LOVE_LANGUAGE_EMOJIS[topLanguage.key] : "💕"}
              </span>
              <div className={styles.resultsTopLabel}>{activeName}&apos;s primary love language</div>
              <div
                className={styles.resultsTopName}
                style={{ color: topLanguage ? LOVE_LANGUAGE_COLORS[topLanguage.key] : undefined }}
              >
                {topLanguage ? LOVE_LANGUAGE_NAMES[topLanguage.key] : ""}
              </div>
              <p className={styles.resultsDescription}>
                {topLanguage ? LOVE_LANGUAGE_DESCRIPTIONS[topLanguage.key] : ""}
              </p>
            </div>

            {/* Bar Chart */}
            <div className={styles.barChart}>
              {rankedActive.map((lang) => (
                <div key={lang.key} className={styles.barRow}>
                  <div className={styles.barLabel}>
                    <span>{LOVE_LANGUAGE_EMOJIS[lang.key]}</span>
                    {LOVE_LANGUAGE_NAMES[lang.key]}
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(lang.score / Math.max(maxScore, 1)) * 100}%`,
                        background: LOVE_LANGUAGE_COLORS[lang.key],
                      }}
                    >
                      <span className={styles.barScore}>{lang.score}</span>
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
                  {QUIZ_QUESTIONS.map((q, idx) => {
                    const answer = activeAnswers[idx];
                    const choseA = answer === q.optionA.language;
                    const choseB = answer === q.optionB.language;

                    return (
                      <div key={q.id} className={styles.answerItem}>
                        <div className={styles.answerNumber}>Q{q.id}</div>
                        <div className={styles.answerOptions}>
                          <div
                            className={`${styles.answerOption}${choseA ? ` ${styles.answerChosen}` : ""}`}
                            style={choseA ? { borderColor: LOVE_LANGUAGE_COLORS[q.optionA.language], background: `${LOVE_LANGUAGE_COLORS[q.optionA.language]}15` } : undefined}
                          >
                            <span className={styles.answerLanguageTag} style={{ color: LOVE_LANGUAGE_COLORS[q.optionA.language] }}>
                              {LOVE_LANGUAGE_EMOJIS[q.optionA.language]} {LOVE_LANGUAGE_NAMES[q.optionA.language]}
                            </span>
                            <span className={styles.answerText}>{q.optionA.text}</span>
                            {choseA && <span className={styles.answerCheck}>✓</span>}
                          </div>
                          <div
                            className={`${styles.answerOption}${choseB ? ` ${styles.answerChosen}` : ""}`}
                            style={choseB ? { borderColor: LOVE_LANGUAGE_COLORS[q.optionB.language], background: `${LOVE_LANGUAGE_COLORS[q.optionB.language]}15` } : undefined}
                          >
                            <span className={styles.answerLanguageTag} style={{ color: LOVE_LANGUAGE_COLORS[q.optionB.language] }}>
                              {LOVE_LANGUAGE_EMOJIS[q.optionB.language]} {LOVE_LANGUAGE_NAMES[q.optionB.language]}
                            </span>
                            <span className={styles.answerText}>{q.optionB.text}</span>
                            {choseB && <span className={styles.answerCheck}>✓</span>}
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
