import React, { useEffect, useState } from "react";
import QuestionPanel from "./QuestionPanel";
import QuestionNavigator from "./QuestionNavigator";
import TestDetails from "./TestDetails";
import TestInstructions from "./TestInstructions";
import "./TestInterface.css";
import { apiGet, apiPost, apiPut } from "../services/api";
import ShineLogo from "./ShineLogo";

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
  sectionWise: Record<string, { total: number; scored: number }>;
  questionReview: Array<{
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
    const map = new Map<string, { count: number; marks: number }>();
    questions.forEach((q) => {
      const secName = q.section || "General";
      const existing = map.get(secName) || { count: 0, marks: 0 };
      map.set(secName, {
        count: existing.count + 1,
        marks: existing.marks + (q.marks || 1),
      });
    });

    const totalSecs = map.size || 1;
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      questionCount: data.count,
      marks: data.marks,
      duration: Math.max(1, Math.round(duration / totalSecs)),
    }));
  }, [questions, sectionConfig, duration]);
  const [sectionTimes, setSectionTimes] = useState<Record<string, number>>(() =>
    Object.fromEntries(sectionConfig.map((section) => [section.name, section.duration * 60]))
  );
  const currentSectionTime = isSectional ? (sectionTimes[currentSection] ?? 0) : timeLeft;

  const currentQuestion = questions[currentQuestionIndex];
  const currentSectionQuestions = questions.filter((q) => q.section === currentSection);
  const currentSectionQuestionIndex = currentSectionQuestions.findIndex((q) => q.id === currentQuestion?.id);
  const sectionQuestionNumber = currentSectionQuestionIndex >= 0 ? currentSectionQuestionIndex + 1 : 1;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Current Shine Exam attempt id returned by the backend.
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<ResultPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    apiGet<{ bookmarks: Array<{ type: string; questionId?: string }> }>(`/answerer/bookmarks?userId=${encodeURIComponent(userId)}`)
      .then(result => setBookmarkedQuestions(new Set((result.bookmarks || []).filter(item => item.type === "question" && item.questionId).map(item => item.questionId!))))
      .catch(() => setBookmarkedQuestions(new Set()));
  }, [userId]);


  useEffect(() => {
    if (testStep !== "exam" || !currentQuestion?.id) return;
    const timer = window.setInterval(() => setQuestionTimes(current => ({ ...current, [currentQuestion.id]: (current[currentQuestion.id] || 0) + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [testStep, currentQuestion?.id]);

  const toggleQuestionBookmark = async () => {
    if (!currentQuestion) return;
    const result = await apiPost<{ bookmarked: boolean }>("/answerer/bookmarks/toggle", {
      userId, type: "question", testId: examId, questionId: currentQuestion.id,
      title: testName, question: currentQuestion.question,
    });
    setBookmarkedQuestions(current => {
      const next = new Set(current);
      if (result.bookmarked) next.add(currentQuestion.id); else next.delete(currentQuestion.id);
      return next;
    });
  };

  // Shine Exam timer mode: banking tests use sequential section timers,
  // while SSC tests use the overall test timer.
  useEffect(() => {
    if (testStep !== "exam" && testStep !== "confirm") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
      if (isSectional) {
        setSectionTimes((prev) => ({
          ...prev,
          [currentSection]: Math.max(0, (prev[currentSection] ?? 0) - 1),
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testStep, isSectional, currentSection]);

  useEffect(() => {
    if ((testStep === "exam" || testStep === "confirm") && timeLeft === 0) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, testStep]);

  useEffect(() => {
    if ((testStep !== "exam" && testStep !== "confirm") || !isSectional || currentSectionTime !== 0) return;
    const activeIndex = sectionConfig.findIndex((section) => section.name === currentSection);
    const nextSection = [...sectionConfig.slice(activeIndex + 1), ...sectionConfig.slice(0, activeIndex)]
      .find((section) => (sectionTimes[section.name] ?? 0) > 0);
    if (!nextSection) {
      handleSubmit();
      return;
    }
    const firstQuestion = questions.findIndex((q) => q.section === nextSection.name);
    setCurrentSection(nextSection.name);
    if (firstQuestion >= 0) {
      setCurrentQuestionIndex(firstQuestion);
      setVisited(prev => new Set(prev).add(firstQuestion));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionTime, testStep, isSectional, currentSection, sectionTimes]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswer = (answer: string | string[]) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQuestionIndex] = { ...next[currentQuestionIndex], answer };
      return next;
    });
  };

  const handleMarkForReview = () => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQuestionIndex] = { ...next[currentQuestionIndex], marked: !next[currentQuestionIndex].marked };
      return next;
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex >= questions.length - 1) {
      if (window.confirm("You have reached the last question. Do you want to submit the exam?")) handleSubmit();
      return;
    }
    let nextIndex = currentQuestionIndex + 1;
    if (isSectional && (sectionTimes[questions[nextIndex].section] ?? 0) <= 0) {
      const availableIndex = questions.findIndex((question, index) => index > currentQuestionIndex && (sectionTimes[question.section] ?? 0) > 0);
      if (availableIndex < 0) {
        if (window.confirm("You have reached the end of the exam. Do you want to submit?")) handleSubmit();
        return;
      }
      nextIndex = availableIndex;
    }
    setCurrentQuestionIndex(nextIndex);
    setVisited(prev => new Set(prev).add(nextIndex));
    setCurrentSection(questions[nextIndex].section);
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const pi = currentQuestionIndex - 1;
      if (isSectional && (sectionTimes[questions[pi].section] ?? 0) <= 0) return;
      setCurrentQuestionIndex(pi);
      setVisited(prev => new Set(prev).add(pi));
      setCurrentSection(questions[pi].section);
    }
  };

  const handleQuestionSelect = (index: number) => {
    if (isSectional && (sectionTimes[questions[index].section] ?? 0) <= 0) return;
    setCurrentQuestionIndex(index);
    setVisited(prev => new Set(prev).add(index));
    setCurrentSection(questions[index].section);
  };

  const handleSectionChange = (section: string) => {
    if (isSectional && (sectionTimes[section] ?? 0) <= 0) return;
    setCurrentSection(section);
    const first = questions.findIndex((q) => q.section === section);
    if (first !== -1) { setCurrentQuestionIndex(first); setVisited(prev => new Set(prev).add(first)); }
  };

  const getQuestionStatus = (index: number) => {
    const a = answers[index];
    if (!visited.has(index)) return "unvisited";
    if (a?.marked) return "marked";
    const hasAnswer = a && (Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== "");
    return hasAnswer ? "answered" : "unanswered";
  };

  // Create or resume the candidate attempt when the test-taking screen opens.
  const startAttempt = async () => {
    const res = await apiPost<{
      attemptId: string;
      isResume?: boolean;
      answers?: Answer[];
      timeSpentSec?: number;
      currentQuestionIndex?: number;
      currentSection?: string;
      questionTimes?: Record<string, number>;
    }>("/answerer/attempts/start", {
      userId,
      examId,
    });
    setAttemptId(res.attemptId);

    if (res.isResume) {
      if (res.answers && res.answers.length > 0) {
        setAnswers((prev) => {
          const map = new Map(res.answers!.map((a) => [a.questionId, a]));
          return prev.map((item) => map.get(item.questionId) || item);
        });
      }
      if (res.timeSpentSec) {
        setTimeLeft(Math.max(5, duration * 60 - res.timeSpentSec));
      }
      if (res.currentQuestionIndex !== undefined && res.currentQuestionIndex >= 0 && res.currentQuestionIndex < questions.length) {
        setCurrentQuestionIndex(res.currentQuestionIndex);
        setVisited((prev) => new Set(prev).add(res.currentQuestionIndex!));
      }
      if (res.currentSection) {
        setCurrentSection(res.currentSection);
      }
      if (res.questionTimes) {
        setQuestionTimes(res.questionTimes);
      }
    }
    return res;
  };

  const saveProgress = async () => {
    if (!attemptId) return;
    const timeSpentSec = duration * 60 - timeLeft;

    await apiPut(`/answerer/attempts/${attemptId}/save`, {
      answers,
      timeSpentSec,
      questionTimes,
      currentQuestionIndex,
      currentSection,
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Ensure the candidate has a saved attempt before persisting answers.
      let currentAttemptId = attemptId;
      if (!currentAttemptId) {
        const start = await apiPost<{ attemptId: string }>("/answerer/attempts/start", {
          userId,
          examId,
        });
        currentAttemptId = start.attemptId;
        setAttemptId(currentAttemptId);
      }

      const timeSpentSec = duration * 60 - timeLeft;

      const result = await apiPost<ResultPayload>(`/answerer/attempts/${currentAttemptId}/submit`, {
        answers,
        timeSpentSec,
        questionTimes,
      });

      setSubmitResult(result);
      setTestStep("submitted");
    } catch (e) {
      console.error(e);
      alert("Failed to submit attempt to backend");
      setIsSubmitting(false);
    }
  };

  // Auto-save candidate answers every 10 seconds during the test.
  useEffect(() => {
    if (testStep !== "exam" && testStep !== "confirm") return;
    const t = setInterval(() => {
      saveProgress().catch(() => {});
    }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testStep, attemptId, timeLeft, answers, questionTimes, currentQuestionIndex, currentSection]);


  const [showSectionModal, setShowSectionModal] = useState<boolean>(false);

  const handleClearResponse = () => {
    setAnswers((prev) => {
      const next = [...prev];
      const initial = getInitialAnswer(questions[currentQuestionIndex]);
      next[currentQuestionIndex] = { ...next[currentQuestionIndex], answer: initial };
      return next;
    });
  };

  const handleMarkForReviewAndNext = () => {
    handleMarkForReview();
    handleNext();
  };

  const isLastSection = sections.indexOf(currentSection) === sections.length - 1;

  const handleSectionSubmitClick = () => {
    if (isLastSection) {
      setTestStep("confirm");
    } else {
      setShowSectionModal(true);
    }
  };

  const handleConfirmSectionSubmit = () => {
    setShowSectionModal(false);
    const currIdx = sections.indexOf(currentSection);
    if (currIdx >= 0 && currIdx < sections.length - 1) {
      const nextSec = sections[currIdx + 1];
      const firstQIdxOfNextSec = questions.findIndex((q) => q.section === nextSec);
      setCurrentSection(nextSec);
      if (firstQIdxOfNextSec >= 0) {
        setCurrentQuestionIndex(firstQIdxOfNextSec);
      }
    } else {
      setTestStep("confirm");
    }
  };

  // Candidate test-taking screen states.
  if (testStep === "details") {
    return (
      <TestDetails
        testName={testName}
        questionCount={questions.length}
        duration={duration}
        passingPercentage={passingPercentage}
        onContinue={() => setTestStep("instructions")}
        onBack={onExit}
      />
    );
  }

  if (testStep === "instructions") {
    return (
      <TestInstructions
        userId={userId}
        testName={testName}
        duration={duration}
        timerMode={timerMode}
        sectionConfig={derivedSectionConfig}
        onStart={async () => {
          try {
            await startAttempt();
            setTestStep("exam");
          } catch (e) {
            console.error(e);
            alert("Failed to start attempt");
          }
        }}
        onBack={() => setTestStep("details")}
      />
    );
  }

  if (testStep === "confirm") return <SubmissionConfirmation testName={testName} userId={userId} questions={questions} answers={answers} visited={visited} sections={sections} time={formatTime(timeLeft)} submitting={isSubmitting} onConfirm={handleSubmit} onCancel={() => setTestStep("exam")} />;

  if (testStep === "submitted" && submitResult) {
    return (
      <div className="shine-submission-success-page">
        <div className="shine-success-card">
          <div className="success-logo-wrap">
            <ShineLogo compact inverse />
          </div>

          <div className="success-check-badge">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="success-title">Exam Submitted Successfully</h1>
          <p className="success-subtitle">Your test responses have been securely recorded and calculated.</p>

          <div className="success-details-grid">
            <div className="detail-item">
              <span className="detail-label">Exam Name</span>
              <strong className="detail-value">{testName}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-label">Attempt Reference</span>
              <code className="detail-value-code">{submitResult.attemptId}</code>
            </div>
          </div>

          <div className="success-info-banner">
            <span className="banner-icon">ℹ️</span>
            <span>Answers are not displayed after submission. Your detailed score report and performance analytics are available in your Reports page.</span>
          </div>

          <button className="btn-return-dashboard" onClick={onExit}>
            ← Return to My Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tcs-bank-exam-workspace">
      {/* 1. TOP BLUE BANNER */}
      <header className="tcs-top-blue-header">
        <div className="tcs-top-header-left">
          <div className="tcs-logo-badge">
            <ShineLogo compact inverse />
          </div>
        </div>
        <div className="tcs-top-header-right">
          <div className="exam-title-pill-tag">
            {testName} <span className="info-icon">ℹ</span>
          </div>
        </div>
      </header>

      {/* 3. SECTION BAR & TIMER */}
      <div className="tcs-section-bar">
        <div className="section-selector-left">
          <span className="section-label-text">Section</span>
          <div className="section-buttons-row">
            {sections.map((sec) => (
              <button
                key={sec}
                className={`tcs-section-btn ${currentSection === sec ? "active" : ""}`}
                onClick={() => handleSectionChange(sec)}
              >
                {sec} <span className="info-icon">ℹ</span>
              </button>
            ))}
          </div>
        </div>

        <div className="section-timer-right">
          Time Left : <strong className="timer-green-text">{formatTime(currentSectionTime)}</strong>
        </div>
      </div>

      {/* 4. QUESTION META BAR */}
      <div className="tcs-question-meta-bar">
        <div className="q-type-label">
          Question Type : <span>Multiple Choice Question</span>
        </div>
        <div className="q-marks-label">
          Marks For Correct Answer: <strong>{currentQuestion.marks || 1}</strong>
          <span className="divider">|</span>
          Negative Mark: <strong>0.25</strong>
          <button className="btn-fullscreen-toggle" onClick={toggleFullScreen}>
            {isFullscreen ? "Exit Full Screen" : "View Full Screen"}
          </button>
        </div>
      </div>

      {/* 5. MAIN WORK AREA (Split 2-Column: Question Left, Palette Right) */}
      <div className="tcs-main-body-container">
        <div className="tcs-question-workspace">
          <div className="tcs-question-no-header">
            Question No. {sectionQuestionNumber}
          </div>

          <QuestionPanel
            question={currentQuestion}
            questionNumber={sectionQuestionNumber}
            totalQuestions={currentSectionQuestions.length}
            answer={answers[currentQuestionIndex].answer}
            isMarked={answers[currentQuestionIndex].marked}
            onAnswer={handleAnswer}
            onMarkForReview={handleMarkForReview}
          />

          <footer className="tcs-question-action-footer">
            <div className="footer-left-buttons">
              <button className="tcs-btn-white" onClick={handleMarkForReviewAndNext}>
                Mark for Review & Next
              </button>
              <button className="tcs-btn-white" onClick={handleClearResponse}>
                Clear Response
              </button>
            </div>

            <div className="footer-right-buttons">
              <button className="tcs-btn-blue-save" onClick={handleNext}>
                Save & Next
              </button>
            </div>
          </footer>
        </div>

        <QuestionNavigator
          userId={userId}
          questions={questions}
          currentIndex={currentQuestionIndex}
          answers={answers}
          visited={visited}
          sections={sections}
          currentSection={currentSection}
          onQuestionSelect={handleQuestionSelect}
          onSectionChange={handleSectionChange}
          getQuestionStatus={getQuestionStatus}
          onSubmit={handleSectionSubmitClick}
          submitText={isLastSection ? "Submit Exam" : "Submit Section"}
        />
      </div>

      {/* 7. SECTION SUBMIT CONFIRMATION POPUP (For intermediate sections) */}
      {showSectionModal && (
        <div className="tcs-section-modal-overlay">
          <div className="tcs-section-modal-card">
            <h3>Do you want to submit this section?</h3>
            <div className="modal-btn-row">
              <button className="btn-modal-submit" onClick={handleConfirmSectionSubmit}>
                Submit
              </button>
              <button className="btn-modal-cancel" onClick={() => setShowSectionModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const hasResponse = (answer: Answer) => Array.isArray(answer.answer) ? answer.answer.length > 0 : answer.answer !== "";

const SubmissionConfirmation = ({
  testName,
  userId,
  questions,
  answers,
  visited,
  sections,
  time,
  submitting,
  onConfirm,
  onCancel,
}: {
  testName: string;
  userId: string;
  questions: Question[];
  answers: Answer[];
  visited: Set<number>;
  sections: string[];
  time: string;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const rows = sections.map((section) => {
    const indexes = questions
      .map((question, index) => (question.section === section ? index : -1))
      .filter((index) => index >= 0);
    return {
      section,
      total: indexes.length,
      answered: indexes.filter((index) => hasResponse(answers[index]) && !answers[index].marked).length,
      notAnswered: indexes.filter((index) => visited.has(index) && !hasResponse(answers[index]) && !answers[index].marked).length,
      notVisited: indexes.filter((index) => !visited.has(index)).length,
      review: indexes.filter((index) => answers[index].marked && !hasResponse(answers[index])).length,
      answeredReview: indexes.filter((index) => answers[index].marked && hasResponse(answers[index])).length,
    };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      answered: sum.answered + row.answered,
      notAnswered: sum.notAnswered + row.notAnswered,
      notVisited: sum.notVisited + row.notVisited,
      review: sum.review + row.review,
      answeredReview: sum.answeredReview + row.answeredReview,
    }),
    { total: 0, answered: 0, notAnswered: 0, notVisited: 0, review: 0, answeredReview: 0 }
  );

  return (
    <div className="tcs-bank-exam-workspace">
      {/* Top Banner */}
      <header className="tcs-top-blue-header">
        <div className="tcs-top-header-left">
          <div className="tcs-logo-badge">
            <ShineLogo compact inverse />
          </div>
        </div>
        <div className="tcs-top-header-right">
          <div className="exam-title-pill-tag">
            {testName} <span className="info-icon">ℹ</span>
          </div>
        </div>
      </header>

      {/* Section Row */}
      <div className="tcs-section-bar">
        <div className="section-selector-left">
          <span className="section-label-text">Section</span>
          <div className="section-buttons-row">
            {sections.map((sec, idx) => (
              <button key={sec} className={`tcs-section-btn ${idx === sections.length - 1 ? "active" : ""}`}>
                {sec} <span className="info-icon">ℹ</span>
              </button>
            ))}
          </div>
        </div>

        <div className="section-timer-right">
          Time Left : <strong className="timer-green-text">{time}</strong>
        </div>
      </div>

      {/* Question Meta Bar */}
      <div className="tcs-question-meta-bar">
        <div className="q-type-label">
          Question Type : <span>Multiple Choice Question</span>
        </div>
        <div className="q-marks-label">
          Marks For Correct Answer: <strong>1</strong>
          <span className="divider">|</span>
          Negative Mark: <strong>0.25</strong>
          <button className="btn-fullscreen-toggle">View Full Screen</button>
        </div>
      </div>

      {/* Main Table Content matching Screenshot 4 */}
      <div className="tcs-summary-center-pane">
        <div className="tcs-summary-table-box">
          <h2 className="tcs-summary-heading">Exam Summary Breakdown</h2>

          <div className="tcs-summary-metrics-row">
            <div className="summary-metric-card answered">
              <span className="metric-num">{totals.answered}</span>
              <span className="metric-lbl">Answered</span>
            </div>
            <div className="summary-metric-card not-answered">
              <span className="metric-num">{totals.notAnswered}</span>
              <span className="metric-lbl">Not Answered</span>
            </div>
            <div className="summary-metric-card not-visited">
              <span className="metric-num">{totals.notVisited}</span>
              <span className="metric-lbl">Not Visited</span>
            </div>
            <div className="summary-metric-card review">
              <span className="metric-num">{totals.review + totals.answeredReview}</span>
              <span className="metric-lbl">Marked for Review</span>
            </div>
          </div>

          <table className="tcs-classic-summary-table">
            <thead>
              <tr>
                <th>Section Name</th>
                <th>Total Questions</th>
                <th>Answered</th>
                <th>Not Answered</th>
                <th>Not Visited</th>
                <th>Marked for Review</th>
                <th>Answered & Marked for Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.section}>
                  <td className="sec-name-cell">{row.section}</td>
                  <td><strong>{row.total}</strong></td>
                  <td><span className="tbl-pill ans">{row.answered}</span></td>
                  <td><span className="tbl-pill not-ans">{row.notAnswered}</span></td>
                  <td><span className="tbl-pill not-vis">{row.notVisited}</span></td>
                  <td><span className="tbl-pill rev">{row.review}</span></td>
                  <td><span className="tbl-pill ans-rev">{row.answeredReview}</span></td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="sec-name-cell">Total</td>
                <td><strong>{totals.total}</strong></td>
                <td><span className="tbl-pill ans">{totals.answered}</span></td>
                <td><span className="tbl-pill not-ans">{totals.notAnswered}</span></td>
                <td><span className="tbl-pill not-vis">{totals.notVisited}</span></td>
                <td><span className="tbl-pill rev">{totals.review}</span></td>
                <td><span className="tbl-pill ans-rev">{totals.answeredReview}</span></td>
              </tr>
            </tbody>
          </table>

          <div className="tcs-final-prompt-box">
            <p>Do you want to submit the online exam?</p>
            <div className="prompt-buttons-row">
              <button className="tcs-btn-confirm-submit" disabled={submitting} onClick={onConfirm}>
                {submitting ? "Submitting..." : "✓ Yes, Submit Exam"}
              </button>
              <button className="tcs-btn-cancel-submit" disabled={submitting} onClick={onCancel}>
                ← No, Resume Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestInterface;
