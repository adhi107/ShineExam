import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import ConfirmDialog from "../ConfirmDialog";
import { EditIcon, TrashIcon, PlusIcon, TagIcon, AwardIcon, CheckIcon, BookOpenIcon, SearchIcon, CrossIcon } from "../common/EnterpriseIcons";
import "./QuestionBankDashboard.css";

export type QuestionType =
  | "single_mcq"
  | "multi_mcq"
  | "assertion_reason"
  | "match_following"
  | "statement_based"
  | "comprehension"
  | "map_based"
  | "numerical"
  | "descriptive_10m"
  | "descriptive_15m"
  | "descriptive_20m"
  | "essay";

export interface QuestionItem {
  id: string;
  questionText: string;
  questionType: QuestionType;
  subject: string;
  topic: string;
  subtopic?: string;
  examType: string;
  stage: string;
  paper: string;
  difficulty: "easy" | "medium" | "hard" | "advanced";
  positiveMarks: number;
  negativeMarks: number;
  options?: string[];
  correctOption?: any;
  explanation?: string;
  sourceReference?: string;
  isPYQ?: boolean;
  pyqYear?: number;
  pyqExam?: string;
  isCurrentAffairs?: boolean;
  status: "draft" | "review" | "approved" | "published" | "archived";
  version: number;
  createdAt: string;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_mcq: "Single Choice MCQ",
  multi_mcq: "Multiple Choice MCQ",
  assertion_reason: "Assertion & Reason",
  match_following: "Match the Following",
  statement_based: "Statement-Based (1/2/3)",
  comprehension: "Comprehension / Passage",
  map_based: "Map & Image-Based",
  numerical: "Numerical / CSAT",
  descriptive_10m: "10-Marker Descriptive (150 words)",
  descriptive_15m: "15-Marker Descriptive (250 words)",
  descriptive_20m: "20-Marker Case Study",
  essay: "Full Essay Question",
};

const SUBJECT_OPTIONS = [
  "Indian Polity & Governance",
  "Indian Economy & Development",
  "History & National Movement",
  "Geography & Environment",
  "Science, Tech & Ecology",
  "General Essay & Ethics",
  "Public Administration (Optional)",
  "Geography (Optional)",
  "Political Science & IR (Optional)",
  "Sociology (Optional)",
  "History (Optional)",
  "Telangana History & Movement",
  "Andhra Pradesh History & Economy",
  "CSAT / Quantitative Aptitude",
];

const emptyQuestion = (): Partial<QuestionItem> => ({
  questionText: "",
  questionType: "single_mcq",
  subject: "Indian Polity & Governance",
  topic: "Fundamental Rights",
  subtopic: "",
  examType: "upsc_prelims",
  stage: "Prelims",
  paper: "General Studies Paper-I",
  difficulty: "medium",
  positiveMarks: 2.0,
  negativeMarks: 0.66,
  options: ["Option A", "Option B", "Option C", "Option D"],
  correctOption: 0,
  explanation: "",
  sourceReference: "NCERT / Official Previous Year Papers",
  isPYQ: false,
  pyqYear: 2024,
  pyqExam: "UPSC Civil Services",
  isCurrentAffairs: false,
  status: "approved",
});

