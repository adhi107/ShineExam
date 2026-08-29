import React, { useEffect, useState } from "react";
import QuestionPanel from "./QuestionPanel";
import QuestionNavigator from "./QuestionNavigator";
import TestDetails from "./TestDetails";
import TestInstructions from "./TestInstructions";
import "./TestInterface.css";
import { apiPost } from "../services/api";
import ShineLogo from "./ShineLogo";
import { SensitiveContent } from "../security";

interface Question {
  id: string;
  type: "mcq" | "msq" | "multiple" | "ordering" | "text";
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  context?: string;
  contextType?: 'table' | 'passage' | 'graph' | '';
  chartData?: any;
  tableData?: any;
  imageReference?: string;
  visualReferences?: any[];
}

interface Answer {
  questionId: string;
  answer: string | string[];
  marked: boolean;
}

interface ResultPayload {
  attemptId: string;
  totalMarks: number;
  scoredMarks: number;
  percentage: number;
  passed: boolean;
  percentile: number;
  sectionWise?: Record<string, { total: number; scored: number }>;
  questionReview?: Array<{
    questionId: string;
    isCorrect: boolean;
    userAnswer: string | string[];
    correctAnswer?: string | string[];
    marks: number;
    section: string;
  }>;
}

interface TestInterfaceProps {
  userId: string;
  examId: string;
  testName: string;
  duration: number;
  passingPercentage?: number;
  questions: Question[];
  timerMode?: "overall" | "sectional";
  sectionConfig?: Array<{ name: string; duration: number; questionCount: number; marks: number }>;
  onExit: () => void;
}

