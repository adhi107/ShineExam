import React, { useEffect, useState, useMemo } from "react";
import { apiGet } from "../../services/api";
import {
  AwardIcon,
  BarChartIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  LayersIcon,
  StarIcon,
  CrossIcon,
} from "../common/EnterpriseIcons";
import "./PerformanceHeatmap.css";

interface TopicPerformance {
  topic: string;
  percentage: number;
  level: "Strong" | "Moderate" | "Weak";
  attemptCount: number;
}

interface SubjectPerformance {
  subject: string;
  overallPercentage: number;
  overallLevel: "Strong" | "Moderate" | "Weak";
  topics: TopicPerformance[];
}

interface TestReportItem {
  id: string;
  title: string;
  type: "Mock Exam" | "Test Series" | "Daily CA Quiz" | string;
  date: string;
  scoredMarks: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  negativeLost: number;
  status: "Pass" | "Needs Review";
}

interface DrawbackItem {
  id: string;
  title: string;
  severity: "High" | "Medium" | "Low";
  category: string;
  metric: string;
  rootCause: string;
  correctiveAction: string;
}

interface RecommendationItem {
  priority: "Immediate" | "Daily" | "Weekly";
  action: string;
  impact: string;
}

interface PerformanceKPIs {
  overallReadiness: number;
  overallAccuracy: number;
  totalTestsTaken: number;
  totalQuestionsAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnattempted: number;
  negativeMarksLost: number;
  rankGrade: string;
}

interface AnalyticsResponse {
  kpis: PerformanceKPIs;
  heatmap: SubjectPerformance[];
  drawbacks: DrawbackItem[];
  testReports: TestReportItem[];
  recommendations: RecommendationItem[];
}

interface RevisionQuestion {
  _id: string;
  questionText: string;
  questionType: string;
  subject?: string;
  isPYQ?: boolean;
  pyqYear?: number;
  difficulty?: string;
  marks?: number;
}

interface Props {
  userName: string;
}

