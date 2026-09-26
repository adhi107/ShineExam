import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPostForm, buildUrl } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import "./StudentTestSeriesView.css";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PaperType = "mcq" | "descriptive" | "essay";
export type AttemptStatus = "not_started" | "in_progress" | "submitted" | "under_evaluation" | "result_published";
export type SeriesStatus = "draft" | "active" | "completed";

export interface SubmissionConfig {
  maxWordCount: number | null;
  maxPageCount: number | null;
  maxFileSizeMb: number;
  allowedFormats: string[];
  instructions: string;
}

export interface PaperCard {
  id: string;
  paperNumber: number;
  paperName: string;
  paperType: PaperType;
  duration: number;
  totalMarks: number;
  questionCount: number;
  isOptional?: boolean;
  optionalSubject?: string;
  subjectCategory?: string;
  paperStage?: string;
  matchesUserOptional?: boolean;
  submissionConfig: SubmissionConfig;
  attemptStatus: AttemptStatus;
  attemptId?: string;
  score?: number;
  feedback?: string;
  publishedAt?: string;
}

export interface SeriesCard {
  id: string;
  name: string;
  description: string;
  examType: string;
  status: SeriesStatus;
  availableFrom?: string;
  validUntil?: string;
  totalMarks: number;
  passingPercentage: number;
  paperCount: number;
  attemptedPapers: number;
  availableOptionalSubjects?: string[];
  selectedOptionalSubject?: string;
  hasOptionalPapers?: boolean;
  requiresOptionalSelection?: boolean;
  papers: PaperCard[];
}

export interface HistoryItem {
  seriesId: string;
  seriesName: string;
  examType: string;
  totalScored: number;
  totalMax: number;
  percentage: number | null;
  lastAttemptAt?: string;
  paperResults: Array<{
    attemptId: string;
    paperId: string;
    paperName: string;
    paperType: PaperType;
    score: number | null;
    maxMarks: number | null;
    percentage: number | null;
    status: string;
    feedback: string;
    submittedAt?: string;
    publishedAt?: string;
  }>;
}

interface Props {
  userName: string;
  onStartExam?: (examData: any) => void;
}

// ─────────────────────────────────────────────────────────────────
// Exam type config
// ─────────────────────────────────────────────────────────────────

export const EXAM_META: Record<string, { label: string; icon: string; colorClass: string }> = {
  upsc_prelims: { label: "UPSC Prelims", icon: "🏛️", colorClass: "type-upsc" },
  upsc_mains: { label: "UPSC Mains", icon: "🏛️", colorClass: "type-upsc" },
  upsc_essay: { label: "UPSC Essay", icon: "🏛️", colorClass: "type-upsc" },
  tspsc_group1: { label: "TSPSC Group-I", icon: "🌊", colorClass: "type-tspsc" },
  tspsc_group2: { label: "TSPSC Group-II", icon: "🌊", colorClass: "type-tspsc" },
  appsc_group1: { label: "APPSC Group-I", icon: "⚡", colorClass: "type-appsc" },
  appsc_group2: { label: "APPSC Group-II", icon: "⚡", colorClass: "type-appsc" },
  tnpsc: { label: "TNPSC", icon: "🌴", colorClass: "type-appsc" },
  ssc_cgl: { label: "SSC CGL", icon: "📊", colorClass: "type-ssc" },
  ssc_chsl: { label: "SSC CHSL", icon: "📊", colorClass: "type-ssc" },
  banking_po: { label: "Banking PO", icon: "🏦", colorClass: "type-banking" },
  banking_clerk: { label: "Banking Clerk", icon: "🏦", colorClass: "type-banking" },
  daily_test: { label: "Daily Test", icon: "📅", colorClass: "type-daily" },
  mock_test: { label: "Mock Test", icon: "📝", colorClass: "type-other" },
  other: { label: "Other", icon: "📋", colorClass: "type-other" },
};

export const STATUS_META: Record<AttemptStatus, { label: string; colorClass: string; icon: string }> = {
  not_started: { label: "Not Started", colorClass: "status-not-started", icon: "⚪" },
  in_progress: { label: "In Progress", colorClass: "status-in-progress", icon: "⏳" },
  submitted: { label: "Submitted", colorClass: "status-submitted", icon: "📥" },
  under_evaluation: { label: "Under Evaluation", colorClass: "status-evaluation", icon: "🔍" },
  result_published: { label: "Result Published", colorClass: "status-published", icon: "✅" },
};

const COMMON_OPTIONALS = [
  "Public Administration",
  "Geography",
  "Political Science & IR",
  "Sociology",
  "History",
  "Anthropology",
  "Economics",
  "Public Policy",
  "Commerce & Accountancy",
  "Philosophy",
  "Psychology",
  "Law",
];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const fmtSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// ─────────────────────────────────────────────────────────────────
// Descriptive Upload Modal
// ─────────────────────────────────────────────────────────────────