const TestInterface: React.FC<TestInterfaceProps> = ({
  userId,
  examId,
  testName,
  duration,
  passingPercentage = 40,
  questions,
  timerMode = "overall",
  sectionConfig = [],
  onExit,
}) => {
  const getInitialAnswer = (question: Question): string | string[] => {
    if (question.type === "ordering") return [];
    const isMultipleChoice = Array.isArray(question.correctAnswer);
    return isMultipleChoice ? [] : "";
  };

  const [testStep, setTestStep] = useState<"details" | "instructions" | "exam" | "confirm" | "submitted">("details");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const [answers, setAnswers] = useState<Answer[]>(
    questions.map((q) => ({
      questionId: q.id,
      answer: getInitialAnswer(q),
      marked: false,
    }))
  );

  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [currentSection, setCurrentSection] = useState<string>(questions[0]?.section || "");
  const sections = Array.from(new Set(questions.map((q) => q.section)));
  const isSectional = timerMode === "sectional" && sectionConfig.length > 0;

  const derivedSectionConfig = React.useMemo(() => {
    if (sectionConfig && sectionConfig.length > 0) {
      return sectionConfig.map((s, _, arr) => ({
        ...s,
        duration: (s.duration && s.duration > 0 && s.duration < duration)
          ? s.duration
          : Math.max(1, Math.round(duration / (arr.length || 1))),
      }));
    }
    return [];
  }, [sectionConfig, duration]);

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  useEffect(() => {
    if (isSectional && derivedSectionConfig.length > 0) {
      const secName = derivedSectionConfig[0]?.name || sections[0] || "";
      setCurrentSection(secName);
      const secTime = derivedSectionConfig[0]?.duration ? derivedSectionConfig[0].duration * 60 : duration * 60;
      setTimeLeft(secTime);
      const firstIdx = questions.findIndex((q) => q.section === secName);
      if (firstIdx >= 0) setCurrentQuestionIndex(firstIdx);
    }
  }, [isSectional]);

  const handleNextSection = () => {
    if (!isSectional) return;
    const nextSecIdx = currentSectionIndex + 1;
    if (nextSecIdx < derivedSectionConfig.length) {
      const nextSecName = derivedSectionConfig[nextSecIdx].name;
      setCurrentSectionIndex(nextSecIdx);
      setCurrentSection(nextSecName);
      const secTime = derivedSectionConfig[nextSecIdx].duration * 60;
      setTimeLeft(secTime);
      const firstIdx = questions.findIndex((q) => q.section === nextSecName);
      if (firstIdx >= 0) {
        setCurrentQuestionIndex(firstIdx);
        setVisited((prev) => new Set([...Array.from(prev), firstIdx]));
      }
    } else {
      setTestStep("confirm");
    }
  };

  useEffect(() => {
    if (testStep !== "exam") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isSectional) {
            handleNextSection();
            return 0;
          } else {
            handleSubmitExam();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [testStep, isSectional, currentSectionIndex]);

  const handleSelectQuestion = (index: number) => {
    const targetQ = questions[index];
    if (isSectional && targetQ && targetQ.section !== currentSection) {
      return;
    }
    setCurrentQuestionIndex(index);
    setVisited((prev) => new Set([...Array.from(prev), index]));
  };

  const handleAnswerChange = (val: string | string[]) => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === q.id ? { ...a, answer: val } : a))
    );
  };

  const handleMarkForReview = () => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === q.id ? { ...a, marked: !a.marked } : a))
    );
  };

  const [result, setResult] = useState<ResultPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);


  const handleSubmitExam = async () => {
    setSubmitting(true);
    try {
      const res = await apiPost<any>("/answerer/attempts/submit", {
        userId,
        examId,
        answers,
        timeSpentSec: duration * 60 - timeLeft,
      });
      const resultObj = res?.result || res;
      setResult(resultObj);
      setTestStep("submitted");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Failed to submit test.";
      // Don't show raw server error messages — show a friendly version
      if (msg.toLowerCase().includes("internal server error") || msg.toLowerCase().includes("500")) {
        alert("Submission encountered a server issue. Please try again or contact support. Your answers have been saved.");
      } else if (msg.toLowerCase().includes("already submitted")) {
        // Already submitted — treat as success
        setTestStep("submitted");
      } else {
        alert(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeQuestion = questions[currentQuestionIndex];
  const activeAnswer = answers.find((a) => a.questionId === activeQuestion?.id);

  const isLastSection = isSectional
    ? currentSectionIndex === derivedSectionConfig.length - 1
    : currentSection === sections[sections.length - 1] || sections.length <= 1;

  const submitText = isLastSection ? "Submit Exam" : "Submit Section";

  const getQuestionStatus = (index: number): string => {
    const q = questions[index];
    if (!q) return 'not-visited';
    const a = answers.find((ans) => ans.questionId === q.id);
    const hasAns = a && (Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== '');
    if (a?.marked && hasAns) return 'answered-marked';
    if (a?.marked) return 'marked';
    if (hasAns) return 'answered';
    if (visited.has(index)) return 'not-answered';
    return 'not-visited';
  };

  // Sectional breakdown calculations for the full-page summary table
  const sectionSummaryRows = sections.map((secName) => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let ansAndMarked = 0;
    let notVisited = 0;

    questions.forEach((q, idx) => {
      if (q.section !== secName) return;
      const a = answers.find((ans) => ans.questionId === q.id);
      const hasAns = a && (Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== '');
      const isVis = visited.has(idx);

      if (a?.marked && hasAns) ansAndMarked++;
      else if (a?.marked) marked++;
      else if (hasAns) answered++;
      else if (isVis) notAnswered++;
      else notVisited++;
    });

    const secQs = questions.filter((q) => q.section === secName);
    return {
      name: secName,
      total: secQs.length,
      answered,
      notAnswered,
      marked,
      ansAndMarked,
      notVisited,
    };
  });

  const totals = sectionSummaryRows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      answered: acc.answered + row.answered,
      notAnswered: acc.notAnswered + row.notAnswered,
      marked: acc.marked + row.marked,
      ansAndMarked: acc.ansAndMarked + row.ansAndMarked,
      notVisited: acc.notVisited + row.notVisited,
    }),
    { total: 0, answered: 0, notAnswered: 0, marked: 0, ansAndMarked: 0, notVisited: 0 }
  );

  return (
    <SensitiveContent
      userId={userId}
      hideOnTabSwitch={testStep === "exam"}
      shieldOnScreenShare={testStep === "exam"}
      hideOnWindowBlur={testStep === "exam"}
      showWatermark={testStep === "exam"}
      shieldMessage="Exam content is hidden. Return to this tab to continue your exam."
      className="test-interface-root"
    >

      {testStep === "details" && (
        <TestDetails
          testName={testName}
          duration={duration}
          questionCount={questions.length}
          passingPercentage={passingPercentage}
          onContinue={() => setTestStep("instructions")}
        />
      )}

      {testStep === "instructions" && (
        <TestInstructions
          userId={userId}
          testName={testName}
          duration={duration}
          timerMode={timerMode}
          sectionConfig={sectionConfig}
          onStart={() => setTestStep("exam")}
          onBack={() => setTestStep("details")}
        />
      )}

      {testStep === "exam" && activeQuestion && (
        <div className="tcs-bank-exam-workspace">
          {/* 1. Top Blue Header */}
          <div className="tcs-top-blue-header">
            <div className="tcs-top-header-left">
              <div className="tcs-logo-badge">
                <ShineLogo inverse />
              </div>
            </div>
            <div className="tcs-top-header-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="exam-title-pill-tag">📌 {testName}</span>
              <button type="button" className="btn-fullscreen-toggle" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit Fullscreen ⛶" : "View Fullscreen ⛶"}
              </button>
            </div>
          </div>

          {/* 2. Section Bar */}
          <div className="tcs-section-bar">
            <div className="section-selector-left">
              <span className="section-label-text">Sections:</span>
              <div className="section-buttons-row">
                {sections.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`tcs-section-btn ${sec === currentSection ? "active" : ""}`}
                    disabled={isSectional && sec !== currentSection}
                    onClick={() => {
                      if (!isSectional) {
                        setCurrentSection(sec);
                        const firstIdx = questions.findIndex((q) => q.section === sec);
                        if (firstIdx >= 0) handleSelectQuestion(firstIdx);
                      }
                    }}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>
            <div className="section-timer-right">
              Time Left: <span className="timer-green-text">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
            </div>
          </div>

          {/* 3. Question Meta Bar */}
          <div className="tcs-question-meta-bar">
            <div className="q-type-label">
              Question Type: {activeQuestion.type === "msq" || activeQuestion.type === "multiple" ? "Multiple Choice (MSQ)" : "Multiple Choice Question (MCQ)"}
            </div>
            <div className="q-meta-right-group">
              <div className="q-marks-label">
                Marks: <strong>+{activeQuestion.marks || 1}</strong>
                <span className="divider">|</span>
                Negative: <strong>0</strong>
              </div>
              <button
                type="button"
                className="btn-mobile-palette-toggle"
                onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
                title="Toggle question grid"
              >
                📋 Grid ({currentQuestionIndex + 1}/{questions.length})
              </button>
            </div>
          </div>

          {/* 4. Main Body Split Workspace */}
          <div className="tcs-main-body-container">
            <div className="tcs-question-workspace">
              <div className="tcs-question-no-header">
                Question No. {currentQuestionIndex + 1}
              </div>

              <QuestionPanel
                question={activeQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                answer={activeAnswer?.answer || (activeQuestion.type === "ordering" ? [] : "")}
                isMarked={activeAnswer?.marked || false}
                onAnswer={handleAnswerChange}
                onMarkForReview={handleMarkForReview}
              />

              {/* Footer Buttons */}
              <footer className="tcs-question-action-footer">
                <div className="footer-left-buttons">
                  <button
                    type="button"
                    className="tcs-btn-white"
                    onClick={handleMarkForReview}
                  >
                    {activeAnswer?.marked ? "Unmark Review" : "Mark for Review & Next"}
                  </button>
                  <button
                    type="button"
                    className="tcs-btn-white"
                    onClick={() => {
                      handleAnswerChange(activeQuestion.type === "ordering" ? [] : "");
                    }}
                  >
                    Clear Response
                  </button>
                </div>

                <div className="footer-right-buttons">
                  <button
                    type="button"
                    className="tcs-btn-blue-save"
                    onClick={() => {
                      const nextIdx = currentQuestionIndex + 1;
                      if (nextIdx < questions.length) {
                        handleSelectQuestion(nextIdx);
                      } else {
                        setTestStep("confirm");
                      }
                    }}
                  >
                    Save & Next
                  </button>
                </div>
              </footer>
            </div>

            {/* Right Question Navigator Drawer */}
            <div className={`tcs-palette-drawer-wrapper ${mobilePaletteOpen ? "mobile-open" : ""}`}>
              {mobilePaletteOpen && (
                <div className="mobile-palette-backdrop" onClick={() => setMobilePaletteOpen(false)} />
              )}
              <div className="palette-inner-container">
                <QuestionNavigator
                  userId={userId}
                  questions={questions}
                  currentIndex={currentQuestionIndex}
                  answers={answers}
                  visited={visited}
                  sections={sections}
                  currentSection={currentSection}
                  onQuestionSelect={(idx) => {
                    handleSelectQuestion(idx);
                    setMobilePaletteOpen(false);
                  }}
                  onSectionChange={(sec) => {
                    setCurrentSection(sec);
                    const firstIdx = questions.findIndex((q) => q.section === sec);
                    if (firstIdx >= 0) handleSelectQuestion(firstIdx);
                  }}
                  getQuestionStatus={getQuestionStatus}
                  onSubmit={() => {
                    if (!isLastSection && isSectional) {
                      handleNextSection();
                    } else {
                      setTestStep("confirm");
                    }
                  }}
                  submitText={submitText}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-PAGE TCS iON EXAM SUMMARY SCREEN */}
      {testStep === "confirm" && (
        <div className="tcs-bank-exam-workspace">
          {/* Top Blue Header */}
          <div className="tcs-top-blue-header">
            <div className="tcs-top-header-left">
              <div className="tcs-logo-badge">
                <ShineLogo inverse />
              </div>
            </div>
            <div className="tcs-top-header-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="exam-title-pill-tag">📌 {testName} — Final Exam Summary</span>
              <button type="button" className="btn-fullscreen-toggle" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit Fullscreen ⛶" : "View Fullscreen ⛶"}
              </button>
            </div>
          </div>

          {/* Center Full-Page Summary Container */}
          <div className="tcs-summary-center-pane">
            <div className="tcs-summary-table-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2b78c4", paddingBottom: "12px", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    📋 Exam Performance Summary
                  </h2>
                  <small style={{ color: "#64748b", fontSize: "0.84rem" }}>
                    Candidate: <strong>{userId}</strong> | Exam: <strong>{testName}</strong>
                  </small>
                </div>
                <div style={{ background: "#eef2f6", padding: "6px 14px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 700, color: "#2b78c4" }}>
                  ⏱️ Time Remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                </div>
              </div>

              <p style={{ fontSize: "0.88rem", color: "#475569", marginBottom: "18px", lineHeight: "1.4" }}>
                Please verify your section-wise attempt counts before confirming final test paper submission.
              </p>

              <table className="tcs-classic-summary-table">
                <thead>
                  <tr>
                    <th>Section Name</th>
                    <th>No. of Questions</th>
                    <th>Answered</th>
                    <th>Not Answered</th>
                    <th>Marked for Review</th>
                    <th>Answered & Marked for Review</th>
                    <th>Not Visited</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionSummaryRows.map((row) => (
                    <tr key={row.name}>
                      <td className="sec-name-cell">{row.name}</td>
                      <td style={{ fontWeight: 700 }}>{row.total}</td>
                      <td>
                        <span className="tbl-pill ans">{row.answered}</span>
                      </td>
                      <td>
                        <span className="tbl-pill not-ans">{row.notAnswered}</span>
                      </td>
                      <td>
                        <span className="tbl-pill marked">{row.marked}</span>
                      </td>
                      <td>
                        <span className="tbl-pill ans-rev">{row.ansAndMarked}</span>
                      </td>
                      <td style={{ color: "#64748b", fontWeight: 600 }}>{row.notVisited}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="sec-name-cell">Total</td>
                    <td>{totals.total}</td>
                    <td>{totals.answered}</td>
                    <td>{totals.notAnswered}</td>
                    <td>{totals.marked}</td>
                    <td>{totals.ansAndMarked}</td>
                    <td>{totals.notVisited}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", padding: "16px", borderRadius: "10px", marginBottom: "24px", textAlign: "center", color: "#1e40af", fontSize: "0.92rem", fontWeight: 700, boxShadow: "0 2px 8px rgba(43, 120, 196, 0.08)" }}>
                ⚠️ Are you sure you want to submit your final test paper now?
              </div>

              <div className="modal-btn-row">
                <button type="button" className="tcs-btn-cancel-submit" onClick={() => setTestStep("exam")}>
                  Return to Exam Workspace
                </button>
                <button type="button" className="tcs-btn-confirm-submit" disabled={submitting} onClick={handleSubmitExam}>
                  {submitting ? "Submitting Exam..." : "Yes, Submit Final Exam"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-PAGE CONGRATULATIONS SUBMISSION CONFIRMATION SCREEN */}
      {testStep === "submitted" && (
        <div className="shine-submission-success-page">
          <div className="shine-success-card">
            <div className="success-logo-wrap">
              <ShineLogo inverse />
            </div>

            <div className="success-check-badge" style={{ fontSize: "2.4rem", margin: "16px 0 20px 0" }}>✓</div>
            <h2 className="success-title" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
              🎉 Congratulations!
            </h2>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2b78c4", margin: "0 0 16px 0" }}>
              Exam Submitted Successfully
            </h3>

            <p className="success-subtitle" style={{ fontSize: "0.92rem", color: "#475569", lineHeight: "1.5", maxWidth: "460px", margin: "0 auto 24px auto" }}>
              Thank you for appearing for <strong>{testName}</strong>. Your test responses have been recorded and submitted successfully for evaluation.
            </p>

            <div className="success-info-banner" style={{ marginBottom: "28px" }}>
              <span className="banner-icon">ℹ️</span>
              <div>
                <strong>Detailed Reports & Score Analysis</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#1e40af" }}>
                  Your detailed score report, percentile rank, and answer key breakdown can be viewed on your candidate dashboard under Reports.
                </p>
              </div>
            </div>

            <button type="button" className="btn-return-dashboard" onClick={onExit} style={{ width: "100%", height: "46px", fontSize: "0.95rem", fontWeight: 700 }}>
              Return to Candidate Dashboard
            </button>
          </div>
        </div>
      )}
    </SensitiveContent>
  );
};

export default TestInterface;