export const PerformanceHeatmap: React.FC<Props> = ({ userName }) => {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Tab and filter states
  const [activeTab, setActiveTab] = useState<"overview" | "drawbacks" | "reports" | "matrix">("overview");
  const [reportTypeFilter, setReportTypeFilter] = useState<string>("ALL");
  const [matrixFilterLevel, setMatrixFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Revision pool drawer state
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [revisionQuestions, setRevisionQuestions] = useState<RevisionQuestion[]>([]);
  const [loadingRevision, setLoadingRevision] = useState<boolean>(false);
  const [selectedTopicDrill, setSelectedTopicDrill] = useState<string | null>(null);

  useEffect(() => {
    loadPerformanceAnalytics();
  }, [userName]);

  const loadPerformanceAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiGet<AnalyticsResponse>(
        `/answerer/learning-hub/performance/analytics?userId=${encodeURIComponent(userName)}`
      );
      if (res && res.kpis) {
        setData(res);
      } else {
        // Fallback
        const hmRes = await apiGet<{ heatmap: SubjectPerformance[] }>(
          `/answerer/learning-hub/performance/heatmap?userId=${encodeURIComponent(userName)}`
        );
        setData({
          kpis: {
            overallReadiness: 65,
            overallAccuracy: 70,
            totalTestsTaken: 0,
            totalQuestionsAttempted: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalUnattempted: 0,
            negativeMarksLost: 0,
            rankGrade: "Good Progress",
          },
          heatmap: hmRes?.heatmap || [],
          drawbacks: [],
          testReports: [],
          recommendations: [],
        });
      }
    } catch (err) {
      console.error("Failed to load performance analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRevisionPool = async (topicName?: string) => {
    try {
      setLoadingRevision(true);
      setSelectedTopicDrill(topicName || null);
      setShowRevisionModal(true);
      const res = await apiGet<{ questions: RevisionQuestion[] }>(
        `/answerer/learning-hub/revision/pool?userId=${encodeURIComponent(userName)}`
      );
      if (res && res.questions) {
        let qs = res.questions;
        if (topicName) {
          const tLower = topicName.toLowerCase();
          const filtered = qs.filter(
            (q) =>
              (q.subject && q.subject.toLowerCase().includes(tLower)) ||
              (q.questionText && q.questionText.toLowerCase().includes(tLower))
          );
          qs = filtered.length > 0 ? filtered : qs;
        }
        setRevisionQuestions(qs);
      }
    } catch (err) {
      console.error("Failed to load revision pool:", err);
    } finally {
      setLoadingRevision(false);
    }
  };

  const kpis = data?.kpis || {
    overallReadiness: 0,
    overallAccuracy: 0,
    totalTestsTaken: 0,
    totalQuestionsAttempted: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    totalUnattempted: 0,
    negativeMarksLost: 0,
    rankGrade: "Getting Started",
  };

  const heatmap = data?.heatmap || [];
  const drawbacks = data?.drawbacks || [];
  const testReports = data?.testReports || [];
  const recommendations = data?.recommendations || [];

  // Filtered test reports
  const filteredReports = useMemo(() => {
    return testReports.filter((r) => {
      if (reportTypeFilter !== "ALL" && r.type !== reportTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.title.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [testReports, reportTypeFilter, searchQuery]);

  // Filtered heatmap
  const filteredHeatmap = useMemo(() => {
    return heatmap
      .map((s) => {
        let topics = s.topics || [];
        if (matrixFilterLevel !== "ALL") {
          topics = topics.filter((t) => t.level.toUpperCase() === matrixFilterLevel);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          topics = topics.filter(
            (t) => t.topic.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q)
          );
        }
        return { ...s, topics };
      })
      .filter((s) => s.topics.length > 0 || (searchQuery.trim() === "" && matrixFilterLevel === "ALL"));
  }, [heatmap, matrixFilterLevel, searchQuery]);

  // Stats computed from topics
  const allTopics = heatmap.flatMap((s) => s.topics || []);
  const strongCount = allTopics.filter((t) => t.level === "Strong").length;
  const modCount = allTopics.filter((t) => t.level === "Moderate").length;
  const weakCount = allTopics.filter((t) => t.level === "Weak").length;

  return (
    <div className="perf-hub-container">
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER BANNER & SIMPLE KPIS
          ───────────────────────────────────────────────────────────────── */}
      <div className="perf-hub-header">
        <div className="perf-hub-title-block">
          <div className="perf-hub-badge">
            <BarChartIcon size={14} color="#2563eb" />
            <span>Student Performance & Test Report</span>
          </div>
          <h2>My Test Performance & Progress</h2>
        </div>

        <div className="perf-hub-quick-actions">
          <button
            className="perf-btn-refresh"
            onClick={loadPerformanceAnalytics}
            title="Reload latest test data"
          >
            ↻ Refresh Data
          </button>
          <button
            className="perf-btn-drill"
            onClick={() => loadRevisionPool()}
          >
            <BookOpenIcon size={14} /> Practice Revision Questions
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="perf-kpi-grid">
        {/* Overall Score */}
        <div className="perf-kpi-card card-readiness">
          <div className="perf-kpi-card-header">
            <span className="perf-kpi-card-label">Overall Score</span>
            <div className="perf-kpi-card-icon blue">
              <AwardIcon size={18} color="#2563eb" />
            </div>
          </div>
          <div className="perf-kpi-card-val">
            <strong>{kpis.overallReadiness}%</strong>
            <span className="perf-grade-tag">{kpis.rankGrade}</span>
          </div>
          <div className="perf-kpi-card-progress">
            <div
              className="perf-kpi-progress-bar blue"
              style={{ width: `${Math.min(100, Math.max(5, kpis.overallReadiness))}%` }}
            />
          </div>
          <span className="perf-kpi-subtext">Total marks scored across all tests</span>
        </div>

        {/* Accuracy */}
        <div className="perf-kpi-card card-accuracy">
          <div className="perf-kpi-card-header">
            <span className="perf-kpi-card-label">Accuracy</span>
            <div className="perf-kpi-card-icon green">
              <CheckIcon size={18} color="#059669" />
            </div>
          </div>
          <div className="perf-kpi-card-val">
            <strong>{kpis.overallAccuracy}%</strong>
            <span className="perf-stat-pill green">
              {kpis.totalCorrect} Correct
            </span>
          </div>
          <div className="perf-kpi-card-progress">
            <div
              className="perf-kpi-progress-bar green"
              style={{ width: `${Math.min(100, Math.max(5, kpis.overallAccuracy))}%` }}
            />
          </div>
          <span className="perf-kpi-subtext">Correct answers vs attempted</span>
        </div>

        {/* Negative Marks Lost */}
        <div className="perf-kpi-card card-negative">
          <div className="perf-kpi-card-header">
            <span className="perf-kpi-card-label">Negative Marks Lost</span>
            <div className="perf-kpi-card-icon red">
              <CrossIcon size={18} color="#e11d48" />
            </div>
          </div>
          <div className="perf-kpi-card-val">
            <strong style={{ color: "#e11d48" }}>-{kpis.negativeMarksLost}</strong>
            <span className="perf-stat-pill red">
              {kpis.totalIncorrect} Wrong
            </span>
          </div>
          <div className="perf-kpi-card-progress">
            <div
              className="perf-kpi-progress-bar red"
              style={{
                width: `${Math.min(100, (kpis.totalIncorrect / Math.max(1, kpis.totalQuestionsAttempted)) * 100)}%`,
              }}
            />
          </div>
          <span className="perf-kpi-subtext">Marks cut due to wrong answers</span>
        </div>

        {/* Tests Taken */}
        <div className="perf-kpi-card card-tests">
          <div className="perf-kpi-card-header">
            <span className="perf-kpi-card-label">Tests Taken</span>
            <div className="perf-kpi-card-icon purple">
              <LayersIcon size={18} color="#7c3aed" />
            </div>
          </div>
          <div className="perf-kpi-card-val">
            <strong>{kpis.totalTestsTaken}</strong>
            <span className="perf-stat-pill purple">
              {kpis.totalQuestionsAttempted} Questions
            </span>
          </div>
          <div className="perf-kpi-card-progress">
            <div
              className="perf-kpi-progress-bar purple"
              style={{ width: `${Math.min(100, kpis.totalTestsTaken * 8)}%` }}
            />
          </div>
          <span className="perf-kpi-subtext">Completed tests and quizzes</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. SIMPLE NAVIGATION TABS
          ───────────────────────────────────────────────────────────────── */}
      <div className="perf-nav-tabs">
        <button
          className={`perf-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BarChartIcon size={15} /> Overview
        </button>
        <button
          className={`perf-tab-btn ${activeTab === "drawbacks" ? "active" : ""}`}
          onClick={() => setActiveTab("drawbacks")}
        >
          <CrossIcon size={15} /> Weak Areas & Mistakes ({drawbacks.length})
        </button>
        <button
          className={`perf-tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <LayersIcon size={15} /> Test History & Scores ({testReports.length})
        </button>
        <button
          className={`perf-tab-btn ${activeTab === "matrix" ? "active" : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          <StarIcon size={15} /> Subject & Topic Scores ({allTopics.length})
        </button>
      </div>

      {loading ? (
        <div className="perf-loading-state">
          <div className="perf-spinner" />
          <p>Loading your test results and performance report...</p>
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: OVERVIEW & WEAK AREAS
              ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "drawbacks") && (
            <div className="perf-section-block">
              <div className="perf-section-header">
                <div>
                  <h3 className="perf-section-title">
                    <span className="perf-title-icon red">⚠️</span> Mistakes to Fix & Weak Topics
                  </h3>
                  <p className="perf-section-desc">
                    Here are the areas where you are losing marks and simple steps to fix them.
                  </p>
                </div>
                {drawbacks.length > 0 && (
                  <span className="perf-badge-count red">
                    {drawbacks.length} Area{drawbacks.length !== 1 ? "s" : ""} to Improve
                  </span>
                )}
              </div>

              {drawbacks.length === 0 ? (
                <div className="perf-empty-box">
                  <span style={{ fontSize: "32px" }}>🎉</span>
                  <h4>No Big Mistakes Detected!</h4>
                  <p>You have high accuracy and very few wrong answers. Keep practicing to maintain your score!</p>
                </div>
              ) : (
                <div className="perf-drawbacks-grid">
                  {drawbacks.map((dbk) => {
                    const sevClass = dbk.severity.toLowerCase();
                    return (
                      <div key={dbk.id} className={`perf-drawback-card sev-${sevClass}`}>
                        <div className="perf-drawback-top">
                          <div className="perf-drawback-badge-group">
                            <span className={`perf-sev-pill ${sevClass}`}>{dbk.severity} Priority</span>
                            <span className="perf-cat-pill">{dbk.category}</span>
                          </div>
                          <span className="perf-drawback-metric">{dbk.metric}</span>
                        </div>

                        <h4 className="perf-drawback-name">{dbk.title}</h4>

                        <div className="perf-drawback-analysis">
                          <div className="perf-analysis-item cause">
                            <strong>Why marks were lost:</strong>
                            <p>{dbk.rootCause}</p>
                          </div>
                          <div className="perf-analysis-item fix">
                            <strong>How to fix this:</strong>
                            <p>{dbk.correctiveAction}</p>
                          </div>
                        </div>

                        <div className="perf-drawback-footer">
                          <button
                            className="perf-fix-btn"
                            onClick={() => loadRevisionPool(dbk.category !== "Test Strategy" ? dbk.category : undefined)}
                          >
                            <BookOpenIcon size={13} /> Practice This Topic →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recommended Study Plan */}
          {activeTab === "overview" && recommendations.length > 0 && (
            <div className="perf-section-block">
              <div className="perf-section-header">
                <div>
                  <h3 className="perf-section-title">
                    <span className="perf-title-icon blue">🎯</span> Recommended Study Plan
                  </h3>
                  <p className="perf-section-desc">
                    Daily and weekly practice tasks to help you score higher in exams.
                  </p>
                </div>
              </div>

              <div className="perf-recs-grid">
                {recommendations.map((rec, rIdx) => (
                  <div key={rIdx} className="perf-rec-card">
                    <div className="perf-rec-header">
                      <span className={`perf-rec-prio-tag ${rec.priority.toLowerCase()}`}>
                        {rec.priority}
                      </span>
                      <span className="perf-rec-impact">⚡ {rec.impact}</span>
                    </div>
                    <p className="perf-rec-action">{rec.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: RECENT TEST REPORTS & SCORES
              ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "reports") && (
            <div className="perf-section-block">
              <div className="perf-section-header">
                <div>
                  <h3 className="perf-section-title">
                    <span className="perf-title-icon purple">📊</span> Recent Test Results & Scores
                  </h3>
                  <p className="perf-section-desc">
                    Scores and accuracy breakdown from your completed mock exams and tests.
                  </p>
                </div>

                <div className="perf-report-filters">
                  <button
                    className={`perf-chip-btn ${reportTypeFilter === "ALL" ? "active" : ""}`}
                    onClick={() => setReportTypeFilter("ALL")}
                  >
                    All Tests ({testReports.length})
                  </button>
                  <button
                    className={`perf-chip-btn ${reportTypeFilter === "Mock Exam" ? "active" : ""}`}
                    onClick={() => setReportTypeFilter("Mock Exam")}
                  >
                    Mock Exams
                  </button>
                  <button
                    className={`perf-chip-btn ${reportTypeFilter === "Test Series" ? "active" : ""}`}
                    onClick={() => setReportTypeFilter("Test Series")}
                  >
                    Test Series
                  </button>
                  <button
                    className={`perf-chip-btn ${reportTypeFilter === "Daily CA Quiz" ? "active" : ""}`}
                    onClick={() => setReportTypeFilter("Daily CA Quiz")}
                  >
                    Quizzes
                  </button>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="perf-empty-box">
                  <span style={{ fontSize: "32px" }}>📝</span>
                  <h4>No Tests Taken Yet</h4>
                  <p>Take full-length mock exams or quizzes to view your detailed scores and mistakes here.</p>
                </div>
              ) : (
                <div className="perf-reports-table-wrap">
                  <table className="perf-reports-table">
                    <thead>
                      <tr>
                        <th>Test Name</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Marks Scored</th>
                        <th>Accuracy</th>
                        <th>Correct / Wrong</th>
                        <th>Negative Marks</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((rpt, idx) => (
                        <tr key={rpt.id || idx}>
                          <td className="perf-col-title">
                            <strong>{rpt.title}</strong>
                          </td>
                          <td>
                            <span className="perf-type-tag">{rpt.type}</span>
                          </td>
                          <td className="perf-col-date">
                            <ClockIcon size={12} style={{ marginRight: 4 }} />
                            {rpt.date}
                          </td>
                          <td>
                            <div className="perf-score-cell">
                              <strong>
                                {rpt.scoredMarks} / {rpt.maxMarks}
                              </strong>
                              <span className="perf-pct-pill">{rpt.percentage}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`perf-acc-text ${rpt.accuracy >= 60 ? "good" : "warn"}`}>
                              {rpt.accuracy}%
                            </span>
                          </td>
                          <td>
                            <div className="perf-breakdown-counts">
                              <span className="count-c">+{rpt.correctCount}</span>
                              <span className="count-w">-{rpt.incorrectCount}</span>
                            </div>
                          </td>
                          <td>
                            {rpt.negativeLost > 0 ? (
                              <span className="perf-neg-badge">-{rpt.negativeLost}</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>0.0</span>
                            )}
                          </td>
                          <td>
                            <span className={`perf-status-pill ${rpt.status === "Pass" ? "pass" : "review"}`}>
                              {rpt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: SUBJECT & TOPIC PERFORMANCE
              ───────────────────────────────────────────────────────────── */}
          {(activeTab === "overview" || activeTab === "matrix") && (
            <div className="perf-section-block">
              <div className="perf-section-header">
                <div>
                  <h3 className="perf-section-title">
                    <span className="perf-title-icon green">🗺️</span> Subject & Topic Scores
                  </h3>
                  <p className="perf-section-desc">
                    Your score level and practice count for each subject and topic.
                  </p>
                </div>

                <div className="perf-matrix-toolbar">
                  <div className="perf-matrix-filters">
                    <button
                      className={`perf-chip-btn ${matrixFilterLevel === "ALL" ? "active" : ""}`}
                      onClick={() => setMatrixFilterLevel("ALL")}
                    >
                      All ({allTopics.length})
                    </button>
                    <button
                      className={`perf-chip-btn red ${matrixFilterLevel === "WEAK" ? "active" : ""}`}
                      onClick={() => setMatrixFilterLevel("WEAK")}
                    >
                      Needs Practice ({weakCount})
                    </button>
                    <button
                      className={`perf-chip-btn amber ${matrixFilterLevel === "MODERATE" ? "active" : ""}`}
                      onClick={() => setMatrixFilterLevel("MODERATE")}
                    >
                      Medium ({modCount})
                    </button>
                    <button
                      className={`perf-chip-btn green ${matrixFilterLevel === "STRONG" ? "active" : ""}`}
                      onClick={() => setMatrixFilterLevel("STRONG")}
                    >
                      Good ({strongCount})
                    </button>
                  </div>

                  <div className="perf-search-wrapper">
                    <input
                      type="text"
                      placeholder="Search subject or topic..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="perf-search-field"
                    />
                    {searchQuery && (
                      <button className="perf-search-clear-btn" onClick={() => setSearchQuery("")}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredHeatmap.length === 0 ? (
                <div className="perf-empty-box">
                  <span style={{ fontSize: "32px" }}>🔍</span>
                  <h4>No Topics Found</h4>
                  <p>Try clearing your search or filter options.</p>
                </div>
              ) : (
                <div className="perf-matrix-grid">
                  {filteredHeatmap.map((subj, sIdx) => {
                    const levelClass = subj.overallLevel.toLowerCase();
                    return (
                      <div key={sIdx} className="perf-subject-card">
                        <div className="perf-subject-header">
                          <div className="perf-subject-meta">
                            <h4 className="perf-subject-title">{subj.subject}</h4>
                            <span className="perf-subject-count">
                              {subj.topics.length} Topic{subj.topics.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className={`perf-level-pill ${levelClass}`}>
                            {subj.overallLevel} ({subj.overallPercentage}%)
                          </span>
                        </div>

                        <div className="perf-progress-wrapper">
                          <div className="perf-progress-labels">
                            <span>Score Level</span>
                            <span>{subj.overallPercentage}%</span>
                          </div>
                          <div className="perf-progress-track">
                            <div
                              className={`perf-progress-fill ${levelClass}`}
                              style={{ width: `${Math.min(100, Math.max(8, subj.overallPercentage))}%` }}
                            />
                          </div>
                        </div>

                        <div className="perf-topics-list">
                          {subj.topics.map((top, tIdx) => {
                            const topLevelClass = top.level.toLowerCase();
                            return (
                              <div key={tIdx} className="perf-topic-row">
                                <div className="perf-topic-main">
                                  <span className="perf-topic-title" title={top.topic}>
                                    {top.topic}
                                  </span>
                                  <span className="perf-topic-sub">
                                    {top.attemptCount} test{top.attemptCount !== 1 ? "s" : ""} taken
                                  </span>
                                </div>

                                <div className="perf-topic-metric">
                                  <div className="perf-topic-badges">
                                    <span className={`perf-level-pill ${topLevelClass}`} style={{ fontSize: "10.5px", padding: "2px 8px" }}>
                                      {top.level}
                                    </span>
                                    <span className="perf-topic-score">{top.percentage}%</span>
                                  </div>
                                  <button
                                    className="perf-drill-btn"
                                    onClick={() => loadRevisionPool(top.topic)}
                                    title={`Practice ${top.topic}`}
                                  >
                                    Practice →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          4. PRACTICE REVISION MODAL
          ───────────────────────────────────────────────────────────────── */}
      {showRevisionModal && (
        <div className="perf-modal-backdrop" onClick={() => setShowRevisionModal(false)}>
          <div className="perf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="perf-modal-header">
              <div>
                <h3>Practice Revision Questions</h3>
                <p>
                  {selectedTopicDrill
                    ? `Topic: ${selectedTopicDrill}`
                    : "Practice questions from your past mistakes, bookmarks, and previous exam papers"}
                </p>
              </div>
              <button className="perf-modal-close" onClick={() => setShowRevisionModal(false)}>
                ✕
              </button>
            </div>

            <div className="perf-modal-body">
              {loadingRevision ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <div className="perf-spinner" style={{ margin: "0 auto 12px" }} />
                  <p>Loading questions...</p>
                </div>
              ) : revisionQuestions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <span style={{ fontSize: "36px" }}>🎉</span>
                  <h4 style={{ margin: "12px 0 4px", color: "#0f172a" }}>No Weak Questions Pending</h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>You have answered all questions correctly in this topic!</p>
                </div>
              ) : (
                revisionQuestions.map((q, idx) => (
                  <div key={q._id || idx} className="perf-revision-item">
                    <div className="perf-revision-meta">
                      {q.isPYQ && (
                        <span className="perf-pyq-badge">
                          🏛️ PYQ {q.pyqYear || ""}
                        </span>
                      )}
                      <span className="perf-subj-badge">{q.subject || "General Studies"}</span>
                      {q.difficulty && (
                        <span className="perf-diff-badge">
                          {q.difficulty}
                        </span>
                      )}
                      <span className="perf-marks-badge">+{q.marks || 1} Marks</span>
                    </div>
                    <div className="perf-revision-qtext">
                      <strong>Q{idx + 1}.</strong> {q.questionText}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="perf-modal-footer">
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {revisionQuestions.length} question{revisionQuestions.length !== 1 ? "s" : ""} available
              </span>
              <button
                className="perf-modal-close-btn"
                onClick={() => setShowRevisionModal(false)}
              >
                Close Practice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceHeatmap;
