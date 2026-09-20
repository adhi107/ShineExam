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

export interface QuestionReviewItem {
  questionId: string;
  isCorrect: boolean | null;
  userAnswer: any;
  correctAnswer?: any;
  marks: number;
  section: string;
  type?: string;
  question?: string;
  evaluationStatus?: string;
  scoreAwarded?: number;
  evaluatorFeedback?: string;
  improvementSuggestions?: string;
  attachments?: any[];
}

export interface BackendResult {
  attemptId: string;
  totalMarks: number;
  scoredMarks: number;
  percentage: number;
  passed: boolean;
  feedback?: string;
  improvementSuggestions?: string;
  strengths?: string;
  annotatedFileUrl?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  sectionWise: Record<string, { total: number; scored: number }>;
  questionReview: QuestionReviewItem[];
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
  const tenantOrg = (() => {
    try {
      const ti = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("tenant_info") : null;
      if (ti) {
        const p = JSON.parse(ti);
        return p.brandTitle || p.name || "";
      }
    } catch {}
    return (
      (typeof sessionStorage !== "undefined" &&
        (sessionStorage.getItem("tenantBrandTitle") ||
          sessionStorage.getItem("tenantName") ||
          sessionStorage.getItem("orgName"))) ||
      ""
    );
  })();

  const [watermarkConfig, setWatermarkConfig] = useState<{
    enabled: boolean;
    text: string;
    color: string;
    opacity: number;
  }>({
    enabled: true,
    text: tenantOrg ? `${tenantOrg} • CONFIDENTIAL SOLUTION REPORT` : "CONFIDENTIAL SOLUTION REPORT",
    color: "#dc2626",
    opacity: 0.25,
  });

  useEffect(() => {
    apiGet<any>("/public/security/config")
      .then((cfg) => {
        if (cfg) {
          const isMaster = cfg.watermarkEnabled !== false;
          const isReport = cfg.solutionReportWatermarkEnabled !== false;
          const isModule = !Array.isArray(cfg.watermarkModules) || cfg.watermarkModules.includes("results");
          const enabled = isMaster && isReport && isModule;

          let text = (cfg.solutionReportWatermarkText || "").trim();
          if (!text) {
            text = tenantOrg ? `${tenantOrg} • CONFIDENTIAL SOLUTION REPORT` : "CONFIDENTIAL SOLUTION REPORT";
          } else if (tenantOrg) {
            text = text.replace(/SHINE\s+EXAM/gi, tenantOrg).replace(/SHINE/gi, tenantOrg);
          }

          setWatermarkConfig({
            enabled,
            text,
            color: cfg.solutionReportWatermarkColor || "#dc2626",
            opacity: typeof cfg.solutionReportWatermarkOpacity === "number" ? cfg.solutionReportWatermarkOpacity : 0.25,
          });
        }
      })
      .catch(() => {});
  }, [tenantOrg]);

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
      module="results"
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

