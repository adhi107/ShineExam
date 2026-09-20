import React, { useEffect, useState } from "react";
import { apiGet } from "../../services/api";
import { AwardIcon, BarChartIcon, BookOpenIcon, CheckIcon, StarIcon, TagIcon } from "../common/EnterpriseIcons";
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
  const [heatmap, setHeatmap] = useState<SubjectPerformance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Revision pool drawer state
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [revisionQuestions, setRevisionQuestions] = useState<RevisionQuestion[]>([]);
  const [loadingRevision, setLoadingRevision] = useState<boolean>(false);
  const [selectedTopicDrill, setSelectedTopicDrill] = useState<string | null>(null);

  useEffect(() => {
    loadHeatmap();
  }, [userName]);

  const loadHeatmap = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ heatmap: SubjectPerformance[] }>(
        `/answerer/learning-hub/performance/heatmap?userId=${encodeURIComponent(userName)}`
      );
      if (res && res.heatmap) {
        setHeatmap(res.heatmap);
      }
    } catch (err) {
      console.error("Failed to load performance heatmap:", err);
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
        setRevisionQuestions(res.questions);
      }
    } catch (err) {
      console.error("Failed to load revision pool:", err);
    } finally {
      setLoadingRevision(false);
    }
  };

  // Compute summary stats
  const allTopics = heatmap.flatMap((s) => s.topics || []);
  const strongCount = allTopics.filter((t) => t.level === "Strong").length;
  const modCount = allTopics.filter((t) => t.level === "Moderate").length;
  const weakCount = allTopics.filter((t) => t.level === "Weak").length;
  const avgOverall = heatmap.length > 0
    ? Math.round(heatmap.reduce((acc, s) => acc + s.overallPercentage, 0) / heatmap.length)
    : 0;

  // Filter subjects / topics
  const filteredHeatmap = heatmap.map((s) => {
    let topics = s.topics || [];
    if (filterLevel !== "ALL") {
      topics = topics.filter((t) => t.level.toUpperCase() === filterLevel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      topics = topics.filter((t) => t.topic.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q));
    }
    return { ...s, topics };
  }).filter((s) => s.topics.length > 0 || (searchQuery.trim() === "" && filterLevel === "ALL"));

  return (
    <div className="perf-heatmap-container">
      {/* Hero Banner */}
      <div className="perf-hero-banner">
        <div className="perf-hero-info">
          <span className="perf-hero-kicker">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Performance Diagnostics
          </span>
          <h2>Subject & Topic Focus Matrix</h2>
          <p>
            Key strengths and priority areas identified from your latest test attempts.
          </p>
        </div>

        <div className="perf-hero-stats">
          <div className="perf-kpi-pill score">
            <div className="perf-kpi-icon">
              <AwardIcon size={18} color="#2563eb" />
            </div>
            <div className="perf-kpi-data">
              <span>Readiness</span>
              <strong>{avgOverall}%</strong>
            </div>
          </div>
          <div className="perf-kpi-pill weak">
            <div className="perf-kpi-icon">
              <BarChartIcon size={18} color="#e11d48" />
            </div>
            <div className="perf-kpi-data">
              <span>Priority Focus</span>
              <strong>{weakCount} Topics</strong>
            </div>
          </div>
          <div className="perf-kpi-pill strong">
            <div className="perf-kpi-icon">
              <StarIcon size={18} color="#059669" filled />
            </div>
            <div className="perf-kpi-data">
              <span>Mastered</span>
              <strong>{strongCount} Topics</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="perf-toolbar">
        <div className="perf-filter-group">
          <button
            className={`perf-filter-btn ${filterLevel === "ALL" ? "active" : ""}`}
            onClick={() => setFilterLevel("ALL")}
          >
            All Areas ({allTopics.length})
          </button>
          <button
            className={`perf-filter-btn weak ${filterLevel === "WEAK" ? "active" : ""}`}
            onClick={() => setFilterLevel("WEAK")}
          >
            Priority Focus ({weakCount})
          </button>
          <button
            className={`perf-filter-btn moderate ${filterLevel === "MODERATE" ? "active" : ""}`}
            onClick={() => setFilterLevel("MODERATE")}
          >
            Moderate ({modCount})
          </button>
          <button
            className={`perf-filter-btn strong ${filterLevel === "STRONG" ? "active" : ""}`}
            onClick={() => setFilterLevel("STRONG")}
          >
            Mastered ({strongCount})
          </button>
        </div>

        <div className="perf-actions">
          <div className="perf-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="perf-search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search subject or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="perf-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="perf-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="perf-actions-buttons">
            <button
              className="perf-action-btn secondary"
              onClick={() => loadHeatmap()}
              title="Refresh Matrix"
            >
              Refresh
            </button>
            <button
              className="perf-action-btn primary"
              onClick={() => loadRevisionPool()}
            >
              <BookOpenIcon size={14} style={{ marginRight: 4 }} /> Personal Revision Pool
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          <strong>Computing topic mastery telemetry...</strong>
        </div>
      ) : filteredHeatmap.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <div style={{ marginBottom: "8px" }}>
            <BarChartIcon size={32} color="#94a3b8" />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>No telemetry matching criteria</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Attempt additional tests or clear your search filters.
          </p>
        </div>
      ) : (
        /* Matrix Grid */
        <div className="perf-matrix-grid">
          {filteredHeatmap.map((subj, sIdx) => {
            const levelClass = subj.overallLevel.toLowerCase();
            return (
              <div key={sIdx} className="perf-subject-card">
                <div className="perf-subject-header">
                  <div className="perf-subject-meta">
                    <h3 className="perf-subject-title">{subj.subject}</h3>
                    <span className="perf-subject-count">
                      {subj.topics.length} Evaluated Topics
                    </span>
                  </div>
                  <span className={`perf-level-pill ${levelClass}`}>
                    {subj.overallLevel} ({subj.overallPercentage}%)
                  </span>
                </div>

                <div className="perf-progress-wrapper">
                  <div className="perf-progress-labels">
                    <span>Proficiency Index</span>
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
                            {top.attemptCount} drill{top.attemptCount !== 1 ? "s" : ""} recorded
                          </span>
                        </div>

                        <div className="perf-topic-metric">
                          <div className="perf-topic-badges">
                            <span className={`perf-level-pill ${topLevelClass}`} style={{ fontSize: "10px", padding: "2px 8px" }}>
                              {top.level}
                            </span>
                            <span className="perf-topic-score">{top.percentage}%</span>
                          </div>
                          <button
                            className="perf-drill-btn"
                            onClick={() => loadRevisionPool(top.topic)}
                            title={`Practice ${top.topic}`}
                          >
                            Drill →
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

      {/* Revision Pool Modal */}
      {showRevisionModal && (
        <div className="perf-modal-backdrop" onClick={() => setShowRevisionModal(false)}>
          <div className="perf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="perf-modal-header">
              <div>
                <h3>Personal Revision Pool {selectedTopicDrill ? `— ${selectedTopicDrill}` : ""}</h3>
                <p>Curated focus items from PYQs, past test attempts, and weak topic drills</p>
              </div>
              <button className="perf-modal-close" onClick={() => setShowRevisionModal(false)}>
                ✕
              </button>
            </div>

            <div className="perf-modal-body">
              {loadingRevision ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  ⏳ Loading practice questions...
                </div>
              ) : revisionQuestions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  🎉 No weak items in this pool! Your retention is solid.
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
                      <span style={{ color: "#64748b" }}>{q.subject || "General Studies"}</span>
                      {q.difficulty && (
                        <span style={{ textTransform: "capitalize", color: "#475569" }}>
                          • {q.difficulty}
                        </span>
                      )}
                    </div>
                    <div className="perf-revision-qtext">
                      <strong>Q{idx + 1}.</strong> {q.questionText}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="perf-modal-footer">
              <button
                className="perf-action-btn primary"
                onClick={() => setShowRevisionModal(false)}
              >
                Close Drill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceHeatmap;