const QuestionBankDashboard: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterPYQ, setFilterPYQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuestionItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: AlertVariant;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (search) params.set("search", search);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterType) params.set("questionType", filterType);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterPYQ) params.set("isPYQ", filterPYQ);

      const res = await apiGet<{ questions: QuestionItem[]; total: number }>(`/admin/question-bank?${params}`);
      setQuestions(res.questions || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterSubject, filterType, filterDifficulty, filterPYQ]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleSaveQuestion = async () => {
    if (!editingQuestion?.questionText?.trim()) {
      setAlertState({ isOpen: true, title: "Question Text Required", message: "Please provide question text.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      if (editingQuestion.id) {
        await apiPut(`/admin/question-bank/${editingQuestion.id}`, editingQuestion);
        setAlertState({ isOpen: true, title: "Question Updated", message: "Question successfully updated in repository.", variant: "success" });
      } else {
        await apiPost(`/admin/question-bank`, editingQuestion);
        setAlertState({ isOpen: true, title: "Question Created", message: "New question added to enterprise Question Bank.", variant: "success" });
      }
      setModalOpen(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Save Failed", message: e?.message || "Failed to save question.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/admin/question-bank/${id}`);
      setDeleteTargetId(null);
      loadQuestions();
      setAlertState({ isOpen: true, title: "Question Deleted", message: "Question removed from Question Bank.", variant: "info" });
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Delete Failed", message: e?.message || "Could not delete question.", variant: "danger" });
    }
  };

  return (
    <div className="qb-root">
      {/* Header Banner */}
      <div className="qb-header">
        <div>
          <div className="qb-header-badge">
            <BookOpenIcon size={13} color="#1d4ed8" /> Enterprise Assessment Engine
          </div>
          <h1 className="qb-title">Question Bank & Items Repository</h1>
          <p className="qb-sub">
            Multi-type, multilingual question database with topic tagging, PYQ archives, and review workflows.
          </p>
        </div>
        <button
          className="qb-btn qb-btn-primary"
          onClick={() => {
            setEditingQuestion(emptyQuestion());
            setModalOpen(true);
          }}
        >
          <PlusIcon size={16} /> Add New Question
        </button>
      </div>

      {/* Filter Bar */}
      <div className="qb-toolbar">
        <div className="qb-search-wrap">
          <input
            className="qb-search"
            placeholder="Search questions by text, concepts, or tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="qb-clear-btn" onClick={() => setSearch("")}>✕</button>}
        </div>

        <select className="qb-select" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="qb-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Question Types</option>
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className="qb-select" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="advanced">Advanced</option>
        </select>

        <select className="qb-select" value={filterPYQ} onChange={e => setFilterPYQ(e.target.value)}>
          <option value="">PYQ & Practice</option>
          <option value="true">PYQs Only</option>
          <option value="false">Practice Items Only</option>
        </select>
      </div>

      {/* Questions List */}
      <div className="qb-body">
        {loading ? (
          <div className="qb-loading">
            <div className="qb-spinner" /> Loading Question Bank items…
          </div>
        ) : questions.length === 0 ? (
          <div className="qb-empty">
            <div className="qb-empty-icon"><BookOpenIcon size={36} color="#94a3b8" /></div>
            <h3>No questions found</h3>
            <p>Add your first question or adjust filter parameters.</p>
          </div>
        ) : (
          <div className="qb-list">
            {questions.map((q, idx) => (
              <div key={q.id} className="qb-card">
                <div className="qb-card-header">
                  <div className="qb-card-chips">
                    <span className="qb-chip qb-chip-num">#{(page - 1) * 30 + idx + 1}</span>
                    <span className={`qb-chip qb-chip-type ${q.questionType}`}>
                      {QUESTION_TYPE_LABELS[q.questionType] || q.questionType}
                    </span>
                    <span className="qb-chip qb-chip-subj">{q.subject}</span>
                    <span className="qb-chip qb-chip-topic">
                      <TagIcon size={12} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                      {q.topic}
                    </span>
                    {q.isPYQ && (
                      <span className="qb-chip qb-chip-pyq">
                        <AwardIcon size={12} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                        PYQ {q.pyqYear} ({q.pyqExam})
                      </span>
                    )}
                    <span className={`qb-chip qb-chip-diff ${q.difficulty}`}>{q.difficulty}</span>
                    <span className="qb-chip qb-chip-marks">+{q.positiveMarks} / -{q.negativeMarks}</span>
                  </div>

                  <div className="qb-card-actions">
                    <button
                      className="qb-btn qb-btn-secondary qb-btn-sm"
                      onClick={() => { setEditingQuestion(q); setModalOpen(true); }}
                    >
                      <EditIcon size={13} style={{ marginRight: 5 }} /> Edit
                    </button>
                    <button
                      className="qb-btn qb-btn-danger qb-btn-sm"
                      onClick={() => setDeleteTargetId(q.id)}
                    >
                      <TrashIcon size={13} style={{ marginRight: 5 }} /> Delete
                    </button>
                  </div>
                </div>

                <div className="qb-card-text">
                  <p>{q.questionText}</p>
                </div>

                {q.options && q.options.length > 0 && (
                  <div className="qb-card-options">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`qb-card-opt-row ${q.correctOption === oIdx ? "correct" : ""}`}
                      >
                        <span className="qb-opt-letter">{String.fromCharCode(65 + oIdx)}</span>
                        <span className="qb-opt-text">{opt}</span>
                        {q.correctOption === oIdx && (
                          <span className="qb-opt-badge">
                            <CheckIcon size={12} style={{ marginRight: 3, verticalAlign: "-1px" }} /> Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {q.explanation && (
                  <div className="qb-card-exp">
                    <strong>Explanation & Analysis:</strong>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question Form Modal */}
      {modalOpen && editingQuestion && (
        <div className="qb-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="qb-modal">
            <div className="qb-modal-header">
              <h3>{editingQuestion.id ? "Edit Question" : "Create New Question"}</h3>
              <button className="qb-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="qb-modal-body">
              <div className="qb-form-grid">
                <div className="qb-field">
                  <label>Subject *</label>
                  <select
                    className="qb-input"
                    value={editingQuestion.subject || ""}
                    onChange={e => setEditingQuestion(p => ({ ...p, subject: e.target.value }))}
                  >
                    {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="qb-field">
                  <label>Topic *</label>
                  <input
                    className="qb-input"
                    value={editingQuestion.topic || ""}
                    onChange={e => setEditingQuestion(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. Fundamental Rights, Monsoons, Fiscal Policy"
                  />
                </div>

                <div className="qb-field">
                  <label>Question Type *</label>
                  <select
                    className="qb-input"
                    value={editingQuestion.questionType || "single_mcq"}
                    onChange={e => setEditingQuestion(p => ({ ...p, questionType: e.target.value as QuestionType }))}
                  >
                    {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="qb-field">
                  <label>Difficulty</label>
                  <select
                    className="qb-input"
                    value={editingQuestion.difficulty || "medium"}
                    onChange={e => setEditingQuestion(p => ({ ...p, difficulty: e.target.value as any }))}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="qb-field full">
                  <label>Question Text *</label>
                  <textarea
                    className="qb-textarea"
                    rows={4}
                    value={editingQuestion.questionText || ""}
                    onChange={e => setEditingQuestion(p => ({ ...p, questionText: e.target.value }))}
                    placeholder="Enter question statement, assertions, or descriptive prompt..."
                  />
                </div>

                {editingQuestion.questionType?.includes("mcq") || editingQuestion.questionType === "statement_based" || editingQuestion.questionType === "assertion_reason" ? (
                  <div className="qb-field full">
                    <label>Options & Correct Answer</label>
                    <div className="qb-opts-editor">
                      {(editingQuestion.options || ["", "", "", ""]).map((opt, oIdx) => (
                        <div key={oIdx} className="qb-opt-edit-row">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={editingQuestion.correctOption === oIdx}
                            onChange={() => setEditingQuestion(p => ({ ...p, correctOption: oIdx }))}
                            style={{ width: 18, height: 18, accentColor: "#2563eb" }}
                          />
                          <input
                            className="qb-input"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...(editingQuestion.options || [])];
                              newOpts[oIdx] = e.target.value;
                              setEditingQuestion(p => ({ ...p, options: newOpts }));
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="qb-field full">
                  <label>Detailed Explanation / Model Answer Reference</label>
                  <textarea
                    className="qb-textarea"
                    rows={3}
                    value={editingQuestion.explanation || ""}
                    onChange={e => setEditingQuestion(p => ({ ...p, explanation: e.target.value }))}
                    placeholder="Provide reasoning, background facts, and references..."
                  />
                </div>

                <div className="qb-field">
                  <label>Positive Marks</label>
                  <input
                    className="qb-input"
                    type="number"
                    step="0.25"
                    value={editingQuestion.positiveMarks || 2.0}
                    onChange={e => setEditingQuestion(p => ({ ...p, positiveMarks: Number(e.target.value) }))}
                  />
                </div>

                <div className="qb-field">
                  <label>Negative Penalty</label>
                  <input
                    className="qb-input"
                    type="number"
                    step="0.01"
                    value={editingQuestion.negativeMarks || 0.66}
                    onChange={e => setEditingQuestion(p => ({ ...p, negativeMarks: Number(e.target.value) }))}
                  />
                </div>

                <div className="qb-field full" style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editingQuestion.isPYQ)}
                      onChange={e => setEditingQuestion(p => ({ ...p, isPYQ: e.target.checked }))}
                    />
                    <span>📜 This is an Official Previous Year Question (PYQ)</span>
                  </label>

                  {editingQuestion.isPYQ && (
                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                      <input
                        className="qb-input"
                        type="number"
                        placeholder="Year (e.g. 2024)"
                        value={editingQuestion.pyqYear || 2024}
                        onChange={e => setEditingQuestion(p => ({ ...p, pyqYear: Number(e.target.value) }))}
                      />
                      <input
                        className="qb-input"
                        placeholder="Exam Name (e.g. UPSC CSE / TSPSC Group-1)"
                        value={editingQuestion.pyqExam || ""}
                        onChange={e => setEditingQuestion(p => ({ ...p, pyqExam: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="qb-modal-footer">
              <button className="qb-btn qb-btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="qb-btn qb-btn-primary" onClick={handleSaveQuestion} disabled={saving}>
                {saving ? "Saving…" : "Save Question to Bank"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        title="Delete Question"
        message="Are you sure you want to delete this question? It will be removed from the Question Bank."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />

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

export default QuestionBankDashboard;
