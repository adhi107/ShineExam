import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../services/api";
import "./ResultsPage.css";
import { SensitiveContent } from "../security";

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

interface BackendResult {
  attemptId: string;
  totalMarks: number;
  scoredMarks: number;
  percentage: number;
  passed: boolean;
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

interface ResultsPageProps {
  questions: Question[];
  answers: Answer[];
  testName: string;
  passingPercentage?: number;
  backendResult: BackendResult | null;
  onBackToDashboard: () => void;
}

const ResultsPage: React.FC<ResultsPageProps> = ({
  questions,
  answers,
  testName,
  passingPercentage = 40,
  backendResult,
  onBackToDashboard,
}) => {
  const [watermarkConfig, setWatermarkConfig] = useState<{
    enabled: boolean;
    text: string;
    color: string;
    opacity: number;
  }>({
    enabled: true,
    text: "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT",
    color: "#dc2626",
    opacity: 0.25,
  });

  useEffect(() => {
    apiGet<any>("/security/config")
      .then((cfg) => {
        if (cfg) {
          setWatermarkConfig({
            enabled: cfg.solutionReportWatermarkEnabled !== false,
            text: cfg.solutionReportWatermarkText || "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT",
            color: cfg.solutionReportWatermarkColor || "#dc2626",
            opacity: typeof cfg.solutionReportWatermarkOpacity === "number" ? cfg.solutionReportWatermarkOpacity : 0.25,
          });
        }
      })
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    if (backendResult) return backendResult;

    // fallback (should not happen once backend is connected)
    let totalMarks = 0;
    let scoredMarks = 0;
    const sectionWise: Record<string, { total: number; scored: number }> = {};

    questions.forEach((q, idx) => {
      totalMarks += q.marks;
      if (!sectionWise[q.section]) sectionWise[q.section] = { total: 0, scored: 0 };
      sectionWise[q.section].total += q.marks;

      const ua = answers[idx]?.answer;
      const answered = Array.isArray(ua) ? ua.length > 0 : ua !== "";
      if (answered) {
        scoredMarks += 0; // cannot judge correctness without backend
      }
    });

    

    const percentage = totalMarks ? (scoredMarks / totalMarks) * 100 : 0;
    return {
      attemptId: "N/A",
      totalMarks,
      scoredMarks,
      percentage,
      passed: percentage >= passingPercentage,
      sectionWise,
      questionReview: [],
    };
  }, [backendResult, questions, answers, passingPercentage]);

    const safePercentage =
      typeof results.percentage === "number" ? results.percentage : 0;

    const safeScored =
      typeof results.scoredMarks === "number" ? results.scoredMarks : 0;

    const safeTotal =
      typeof results.totalMarks === "number" ? results.totalMarks : 0;


  return (
    <SensitiveContent
      showWatermark={watermarkConfig.enabled}
      watermarkColor={watermarkConfig.color}
      watermarkCustomText={watermarkConfig.text}
      watermarkOpacity={watermarkConfig.opacity}
      hideOnTabSwitch
      shieldOnScreenShare
      shieldMessage="Result content is protected. Return to this tab to view your results."
    >
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <h1>Test Completed!</h1>
          <p className="test-name">{testName}</p>
        </div>

        <div className={`result-card main-result ${results.passed ? "passed" : "failed"}`}>
          <div className="result-icon">{results.passed ? "✓" : "✗"}</div>
          <h2 className="result-status">{results.passed ? "Passed" : "Failed"}</h2>

          <div className="score-display">
            <div className="percentage-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={results.passed ? "#2e7d32" : "#d32f2f"}
                  strokeWidth="10"
                  strokeDasharray={`${(safePercentage * 2.827).toFixed(2)} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="percentage-text">
                <span className="percentage-value">{safePercentage.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Score</span>
            <span className="stat-value">
              {safeScored} / {safeTotal}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Percentage</span>
            <span className="stat-value">{safePercentage.toFixed(2)}%</span>
          </div>
        </div>

        <div className="section-results">
          <h3>Section-wise Performance</h3>
          <div className="section-list">
            {Object.entries(results.sectionWise || {}).map(([section, data]) => {
              const sectionPercentage = data.total ? ((data.scored / data.total) * 100).toFixed(1) : "0.0";
              return (
                <div key={section} className="section-result-card">
                  <div className="section-result-header">
                    <h4>{section}</h4>
                    <span className="section-score">
                      {data.scored} / {data.total}
                    </span>
                  </div>
                  <div className="section-progress-bar">
                    <div className="section-progress-fill" style={{ width: `${sectionPercentage}%` }} />
                  </div>
                  <span className="section-percentage">{sectionPercentage}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review */}
        <div className="question-review">
          <h3>Question-by-Question Review</h3>

          {!backendResult && (
            <div style={{ color: "#6a6d70" }}>
              Backend result not available. (Once backend submit is connected, this will show full review.)
            </div>
          )}

          {backendResult && Array.isArray(backendResult.questionReview) && (
            <div className="review-list">
              {(backendResult.questionReview || []).map((r, idx) => {
                const q = questions.find((qq) => qq.id === r.questionId);
                return (
                  <div key={r.questionId} className={`review-card ${r.isCorrect ? "correct" : "incorrect"}`}>
                    <div className="review-header">
                      <span className="review-number">Q{idx + 1}</span>
                      <span className="review-section">{r.section}</span>
                      <span className={`review-status ${r.isCorrect ? "correct" : "incorrect"}`}>
                        {r.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                      </span>
                    </div>

                    <p className="review-question">{q?.question || "Question"}</p>

                    <div className="review-answers">
                      <div className="answer-row">
                        <span className="answer-label">Your answer:</span>
                        <span className="answer-value">
                          {Array.isArray(r.userAnswer) ? r.userAnswer.join(", ") : r.userAnswer || "Not answered"}
                        </span>
                      </div>

                      <div className="answer-row">
                        <span className="answer-label">Correct answer:</span>
                        <span className="answer-value correct-answer">
                          {Array.isArray(r.correctAnswer)
                            ? r.correctAnswer.join(", ")
                            : (r.correctAnswer ?? "N/A")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="results-actions">
          <button className="action-button primary" onClick={onBackToDashboard}>
            Back to Dashboard
          </button>
          <button
            className="action-button secondary"
            onClick={() => alert('Printing is disabled for protected exam content. Your results are watermarked and tracked.')}
            title="Printing is disabled for secure content"
          >
            🔒 Print Disabled
          </button>
        </div>
      </div>
    </div>
    </SensitiveContent>
  );
};

export default ResultsPage;
