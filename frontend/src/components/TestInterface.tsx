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
  const [sectionTimes, setSectionTimes] = useState<Record<string, number>>(() =>
    Object.fromEntries(sectionConfig.map((section) => [section.name, section.duration * 60]))
  );
  const currentSectionTime = isSectional ? (sectionTimes[currentSection] ?? 0) : timeLeft;

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Current Shine Exam attempt id returned by the backend.
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<ResultPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());

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

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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
      setTestStep("confirm");
      return;
    }
    let nextIndex = currentQuestionIndex + 1;
    if (isSectional && (sectionTimes[questions[nextIndex].section] ?? 0) <= 0) {
      const availableIndex = questions.findIndex((question, index) => index > currentQuestionIndex && (sectionTimes[question.section] ?? 0) > 0);
      if (availableIndex < 0) { setTestStep("confirm"); return; }
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
    if (!a) return "unanswered";
    if (a.marked) return "marked";
    const hasAnswer = Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== "";
    return hasAnswer ? "answered" : "unanswered";
  };

  // Create the candidate attempt when the test-taking screen opens.
  const startAttempt = async () => {
    const res = await apiPost<{ attemptId: string }>("/answerer/attempts/start", {
      userId,
      examId,
    });
    setAttemptId(res.attemptId);
  };

  const saveProgress = async () => {
    if (!attemptId) return;
    const timeSpentSec = duration * 60 - timeLeft;

    await apiPut(`/answerer/attempts/${attemptId}/save`, {
      answers,
      timeSpentSec,
      questionTimes,
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

  // Auto-save candidate answers every 15 seconds during the test.
  useEffect(() => {
    if (testStep !== "exam" && testStep !== "confirm") return;
    const t = setInterval(() => {
      saveProgress().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testStep, attemptId, timeLeft, answers, questionTimes]);

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
        sectionConfig={sectionConfig}
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

  if (testStep === "submitted" && submitResult) return <div className="submission-complete"><ShineLogo /><div className="submission-check">✓</div><h1>Exam submitted successfully</h1><p>Your responses have been securely recorded.</p><div className="submission-reference"><span>Exam</span><strong>{testName}</strong><span>Attempt reference</span><strong>{submitResult.attemptId}</strong></div><p className="submission-note">Answers are not displayed after submission. Your performance report is available from the Reports page.</p><button onClick={onExit}>Return to My Tests</button></div>;

  return (
    <div className="test-interface">
      {/* ===== TOP HEADER (matching TestDetails/Instructions) ===== */}
      <header className="test-header">
        <div className="test-header-left">
          <ShineLogo inverse />
          <span className="test-portal-title">Secure Assessment</span>
        </div>

        <div className="test-header-right">
          <span className="user-meta">
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}{" "}
            | Logged in as : {userId}
          </span>
          <div className="test-timer">
            <span>{isSectional ? `${currentSection} time:` : "Time remaining:"}</span>
            <span className={`timer-value ${currentSectionTime < 300 ? "timer-warning" : ""}`}>
              {formatTime(currentSectionTime)}
            </span>
            {isSectional && <small>Overall {formatTime(timeLeft)}</small>}
          </div>
        </div>
      </header>

      {/* ===== SUB HEADER ===== */}
      <div className="test-subheader">
        <h3 className="test-title">{testName}</h3>
        <div className="question-subheader-actions"><button className={`exam-bookmark-button ${bookmarkedQuestions.has(currentQuestion.id) ? "saved" : ""}`} onClick={() => void toggleQuestionBookmark()}>{bookmarkedQuestions.has(currentQuestion.id) ? "★ Bookmarked" : "☆ Bookmark question"}</button><span className="question-info">
          {currentQuestionIndex + 1} of {questions.length}
        </span></div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="test-body">
        <div className="question-section">
          <QuestionPanel
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            answer={answers[currentQuestionIndex].answer}
            isMarked={answers[currentQuestionIndex].marked}
            onAnswer={handleAnswer}
            onMarkForReview={handleMarkForReview}
          />
        </div>

        <QuestionNavigator
          questions={questions}
          currentIndex={currentQuestionIndex}
          answers={answers}
          sections={sections}
          currentSection={currentSection}
          onQuestionSelect={handleQuestionSelect}
          onSectionChange={handleSectionChange}
          getQuestionStatus={getQuestionStatus}
          onSubmit={() => {
            setTestStep("confirm");
          }}
        />

        {/* ===== NAVIGATION CONTROLS ===== */}
        <div className="navigation-controls">
          <button
            className="nav-btn secondary"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            &lt; Previous Question
          </button>

          <button
            className={`nav-btn review-btn ${answers[currentQuestionIndex].marked ? "marked" : ""}`}
            onClick={handleMarkForReview}
          >
            {answers[currentQuestionIndex].marked ? "Unmark Review" : "Mark for Review"}
          </button>

          <button className="nav-btn primary save-next-btn" onClick={handleNext}>
            {isLastQuestion ? "Save & Review" : "Save & Next"} &gt;
          </button>

        </div>
      </div>
    </div>
  );
};

const hasResponse = (answer: Answer) => Array.isArray(answer.answer) ? answer.answer.length > 0 : answer.answer !== "";

const SubmissionConfirmation = ({ testName, userId, questions, answers, visited, sections, time, submitting, onConfirm, onCancel }: { testName: string; userId: string; questions: Question[]; answers: Answer[]; visited: Set<number>; sections: string[]; time: string; submitting: boolean; onConfirm: () => void; onCancel: () => void }) => {
  const rows = sections.map(section => {
    const indexes = questions.map((question, index) => question.section === section ? index : -1).filter(index => index >= 0);
    return {
      section, total: indexes.length,
      answered: indexes.filter(index => hasResponse(answers[index]) && !answers[index].marked).length,
      notAnswered: indexes.filter(index => visited.has(index) && !hasResponse(answers[index]) && !answers[index].marked).length,
      notVisited: indexes.filter(index => !visited.has(index)).length,
      review: indexes.filter(index => answers[index].marked && !hasResponse(answers[index])).length,
      answeredReview: indexes.filter(index => answers[index].marked && hasResponse(answers[index])).length,
    };
  });
  const totals = rows.reduce((sum, row) => ({ total: sum.total + row.total, answered: sum.answered + row.answered, notAnswered: sum.notAnswered + row.notAnswered, notVisited: sum.notVisited + row.notVisited, review: sum.review + row.review, answeredReview: sum.answeredReview + row.answeredReview }), { total: 0, answered: 0, notAnswered: 0, notVisited: 0, review: 0, answeredReview: 0 });
  return <div className="submit-confirmation"><header><div><strong>{testName}</strong><small>Shine Secure Examination</small></div><div><span>Candidate: {userId}</span><b>Time Left: {time}</b></div></header><main><h2>Submission Summary</h2><p>Review the status of every section before submitting the online examination.</p><div className="submit-table-wrap"><table><thead><tr><th>Section Name</th><th>Total Questions</th><th>Answered</th><th>Not Answered</th><th>Not Visited</th><th>Marked for Review</th><th>Answered & Marked for Review</th></tr></thead><tbody>{rows.map(row => <tr key={row.section}><td>{row.section}</td><td>{row.total}</td><td>{row.answered}</td><td>{row.notAnswered}</td><td>{row.notVisited}</td><td>{row.review}</td><td>{row.answeredReview}</td></tr>)}<tr className="total-row"><td>Total</td><td>{totals.total}</td><td>{totals.answered}</td><td>{totals.notAnswered}</td><td>{totals.notVisited}</td><td>{totals.review}</td><td>{totals.answeredReview}</td></tr></tbody></table></div><h3>Do you want to submit the online exam?</h3><div className="submit-confirm-actions"><button disabled={submitting} onClick={onConfirm}>{submitting ? "Submitting…" : "Yes, Submit"}</button><button disabled={submitting} onClick={onCancel}>No, Return to Exam</button></div><p className="submit-warning">After final submission, responses cannot be changed and answers will not be displayed.</p></main></div>;
};

export default TestInterface;