        {/* Evaluator Feedback & Improvement Suggestions Section */}
        {Boolean(results.feedback || results.improvementSuggestions || results.strengths) && (
          <div className="evaluator-feedback-section" style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>👨‍🏫</span> Official Evaluator Review & Actionable Suggestions
            </h3>

            {results.feedback && (
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", marginBottom: "12px" }}>
                <strong style={{ display: "block", color: "#334155", fontSize: "0.88rem", marginBottom: "4px" }}>📝 Overall Comments:</strong>
                <p style={{ margin: 0, color: "#475569", fontSize: "0.92rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{results.feedback}</p>
              </div>
            )}

            {results.strengths && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px 16px", marginBottom: "12px" }}>
                <strong style={{ display: "block", color: "#166534", fontSize: "0.88rem", marginBottom: "4px" }}>🌟 Key Strengths & Good Points:</strong>
                <p style={{ margin: 0, color: "#15803d", fontSize: "0.92rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{results.strengths}</p>
              </div>
            )}

            {results.improvementSuggestions && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px 16px" }}>
                <strong style={{ display: "block", color: "#1e40af", fontSize: "0.88rem", marginBottom: "4px" }}>💡 Actionable Improvement Suggestions:</strong>
                <p style={{ margin: 0, color: "#1d4ed8", fontSize: "0.92rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{results.improvementSuggestions}</p>
              </div>
            )}
          </div>
        )}

        {/* Review */}
        <div className="question-review">
          <h3>Question-by-Question Review</h3>

          {!backendResult && (
            <div style={{ color: "#6a6d70", marginBottom: "16px" }}>
              Backend result not available. (Once backend submit is connected, this will show full review.)
            </div>
          )}

          {results.questionReview.length === 0 ? (
            <p className="no-review" style={{ color: "#6a6d70" }}>No question-by-question review available.</p>
          ) : (
            <div className="review-list">
              {results.questionReview.map((r, idx) => {
                const q = questions.find((qq) => qq.id === r.questionId);
                const isSubjective = ["essay", "descriptive", "descriptive_10m", "descriptive_15m", "descriptive_20m", "subjective"].includes(r.type || q?.type || "");
                const isPending = r.isCorrect === null || r.evaluationStatus === "pending" || (isSubjective && !r.isCorrect && r.scoreAwarded === undefined);

                // Parse user answer if object or JSON
                let userText = "";
                let userAttachments: any[] = [];
                if (typeof r.userAnswer === "object" && r.userAnswer !== null) {
                  userText = r.userAnswer.textAnswer || "";
                  userAttachments = Array.isArray(r.userAnswer.attachments) ? r.userAnswer.attachments : [];
                } else if (typeof r.userAnswer === "string") {
                  try {
                    const parsed = JSON.parse(r.userAnswer);
                    if (parsed && typeof parsed === "object") {
                      userText = parsed.textAnswer || "";
                      userAttachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
                    } else {
                      userText = r.userAnswer;
                    }
                  } catch {
                    userText = r.userAnswer;
                  }
                } else if (Array.isArray(r.userAnswer)) {
                  userText = r.userAnswer.join(", ");
                }

                return (
                  <div key={r.questionId || idx} className={`review-card ${isPending ? "pending" : r.isCorrect ? "correct" : "incorrect"}`}>
                    <div className="review-header">
                      <span className="review-number">Q{idx + 1}</span>
                      <span className="review-section">{r.section}</span>
                      <span className={`review-status ${isPending ? "pending" : r.isCorrect ? "correct" : "incorrect"}`}>
                        {isPending ? "⏳ Pending Manual Review" : r.isCorrect ? "✓ Correct" : r.scoreAwarded !== undefined ? `Awarded: ${r.scoreAwarded} Marks` : "✗ Incorrect"}
                      </span>
                    </div>

                    <p className="review-question">{q?.question || r.question || "Question"}</p>

                    <div className="review-answers">
                      <div className="answer-row">
                        <span className="answer-label">Your response:</span>
                        <div className="answer-value" style={{ width: "100%" }}>
                          {userText && (
                            <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{userText}</p>
                          )}
                          {userAttachments && userAttachments.length > 0 && (
                            <div className="review-attachments-grid" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                              {userAttachments.map((att: any, aIdx: number) => (
                                <a
                                  key={att.id || aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 10px",
                                    background: "#f1f5f9",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    color: "#2563eb",
                                    textDecoration: "none",
                                    fontWeight: 600
                                  }}
                                >
                                  📄 {att.name || `Page ${aIdx + 1}`} (Open Preview)
                                </a>
                              ))}
                            </div>
                          )}
                          {!userText && (!userAttachments || userAttachments.length === 0) && (
                            <span style={{ color: "#94a3b8" }}>Not answered</span>
                          )}
                        </div>
                      </div>

                      {r.correctAnswer && (
                        <div className="answer-row">
                          <span className="answer-label">{isSubjective ? "Model Answer / Key:" : "Correct answer:"}</span>
                          <span className="answer-value correct-answer" style={{ whiteSpace: "pre-wrap" }}>
                            {Array.isArray(r.correctAnswer)
                              ? r.correctAnswer.join(", ")
                              : String(r.correctAnswer)}
                          </span>
                        </div>
                      )}

                      {(r.evaluatorFeedback || r.improvementSuggestions) && (
                        <div className="evaluator-item-remarks" style={{ marginTop: "10px", padding: "10px 12px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                          {r.evaluatorFeedback && (
                            <div style={{ color: "#1e3a8a", fontSize: "0.85rem", marginBottom: "4px" }}>
                              <strong>Examiner Remarks:</strong> {r.evaluatorFeedback}
                            </div>
                          )}
                          {r.improvementSuggestions && (
                            <div style={{ color: "#1d4ed8", fontSize: "0.85rem" }}>
                              <strong>💡 Improvement Suggestion:</strong> {r.improvementSuggestions}
                            </div>
                          )}
                        </div>
                      )}
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