function DescriptiveUploadModal({
  paper,
  seriesId,
  userId,
  onClose,
  onUploaded,
}: {
  paper: PaperCard;
  seriesId: string;
  userId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [wordCount, setWordCount] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cfg = paper.submissionConfig || {
    maxFileSizeMb: 10,
    allowedFormats: ["pdf", "jpg", "jpeg", "png", "webp", "docx", "doc", "heic"],
    maxWordCount: null,
    maxPageCount: null,
    instructions: "",
  };

  const handleFile = (f: File) => {
    setError("");
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (cfg.allowedFormats.length && !cfg.allowedFormats.includes(ext)) {
      setError(`File type ".${ext}" not allowed. Allowed formats: ${cfg.allowedFormats.join(", ").toUpperCase()}`);
      return;
    }
    const maxBytes = cfg.maxFileSizeMb * 1024 * 1024;
    if (f.size > maxBytes) {
      setError(`File is too large (${fmtSize(f.size)}). Maximum limit: ${cfg.maxFileSizeMb} MB`);
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select your answer sheet file to upload");
      return;
    }
    if (!confirmed) {
      setError("Please check the declaration box confirming this is your original work");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", userId);
      if (wordCount) form.append("wordCount", wordCount);
      if (pageCount) form.append("pageCount", pageCount);
      await apiPostForm(`/answerer/test-series/${seriesId}/papers/${paper.id}/upload`, form);
      onUploaded();
    } catch (e: any) {
      setError(e?.message || "Upload failed. Please check your network and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sts-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sts-modal">
        <div className="sts-modal-header">
          <div className={`sts-modal-icon ${paper.paperType}`}>
            {paper.paperType === "essay" ? "✍️" : "📝"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sts-modal-title">{paper.paperName}</p>
            <p className="sts-modal-sub">
              Paper {paper.paperNumber} · {paper.paperType.toUpperCase()} Submission · {paper.totalMarks} Marks · {paper.duration} Min
            </p>
          </div>
          <button className="sts-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {cfg.instructions && (
          <div className="sts-upload-instructions">
            📌 <strong>Instructions:</strong> {cfg.instructions}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div
            className={`sts-upload-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              accept={cfg.allowedFormats.map(f => `.${f}`).join(",")}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="sts-upload-icon">{file ? "📄" : "☁️"}</div>
            <div className="sts-upload-label">
              {file ? file.name : "Drop answer sheet here or click to browse"}
            </div>
            <div className="sts-upload-sub">
              Allowed: {cfg.allowedFormats.join(", ").toUpperCase()} (Max {cfg.maxFileSizeMb} MB)
            </div>
          </div>

          {file && (
            <div className="sts-upload-file-info">
              <span className="sts-file-badge">📎 {file.name}</span>
              <span className="sts-file-size">{fmtSize(file.size)}</span>
              <button
                className="sts-file-remove"
                onClick={e => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="sts-upload-limits">
            <div className="sts-upload-limit-item">📁 Max size: <strong>{cfg.maxFileSizeMb} MB</strong></div>
            {cfg.maxWordCount && (
              <div className="sts-upload-limit-item">📝 Max words: <strong>{cfg.maxWordCount.toLocaleString()}</strong></div>
            )}
            {cfg.maxPageCount && (
              <div className="sts-upload-limit-item">📄 Max pages: <strong>{cfg.maxPageCount}</strong></div>
            )}
          </div>

          {(cfg.maxWordCount != null || cfg.maxPageCount != null) && (
            <div className="sts-optional-fields">
              {cfg.maxWordCount != null && (
                <div className="sts-field-mini">
                  <label>Approx. Word Count</label>
                  <input
                    type="number"
                    placeholder={`Max ${cfg.maxWordCount}`}
                    value={wordCount}
                    onChange={e => setWordCount(e.target.value)}
                  />
                </div>
              )}
              {cfg.maxPageCount != null && (
                <div className="sts-field-mini">
                  <label>Page Count</label>
                  <input
                    type="number"
                    placeholder={`Max ${cfg.maxPageCount}`}
                    value={pageCount}
                    onChange={e => setPageCount(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="sts-upload-error">
              ⚠️ {error}
            </div>
          )}

          <label className="sts-upload-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm this submission represents my own original handwritten or typed work. Once uploaded, evaluation will commence and answers cannot be altered without administrator clearance.
            </span>
          </label>
        </div>

        <div className="sts-modal-footer">
          <button className="sts-btn sts-btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button className="sts-btn sts-btn-primary" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "Uploading…" : "📤 Submit Answer Sheet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Series Detail Modal (With Optional Track Selection)
// ─────────────────────────────────────────────────────────────────

function SeriesDetailModal({
  series: initialSeries,
  userId,
  onClose,
  onStartMCQ,
  onRefresh,
  onShowAlert,
}: {
  series: SeriesCard;
  userId: string;
  onClose: () => void;
  onStartMCQ: (paper: PaperCard) => void;
  onRefresh: () => void;
  onShowAlert: (title: string, message: string, variant?: AlertVariant) => void;
}) {
  const [series, setSeries] = useState<SeriesCard>(initialSeries);
  const [uploadTarget, setUploadTarget] = useState<PaperCard | null>(null);
  const [viewResultPaper, setViewResultPaper] = useState<PaperCard | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "compulsory" | "optional">("all");
  const [selectingOptional, setSelectingOptional] = useState(false);
  const [savingOptional, setSavingOptional] = useState(false);
  const [customOptionalInput, setCustomOptionalInput] = useState("");

  const examMeta = EXAM_META[series.examType] || EXAM_META.other;

  // Determine available optional subjects in this series
  const seriesOptionals = useMemo(() => {
    const list = new Set<string>(series.availableOptionalSubjects || []);
    series.papers.forEach(p => {
      if (p.isOptional && p.optionalSubject) {
        list.add(p.optionalSubject);
      }
    });
    return Array.from(list);
  }, [series]);

  const hasOptionalTracks = seriesOptionals.length > 0;
  const currentOptional = series.selectedOptionalSubject || "";

  // Filter papers for display
  const displayPapers = useMemo(() => {
    return series.papers.filter(paper => {
      if (filterMode === "compulsory") {
        return !paper.isOptional;
      }
      if (filterMode === "optional") {
        return paper.isOptional;
      }
      // "all" mode: if student has chosen an optional, show all compulsory + their chosen optional papers
      if (currentOptional) {
        return !paper.isOptional || paper.optionalSubject?.toLowerCase() === currentOptional.toLowerCase();
      }
      return true;
    });
  }, [series.papers, filterMode, currentOptional]);

  const handleSelectOptional = async (subject: string) => {
    if (!subject.trim()) return;
    setSavingOptional(true);
    try {
      const res = await apiPost<{ message: string; series: SeriesCard }>(
        `/answerer/test-series/${series.id}/select-optional`,
        { userId, optionalSubject: subject.trim() }
      );
      if (res.series) {
        setSeries(res.series);
      } else {
        setSeries(prev => ({ ...prev, selectedOptionalSubject: subject.trim(), requiresOptionalSelection: false }));
      }
      setSelectingOptional(false);
      onRefresh();
      onShowAlert("Optional Subject Track Confirmed", `Your optional track has been updated to "${subject}". All corresponding papers are now unlocked.`, "success");
    } catch (e: any) {
      onShowAlert("Optional Selection Error", e?.message || "Failed to update optional subject track", "danger");
    } finally {
      setSavingOptional(false);
    }
  };

  const openResult = async (paper: PaperCard) => {
    if (!paper.attemptId) return;
    setViewResultPaper(paper);
    setResultLoading(true);
    try {
      const res = await apiGet<{ result: any }>(
        `/answerer/test-series/results/${paper.attemptId}?userId=${encodeURIComponent(userId)}`
      );
      setResultData(res.result);
    } catch {
      setResultData(null);
    } finally {
      setResultLoading(false);
    }
  };

  const handleUploaded = () => {
    setUploadTarget(null);
    onRefresh();
    onShowAlert("Answer Sheet Submitted!", "Your paper has been queued for evaluation. Marks and comments will appear here once published.", "success");
  };

  const progress = series.paperCount > 0 ? Math.round((series.attemptedPapers / series.paperCount) * 100) : 0;

  return (
    <div className="sts-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sts-modal sts-modal-wide">
        <div className="sts-modal-header">
          <div className={`sts-modal-icon ${examMeta.colorClass}`}>{examMeta.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p className="sts-modal-title">{series.name}</p>
              <span className={`sts-meta-badge ${examMeta.colorClass}`}>{examMeta.label}</span>
            </div>
            <p className="sts-modal-sub">
              {series.paperCount} Active Papers · {series.totalMarks} Total Marks · Passing {series.passingPercentage}%
            </p>
          </div>
          <button className="sts-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Optional Track Selector Banner if series supports optional papers */}
        {hasOptionalTracks && (
          <div className="sts-optional-track-banner">
            <div className="sts-optional-track-header">
              <div className="sts-optional-track-info">
                <span className="sts-track-icon">🎯</span>
                <div>
                  <strong>Optional Subject Track</strong>
                  <p>
                    {currentOptional ? (
                      <>Selected Track: <span className="sts-highlight-track">{currentOptional}</span></>
                    ) : (
                      <span style={{ color: "#d97706" }}>⚠️ Please select your Optional Subject to filter exam papers</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                className="sts-btn sts-btn-secondary sts-btn-sm"
                onClick={() => setSelectingOptional(v => !v)}
              >
                {currentOptional ? "✏️ Change Track" : "⚡ Select Optional Track"}
              </button>
            </div>

            {selectingOptional && (
              <div className="sts-optional-picker-dropdown">
                <p className="sts-picker-hint">Choose your optional subject to customize your syllabus papers:</p>
                <div className="sts-optional-pills-grid">
                  {(seriesOptionals.length > 0 ? seriesOptionals : COMMON_OPTIONALS).map(subj => (
                    <button
                      key={subj}
                      className={`sts-optional-pill-btn ${currentOptional.toLowerCase() === subj.toLowerCase() ? "selected" : ""}`}
                      onClick={() => handleSelectOptional(subj)}
                      disabled={savingOptional}
                    >
                      {currentOptional.toLowerCase() === subj.toLowerCase() ? "✓ " : ""}{subj}
                    </button>
                  ))}
                </div>

                <div className="sts-custom-optional-row">
                  <input
                    className="sts-custom-input"
                    placeholder="Or enter custom optional subject…"
                    value={customOptionalInput}
                    onChange={e => setCustomOptionalInput(e.target.value)}
                  />
                  <button
                    className="sts-btn sts-btn-primary sts-btn-sm"
                    onClick={() => {
                      if (customOptionalInput.trim()) handleSelectOptional(customOptionalInput.trim());
                    }}
                    disabled={savingOptional || !customOptionalInput.trim()}
                  >
                    Set Track
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress & Overview Bar */}
        <div className="sts-progress-wrap" style={{ marginBottom: 18, marginTop: 12 }}>
          <div className="sts-progress-label">
            <span>Progress: {series.attemptedPapers}/{series.paperCount} Papers Attempted</span>
            <span>{progress}% Completed</span>
          </div>
          <div className="sts-progress-bar-bg">
            <div className="sts-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Filter Sub-Tabs */}
        {hasOptionalTracks && (
          <div className="sts-filter-subtabs">
            <button
              className={`sts-subtab ${filterMode === "all" ? "active" : ""}`}
              onClick={() => setFilterMode("all")}
            >
              All Papers ({series.papers.length})
            </button>
            <button
              className={`sts-subtab ${filterMode === "compulsory" ? "active" : ""}`}
              onClick={() => setFilterMode("compulsory")}
            >
              Compulsory Papers
            </button>
            <button
              className={`sts-subtab ${filterMode === "optional" ? "active" : ""}`}
              onClick={() => setFilterMode("optional")}
            >
              Optional Papers {currentOptional ? `(${currentOptional})` : ""}
            </button>
          </div>
        )}

        {/* Papers List */}
        <div className="sts-paper-rows" style={{ flex: 1, overflowY: "auto" }}>
          {displayPapers.length === 0 ? (
            <div className="sts-empty-sub" style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
              <h4 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: "16px", fontWeight: 800 }}>No Exam Papers in this Test Series Yet</h4>
              <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                Papers will appear here once published by the examination authority.
              </p>
            </div>
          ) : (
            displayPapers.map(paper => {
              const status = paper.attemptStatus || "not_started";
              const canStart = status === "not_started" && paper.paperType === "mcq";
              const canUpload = status === "not_started" && paper.paperType !== "mcq";
              const hasResult = status === "result_published";
              const submitted = status === "submitted" || status === "under_evaluation";
              const statusMeta = STATUS_META[status] || STATUS_META.not_started;

              return (
                <div key={paper.id} className="sts-paper-row">
                  <div className={`sts-paper-circle ${paper.paperType}`}>
                    {paper.paperType === "mcq" ? "📊" : paper.paperType === "essay" ? "✍️" : "📝"}
                  </div>

                  <div className="sts-paper-row-info">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <p className="sts-paper-row-name">
                        Paper {paper.paperNumber}: {paper.paperName}
                      </p>
                      {paper.isOptional ? (
                        <span className="sts-tag sts-tag-optional">
                          Optional Track · {paper.optionalSubject || "Elective"}
                        </span>
                      ) : (
                        <span className="sts-tag sts-tag-compulsory">Compulsory</span>
                      )}
                      {paper.paperStage && (
                        <span className="sts-tag sts-tag-stage">{paper.paperStage}</span>
                      )}
                    </div>

                    <div className="sts-paper-row-meta">
                      <span className={`sts-paper-mini-status ${statusMeta.colorClass}`}>
                        {statusMeta.icon} {statusMeta.label}
                      </span>
                      <span>⏱️ {paper.duration} min</span>
                      <span>🎯 {paper.totalMarks} marks</span>
                      {paper.paperType === "mcq" ? (
                        <span>🔢 {paper.questionCount} Questions</span>
                      ) : (
                        <span>📝 {paper.paperType.toUpperCase()}</span>
                      )}
                      {paper.submissionConfig?.maxWordCount && (
                        <span>Max words: {paper.submissionConfig.maxWordCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="sts-paper-row-actions">
                    {canStart && (
                      <button
                        className="sts-btn sts-btn-primary sts-btn-sm"
                        onClick={() => onStartMCQ(paper)}
                      >
                        ▶ Start MCQ
                      </button>
                    )}
                    {canUpload && (
                      <button
                        className="sts-btn sts-btn-primary sts-btn-sm"
                        onClick={() => setUploadTarget(paper)}
                      >
                        📤 Submit Paper
                      </button>
                    )}
                    {submitted && (
                      <span className="sts-status-pill evaluation">
                        ⏳ Under Evaluation
                      </span>
                    )}
                    {hasResult && (
                      <button
                        className="sts-btn sts-btn-secondary sts-btn-sm"
                        onClick={() => openResult(paper)}
                      >
                        📊 View Result
                      </button>
                    )}
                    {paper.score != null && paper.paperType === "mcq" && status === "submitted" && (
                      <button
                        className="sts-btn sts-btn-secondary sts-btn-sm"
                        onClick={() => openResult(paper)}
                      >
                        📊 View Scorecard
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Result view */}
        {viewResultPaper && (
          <div className="sts-result-modal-box">
            <div className="sts-result-card">
              <div className="sts-result-card-header">
                <div>
                  <div className="sts-result-card-title">
                    🏆 {viewResultPaper.paperName} — Evaluation Report
                  </div>
                  <div className="sts-result-sub">
                    Paper {viewResultPaper.paperNumber} · {viewResultPaper.paperType.toUpperCase()}
                  </div>
                </div>
                <button
                  className="sts-modal-close-btn"
                  onClick={() => { setViewResultPaper(null); setResultData(null); }}
                >
                  ✕
                </button>
              </div>

              {resultLoading ? (
                <div className="sts-loading" style={{ padding: "32px" }}>
                  <div className="sts-spinner" /> Loading official evaluation report…
                </div>
              ) : resultData ? (
                <div className="sts-result-content">
                  {/* Score & Evaluation Header Showcase */}
                  <div className="sts-eval-hero-card">
                    <div className="sts-score-showcase">
                      <div className="sts-score-label">Official Awarded Score</div>
                      <div className="sts-score-big">
                        {resultData.score ?? resultData.scoredMarks ?? "—"}
                        <span className="sts-score-max">
                          / {resultData.maxMarks ?? viewResultPaper.totalMarks}
                        </span>
                      </div>
                      {resultData.percentage != null && (
                        <div className={`sts-score-pct-badge ${resultData.percentage >= 60 ? "good" : resultData.percentage >= 40 ? "pass" : "needs-work"}`}>
                          {resultData.percentage.toFixed(1)}% Marks Scored
                        </div>
                      )}
                    </div>

                    <div className="sts-eval-meta-details">
                      {resultData.evaluatedBy && (
                        <div className="sts-eval-meta-row">
                          <span className="sts-meta-icon">👨‍🏫</span>
                          <div>
                            <div className="sts-meta-lbl">Evaluated By</div>
                            <div className="sts-meta-val">{resultData.evaluatedBy}</div>
                          </div>
                        </div>
                      )}
                      {resultData.evaluatedAt && (
                        <div className="sts-eval-meta-row">
                          <span className="sts-meta-icon">📅</span>
                          <div>
                            <div className="sts-meta-lbl">Evaluation Date</div>
                            <div className="sts-meta-val">{fmtDate(resultData.evaluatedAt)}</div>
                          </div>
                        </div>
                      )}
                      {resultData.annotatedFileUrl && (
                        <a
                          href={resultData.annotatedFileUrl.startsWith("http") || resultData.annotatedFileUrl.startsWith("/") ? resultData.annotatedFileUrl : `/${resultData.annotatedFileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sts-eval-annotated-btn"
                          title="Download Annotated Paper with Examiner Marks"
                        >
                          📥 Download Annotated Answer Sheet
                        </a>
                      )}
                    </div>
                  </div>

                  {/* General Evaluator Comments */}
                  {resultData.feedback && (
                    <div className="sts-eval-section-card sts-feedback-card">
                      <div className="sts-eval-card-header">
                        <span className="sts-eval-card-icon">📝</span>
                        <div>
                          <h4>Evaluator Overall Remarks</h4>
                          <p>General observations regarding presentation, structure, and answer quality</p>
                        </div>
                      </div>
                      <div className="sts-eval-card-body">
                        {resultData.feedback}
                      </div>
                    </div>
                  )}

                  {/* Key Strengths */}
                  {resultData.strengths && (
                    <div className="sts-eval-section-card sts-strengths-card">
                      <div className="sts-eval-card-header">
                        <span className="sts-eval-card-icon">🌟</span>
                        <div>
                          <h4>Demonstrated Strengths & High Points</h4>
                          <p>Aspects where your answer stood out</p>
                        </div>
                      </div>
                      <div className="sts-eval-card-body">
                        {resultData.strengths}
                      </div>
                    </div>
                  )}

                  {/* Improvement Suggestions & Weakness Areas */}
                  {resultData.improvementSuggestions && (
                    <div className="sts-eval-section-card sts-improvements-card">
                      <div className="sts-eval-card-header">
                        <span className="sts-eval-card-icon">💡</span>
                        <div>
                          <h4>Actionable Improvement Suggestions & Weaknesses</h4>
                          <p>Targeted suggestions from the examiner to boost your mains descriptive scores</p>
                        </div>
                      </div>
                      <div className="sts-eval-card-body">
                        {resultData.improvementSuggestions}
                      </div>
                    </div>
                  )}

                  {/* Rubric Criteria Breakdown */}
                  {resultData.criteriaScores && resultData.criteriaScores.length > 0 && (
                    <div className="sts-eval-section-card sts-rubric-card">
                      <div className="sts-eval-card-header">
                        <span className="sts-eval-card-icon">📊</span>
                        <div>
                          <h4>Criteria Rubric Breakdown</h4>
                          <p>Section-by-section scoring breakdown by the evaluation board</p>
                        </div>
                      </div>
                      <div className="sts-criteria-table-wrap">
                        <table className="sts-criteria-table">
                          <thead>
                            <tr>
                              <th>Evaluation Parameter</th>
                              <th>Max Marks</th>
                              <th>Awarded</th>
                              <th>Examiner Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultData.criteriaScores.map((c: any, idx: number) => (
                              <tr key={idx}>
                                <td><strong>{c.parameter || `Section ${idx + 1}`}</strong></td>
                                <td>{c.maxMarks}</td>
                                <td><span className="sts-awarded-mark">{c.awardedMarks}</span></td>
                                <td>{c.remarks || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="sts-empty-sub" style={{ padding: "32px", textAlign: "center" }}>
                  Score and detailed suggestions are currently being formatted.
                </div>
              )}
            </div>
          </div>
        )}

        {uploadTarget && (
          <DescriptiveUploadModal
            paper={uploadTarget}
            seriesId={series.id}
            userId={userId}
            onClose={() => setUploadTarget(null)}
            onUploaded={handleUploaded}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// History View
// ─────────────────────────────────────────────────────────────────

function HistoryView({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
    return (
      <div className="sts-empty">
        <div className="sts-empty-icon">📊</div>
        <h3>No completed test series yet</h3>
        <p>Your finished test papers, evaluator feedback, and scorecards will be archived here.</p>
      </div>
    );
  }

  return (
    <div className="sts-history-grid">
      {history.map(item => {
        const examMeta = EXAM_META[item.examType] || EXAM_META.other;
        return (
          <div key={item.seriesId} className="sts-history-card">
            <div className="sts-history-header">
              <div>
                <p className="sts-history-title">{item.seriesName}</p>
                <p className="sts-history-sub">
                  {examMeta.icon} {examMeta.label} · Last attempt {fmtDate(item.lastAttemptAt)}
                </p>
              </div>
              <div className="sts-history-aggregate">
                <div className="sts-agg-score">
                  {item.totalScored.toFixed(1)}
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/{item.totalMax}</span>
                </div>
                {item.percentage != null && (
                  <div className="sts-agg-pct">{item.percentage.toFixed(1)}%</div>
                )}
              </div>
            </div>

            <div className="sts-history-papers">
              {item.paperResults.map(pr => (
                <div key={pr.paperId} className="sts-hist-paper-chip">
                  <div className="sts-hist-paper-chip-name">{pr.paperName}</div>
                  <div className="sts-hist-paper-chip-score">
                    {pr.score != null ? (
                      <strong>{pr.score}/{pr.maxMarks}</strong>
                    ) : (
                      <span style={{ fontWeight: 500, color: "#64748b", fontSize: "0.72rem" }}>
                        {pr.status === "pending"
                          ? "⏳ Pending"
                          : pr.status === "evaluated"
                          ? "🔍 Evaluated"
                          : "—"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

const StudentTestSeriesView: React.FC<Props> = ({ userName, onStartExam }) => {
  const [viewTab, setViewTab] = useState<"browse" | "history">("browse");
  const [series, setSeries] = useState<SeriesCard[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [examTypeFilter, setExamTypeFilter] = useState("");
  const [detailSeries, setDetailSeries] = useState<SeriesCard | null>(null);

  // In-Screen Alert State
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: AlertVariant;
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  const showAlert = (title: string, message: string, variant: AlertVariant = "info") => {
    setAlertState({ isOpen: true, title, message, variant });
  };

  const loadSeries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: userName });
      if (examTypeFilter) params.set("examType", examTypeFilter);
      const res = await apiGet<{ series: SeriesCard[] }>(`/answerer/test-series?${params}`);
      setSeries(res.series || []);
    } catch (err) {
      console.error("Failed to load student test series:", err);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [userName, examTypeFilter]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiGet<{ history: HistoryItem[] }>(
        `/answerer/test-series/history?userId=${encodeURIComponent(userName)}`
      );
      setHistory(res.history || []);
    } catch (err) {
      console.error("Failed to load test series history:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    if (viewTab === "history") loadHistory();
  }, [viewTab, loadHistory]);

  const filtered = useMemo(() => {
    return series.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [series, search]);

  const groupedByExam = useMemo(() => {
    const groups: Record<string, SeriesCard[]> = {};
    filtered.forEach(s => {
      const key = s.examType || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filtered]);

  // Key stats
  const totalAvailablePapers = useMemo(() => {
    return series.reduce((acc, s) => acc + (s.paperCount || 0), 0);
  }, [series]);

  const totalAttempted = useMemo(() => {
    return series.reduce((acc, s) => acc + (s.attemptedPapers || 0), 0);
  }, [series]);

  const handleStartMCQ = async (paper: PaperCard, seriesId: string) => {
    try {
      const res = await apiGet<{ exam: any }>(
        `/answerer/test-series/${seriesId}/papers/${paper.id}/start?userId=${encodeURIComponent(userName)}`
      );
      if (onStartExam) {
        onStartExam(res.exam);
      }
    } catch (e: any) {
      showAlert("Start Exam Error", e?.message || "Could not launch MCQ paper session.", "danger");
    }
  };

  const handleDetailRefresh = async () => {
    if (!detailSeries) return;
    try {
      const res = await apiGet<{ series: SeriesCard }>(
        `/answerer/test-series/${detailSeries.id}?userId=${encodeURIComponent(userName)}`
      );
      setDetailSeries(res.series);
      setSeries(prev => prev.map(s => (s.id === res.series.id ? res.series : s)));
    } catch {}
  };

  const uniqueExamTypes = useMemo(() => {
    return Array.from(new Set(series.map(s => s.examType)));
  }, [series]);

  return (
    <div className="sts-root">
      {/* Hero Header Section */}
      <div className="sts-hero-banner">
        <div className="sts-hero-content">
          <div className="sts-hero-badge">🏛️ UPSC & Groups Examination Hub</div>
          <h1 className="sts-hero-title">Test Series & Multi-Paper Exams</h1>
          <p className="sts-hero-desc">
            Access UPSC Civil Services, State Groups, Optional Subject Tracks, and Daily Mock Series aligned with your course enrollment.
          </p>

          <div className="sts-hero-stats">
            <div className="sts-hero-stat-card">
              <span className="sts-hero-stat-val">{series.length}</span>
              <span className="sts-hero-stat-lbl">Active Series</span>
            </div>
            <div className="sts-hero-stat-card">
              <span className="sts-hero-stat-val">{totalAvailablePapers}</span>
              <span className="sts-hero-stat-lbl">Total Papers</span>
            </div>
            <div className="sts-hero-stat-card">
              <span className="sts-hero-stat-val">{totalAttempted}</span>
              <span className="sts-hero-stat-lbl">Attempted</span>
            </div>
            <div className="sts-hero-stat-card">
              <span className="sts-hero-stat-val">{history.length}</span>
              <span className="sts-hero-stat-lbl">Published Records</span>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="sts-tabs-wrapper">
        <div className="sts-view-tabs">
          <button
            className={`sts-view-tab ${viewTab === "browse" ? "active" : ""}`}
            onClick={() => setViewTab("browse")}
          >
            📚 Browse Test Series ({series.length})
          </button>
          <button
            className={`sts-view-tab ${viewTab === "history" ? "active" : ""}`}
            onClick={() => setViewTab("history")}
          >
            📈 My Attempts & Results ({history.length})
          </button>
        </div>
      </div>

      {viewTab === "browse" && (
        <>
          {/* Filter and Search Bar */}
          <div className="sts-toolbar">
            <div className="sts-search-wrap">
              <input
                className="sts-search"
                placeholder="Search series by title or syllabus…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="sts-search-clear" onClick={() => setSearch("")}>✕</button>
              )}
            </div>

            <div className="sts-pills-row">
              <button
                className={`sts-filter-pill ${!examTypeFilter ? "active" : ""}`}
                onClick={() => setExamTypeFilter("")}
              >
                All Exams ({series.length})
              </button>
              {uniqueExamTypes.map(et => {
                const count = series.filter(s => s.examType === et).length;
                return (
                  <button
                    key={et}
                    className={`sts-filter-pill ${examTypeFilter === et ? "active" : ""}`}
                    onClick={() => setExamTypeFilter(et === examTypeFilter ? "" : et)}
                  >
                    {EXAM_META[et]?.icon || "📋"} {EXAM_META[et]?.label || et} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="sts-loading">
              <div className="sts-spinner" />
              <span>Loading enrolled test series…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sts-empty">
              <div className="sts-empty-icon">📚</div>
              <h3>No test series available</h3>
              <p>
                {search || examTypeFilter
                  ? "No test series match your active search and filter criteria."
                  : "Assigned test series for your enrolled courses will appear here once released by the institute."}
              </p>
              {(search || examTypeFilter) && (
                <button
                  className="sts-btn sts-btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => { setSearch(""); setExamTypeFilter(""); }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedByExam).map(([examType, sCards]) => {
              const meta = EXAM_META[examType] || EXAM_META.other;
              return (
                <div key={examType} className="sts-exam-section">
                  <div className="sts-section-label">
                    <h3>
                      <span>{meta.icon}</span> {meta.label} ({sCards.length})
                    </h3>
                  </div>

                  <div className="sts-grid">
                    {sCards.map(s => {
                      const progress = s.paperCount > 0 ? Math.round((s.attemptedPapers / s.paperCount) * 100) : 0;
                      const hasOpt = s.hasOptionalPapers || (s.availableOptionalSubjects && s.availableOptionalSubjects.length > 0);

                      return (
                        <div
                          key={s.id}
                          className={`sts-series-card ${meta.colorClass}`}
                          onClick={() => setDetailSeries(s)}
                        >
                          <div className="sts-card-top">
                            <div className={`sts-card-exam-icon ${meta.colorClass}`}>
                              {meta.icon}
                            </div>
                            <div className="sts-card-header-info">
                              <p className="sts-card-title">{s.name}</p>
                              {s.description && (
                                <p className="sts-card-desc">{s.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Optional track notice */}
                          {hasOpt && (
                            <div className="sts-card-opt-tag">
                              {s.selectedOptionalSubject ? (
                                <span>🎯 Optional: <strong>{s.selectedOptionalSubject}</strong></span>
                              ) : (
                                <span style={{ color: "#d97706" }}>⚡ Optional Track Selection Required</span>
                              )}
                            </div>
                          )}

                          {/* Progress */}
                          <div className="sts-progress-wrap">
                            <div className="sts-progress-label">
                              <span>{s.attemptedPapers}/{s.paperCount} Papers Attempted</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="sts-progress-bar-bg">
                              <div className="sts-progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          {/* Paper snippet preview */}
                          <div className="sts-card-papers">
                            {s.papers.slice(0, 3).map(p => {
                              const pStatus = p.attemptStatus || "not_started";
                              return (
                                <div key={p.id} className="sts-card-paper-row">
                                  <span className="sts-paper-mini-num">P{p.paperNumber}</span>
                                  <span className="sts-paper-mini-name">{p.paperName}</span>
                                  <span className={`sts-paper-mini-status ${STATUS_META[pStatus]?.colorClass || ""}`}>
                                    {STATUS_META[pStatus]?.label || "Not Started"}
                                  </span>
                                </div>
                              );
                            })}
                            {s.papers.length > 3 && (
                              <div className="sts-card-more-papers">
                                +{s.papers.length - 3} more papers in this series
                              </div>
                            )}
                          </div>

                          <div className="sts-card-footer">
                            <div className="sts-meta-chips">
                              <span className="sts-meta-chip">📄 {s.paperCount} Papers</span>
                              <span className="sts-meta-chip">🎯 {s.totalMarks} Marks</span>
                              {s.validUntil && (
                                <span className="sts-meta-chip">📅 Until {fmtDate(s.validUntil)}</span>
                              )}
                            </div>
                            <button
                              className="sts-btn sts-btn-primary sts-btn-sm"
                              onClick={e => {
                                e.stopPropagation();
                                setDetailSeries(s);
                              }}
                            >
                              Open Series →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {viewTab === "history" && (
        historyLoading ? (
          <div className="sts-loading">
            <div className="sts-spinner" />
            <span>Loading evaluation history…</span>
          </div>
        ) : (
          <HistoryView history={history} />
        )
      )}

      {detailSeries && (
        <SeriesDetailModal
          series={detailSeries}
          userId={userName}
          onClose={() => setDetailSeries(null)}
          onStartMCQ={paper => handleStartMCQ(paper, detailSeries.id)}
          onRefresh={handleDetailRefresh}
          onShowAlert={showAlert}
        />
      )}

      {/* In-Screen Dialog */}
      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default StudentTestSeriesView;
