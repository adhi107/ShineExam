import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm, apiPut, buildUrl, getAuthHeaders } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import ConfirmDialog from "../ConfirmDialog";
import { EditIcon, TrashIcon, PlusIcon, UsersIcon, FileTextIcon, BookOpenIcon, PaperclipIcon, ClockIcon, CalendarIcon, AwardIcon, CheckIcon, CrossIcon, SearchIcon, TagIcon, EyeIcon, DownloadIcon } from "../common/EnterpriseIcons";
import "./AdminTestSeriesDashboard.css";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ExamType =
  | "upsc_prelims" | "upsc_mains" | "upsc_essay"
  | "tspsc_group1" | "tspsc_group2"
  | "appsc_group1" | "appsc_group2"
  | "tnpsc" | "ssc_cgl" | "ssc_chsl"
  | "banking_po" | "banking_clerk"
  | "daily_test" | "mock_test" | "other";

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  upsc_prelims: "UPSC Prelims",
  upsc_mains: "UPSC Mains",
  upsc_essay: "UPSC Essay",
  tspsc_group1: "TSPSC Group-I",
  tspsc_group2: "TSPSC Group-II",
  appsc_group1: "APPSC Group-I",
  appsc_group2: "APPSC Group-II",
  tnpsc: "TNPSC",
  ssc_cgl: "SSC CGL",
  ssc_chsl: "SSC CHSL",
  banking_po: "Banking PO",
  banking_clerk: "Banking Clerk",
  daily_test: "Daily Test",
  mock_test: "Mock Test",
  other: "Other",
};

const COURSE_TYPE_OPTIONS = [
  "UPSC Civil Services",
  "UPSC IFS",
  "TSPSC Group-I",
  "TSPSC Group-II",
  "APPSC Group-I",
  "APPSC Group-II",
  "TNPSC",
  "SSC CGL",
  "SSC CHSL",
  "Banking PO",
  "Banking Clerk",
  "Daily Current Affairs",
];

export type PaperType = "mcq" | "descriptive" | "essay";

export interface SubmissionConfig {
  maxWordCount: number | null;
  maxPageCount: number | null;
  maxFileSizeMb: number;
  allowedFormats: string[];
  instructions: string;
}

export interface QuestionDocument {
  id?: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  url?: string;
}

export interface Paper {
  id: string;
  seriesId: string;
  paperNumber: number;
  paperName: string;
  paperType: PaperType;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  questionCount: number;
  negativeMarkingScheme: string;
  isOptional?: boolean;
  optionalSubject?: string;
  subjectCategory?: string;
  paperStage?: string;
  assignedUserIds?: string[];
  submissionConfig: SubmissionConfig;
  questions: any[];
  questionDocuments?: QuestionDocument[];
  questionFileUrl?: string;
  status: string;
  createdAt?: string;
}

export interface Series {
  id: string;
  name: string;
  description: string;
  examType: ExamType;
  status: "draft" | "active" | "completed";
  availableFrom?: string;
  validUntil?: string;
  courseTypes: string[];
  totalMarks: number;
  passingPercentage: number;
  paperCount: number;
  assignmentCount: number;
  createdAt?: string;
  papers?: Paper[];
}

export interface Submission {
  id: string;
  seriesId: string;
  paperId: string;
  seriesName: string;
  paperName: string;
  userId: string;
  userName: string;
  userEmail: string;
  submittedAt?: string;
  status: "pending" | "evaluated" | "published";
  filename: string;
  originalName: string;
  wordCount?: number;
  pageCount?: number;
  score?: number;
  maxMarks?: number;
  feedback: string;
  improvementSuggestions?: string;
  strengths?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  publishedAt?: string;
}

export interface Student {
  userId: string;
  name: string;
  email: string;
  batch?: string;
  courseStream?: string;
  assignedAt?: string;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  totalScored: number;
  totalMax: number;
  percentage: number;
  rank: number;
  paperScores: Record<string, { score: number | null; maxMarks: number | null; status: string; paperName: string }>;
}

type AdminTab = "series" | "submissions" | "results";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

const fmtTime = (d?: string) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
};

const avatarChar = (name: string) => (name || "?")[0].toUpperCase();

// ─────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const show = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

// ─────────────────────────────────────────────────────────────────
// Series Builder Modal (Create / Edit)
// ─────────────────────────────────────────────────────────────────

const emptySeries = (): Partial<Series> => ({
  name: "", description: "", examType: "upsc_prelims",
  status: "draft", courseTypes: [], passingPercentage: 33,
  availableFrom: new Date().toISOString().slice(0, 10),
  validUntil: "",
});

function SeriesFormModal({ series, onClose, onSaved }: {
  series: Partial<Series> | null;
  onClose: () => void;
  onSaved: (s: Series) => void;
}) {
  const [form, setForm] = useState<Partial<Series>>(series || emptySeries());
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });
  const isEdit = !!series?.id;

  const set = (field: keyof Series, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleCourseType = (ct: string) => {
    setForm(prev => ({
      ...prev,
      courseTypes: prev.courseTypes?.includes(ct)
        ? prev.courseTypes.filter(c => c !== ct)
        : [...(prev.courseTypes || []), ct],
    }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setAlertState({ isOpen: true, title: "Series Name Required", message: "Please provide a name for this test series before saving.", variant: "warning" });
      return;
    }
    if (!form.examType) {
      setAlertState({ isOpen: true, title: "Exam Type Required", message: "Please select an exam type (e.g. UPSC, Groups, Daily Test).", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      let saved: Series;
      if (isEdit) {
        const res = await apiPut<{ series: Series }>(`/admin/test-series/${series!.id}`, form);
        saved = res.series;
      } else {
        const res = await apiPost<{ series: Series }>("/admin/test-series", form);
        saved = res.series;
      }
      onSaved(saved);
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Save Failed", message: e?.message || "Failed to save test series. Please try again.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ats-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ats-modal">
        <div className="ats-modal-header">
          <div className="ats-modal-title-wrap">
            <div className="ats-modal-icon-badge">📋</div>
            <div>
              <h2 className="ats-modal-title">{isEdit ? "Edit Test Series" : "Create New Test Series"}</h2>
              <p className="ats-modal-sub">Configure exam series details, rules, and candidate enrollment gates</p>
            </div>
          </div>
          <button className="ats-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="ats-modal-body">
          <div className="ats-form-grid">
            <div className="ats-field full">
              <label className="ats-label">Series Name <span className="ats-req">*</span></label>
              <input className="ats-input" value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="e.g. UPSC CSE 2026 Mains Mock — Set 1" />
            </div>
            <div className="ats-field full">
              <label className="ats-label">Description</label>
              <textarea className="ats-textarea" value={form.description || ""} onChange={e => set("description", e.target.value)} placeholder="Brief description of this test series..." rows={3} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Exam Type <span className="ats-req">*</span></label>
              <select className="ats-select" value={form.examType || "upsc_prelims"} onChange={e => set("examType", e.target.value as ExamType)}>
                {Object.entries(EXAM_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="ats-field">
              <label className="ats-label">Status</label>
              <select className="ats-select" value={form.status || "draft"} onChange={e => set("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="ats-field">
              <label className="ats-label">Available From</label>
              <input className="ats-input" type="date" value={form.availableFrom?.slice(0, 10) || ""} onChange={e => set("availableFrom", e.target.value)} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Valid Until</label>
              <input className="ats-input" type="date" value={form.validUntil?.slice(0, 10) || ""} onChange={e => set("validUntil", e.target.value)} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Passing Percentage (%)</label>
              <input className="ats-input" type="number" min={0} max={100} value={form.passingPercentage ?? 33} onChange={e => set("passingPercentage", Number(e.target.value))} />
            </div>

            <div className="ats-field full">
              <label className="ats-label">Target Course Types (Enrollment Gate)</label>
              <p className="ats-field-hint">
                Students enrolled in any of these course types will see this series. Leave empty to require manual assignment.
              </p>
              <div className="ats-checkbox-group">
                {COURSE_TYPE_OPTIONS.map(ct => {
                  const isChecked = form.courseTypes?.includes(ct) || false;
                  return (
                    <label key={ct} className={`ats-checkbox-pill ${isChecked ? "checked" : ""}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleCourseType(ct)} />
                      {isChecked && <span className="ats-pill-check">✓</span>}
                      {ct}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="ats-modal-footer">
          <button className="ats-btn ats-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ats-btn ats-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Series"}
          </button>
        </div>
      </div>

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Paper Builder Modal
// ─────────────────────────────────────────────────────────────────

const emptyPaper = (num: number): Partial<Paper> => ({
  paperNumber: num, paperName: "", paperType: "mcq",
  duration: 60, totalMarks: 100, passingMarks: 33,
  negativeMarkingScheme: "none",
  isOptional: false, optionalSubject: "",
  subjectCategory: "General Studies", paperStage: "Mains",
  submissionConfig: {
    maxWordCount: null, maxPageCount: null, maxFileSizeMb: 10,
    allowedFormats: ["pdf", "jpg", "jpeg", "png", "docx"], instructions: "",
  },
});

function PaperFormModal({ seriesId, paper, nextNum, onClose, onSaved }: {
  seriesId: string;
  paper: Partial<Paper> | null;
  nextNum: number;
  onClose: () => void;
  onSaved: (p: Paper) => void;
}) {
  const [form, setForm] = useState<Partial<Paper>>(paper || emptyPaper(nextNum));
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });
  const isEdit = !!paper?.id;

  const set = (field: keyof Paper, value: any) => setForm(prev => ({ ...prev, [field]: value }));
  const setConfig = (field: keyof SubmissionConfig, value: any) =>
    setForm(prev => ({ ...prev, submissionConfig: { ...(prev.submissionConfig || {} as SubmissionConfig), [field]: value } }));

  const isDescriptive = form.paperType === "descriptive" || form.paperType === "essay";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: QuestionDocument = {
          name: file.name,
          size: file.size,
          type: file.type || file.name.split(".").pop() || "unknown",
          dataUrl: reader.result as string,
        };
        setForm(prev => ({
          ...prev,
          questionDocuments: [...(prev.questionDocuments || []), item],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setForm(prev => ({
      ...prev,
      questionDocuments: (prev.questionDocuments || []).filter((_, i) => i !== index),
    }));
  };

  const getDocFormatBadge = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return { label: "PDF", class: "pdf" };
    if (["doc", "docx"].includes(ext)) return { label: "DOCX", class: "docx" };
    if (["xls", "xlsx", "csv"].includes(ext)) return { label: "EXCEL", class: "xlsx" };
    if (["ppt", "pptx"].includes(ext)) return { label: "PPT", class: "pptx" };
    if (["json"].includes(ext)) return { label: "JSON", class: "json" };
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return { label: "IMG", class: "image" };
    if (["txt", "md"].includes(ext)) return { label: "TXT", class: "txt" };
    return { label: ext.toUpperCase() || "DOC", class: "txt" };
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleSave = async () => {
    if (!form.paperName?.trim()) {
      setAlertState({ isOpen: true, title: "Paper Name Required", message: "Please provide a name for this exam paper.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      let saved: Paper;
      if (isEdit) {
        const res = await apiPut<{ paper: Paper }>(`/admin/test-series/${seriesId}/papers/${paper!.id}`, form);
        saved = res.paper;
      } else {
        const res = await apiPost<{ paper: Paper }>(`/admin/test-series/${seriesId}/papers`, form);
        saved = res.paper;
      }
      onSaved(saved);
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Save Failed", message: e?.message || "Failed to save paper. Please try again.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const fmt = form.submissionConfig || {} as SubmissionConfig;

  return (
    <div className="ats-modal-overlay nested" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ats-modal ats-modal-lg">
        <div className="ats-modal-header">
          <div className="ats-modal-title-wrap">
            <div className="ats-modal-icon-badge">📄</div>
            <div>
              <h2 className="ats-modal-title">{isEdit ? "Edit Paper" : `Add Paper ${form.paperNumber}`}</h2>
              <p className="ats-modal-sub">Set up evaluation format, timing, marks, question files, and descriptive constraints</p>
            </div>
          </div>
          <button className="ats-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="ats-modal-body">
          <div className="ats-form-grid">
            <div className="ats-field">
              <label className="ats-label">Paper Number</label>
              <input className="ats-input" type="number" min={1} value={form.paperNumber || 1} onChange={e => set("paperNumber", Number(e.target.value))} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Paper Type <span className="ats-req">*</span></label>
              <select className="ats-select" value={form.paperType || "mcq"} onChange={e => set("paperType", e.target.value as PaperType)}>
                <option value="mcq">MCQ (Auto-graded)</option>
                <option value="descriptive">Descriptive (Manual evaluation)</option>
                <option value="essay">Essay (Manual evaluation)</option>
              </select>
            </div>

            <div className="ats-field full">
              <label className="ats-label">Paper Name <span className="ats-req">*</span></label>
              <input className="ats-input" value={form.paperName || ""} onChange={e => set("paperName", e.target.value)} placeholder="e.g. General Studies Paper-I" />
            </div>

            <div className="ats-field">
              <label className="ats-label">Duration (minutes)</label>
              <input className="ats-input" type="number" min={5} value={form.duration || 60} onChange={e => set("duration", Number(e.target.value))} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Total Marks</label>
              <input className="ats-input" type="number" min={1} value={form.totalMarks || 100} onChange={e => set("totalMarks", Number(e.target.value))} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Passing Marks</label>
              <input className="ats-input" type="number" min={0} value={form.passingMarks || 33} onChange={e => set("passingMarks", Number(e.target.value))} />
            </div>

            <div className="ats-field">
              <label className="ats-label">Paper Stage</label>
              <select className="ats-select" value={form.paperStage || "Mains"} onChange={e => set("paperStage", e.target.value)}>
                <option value="Prelims">Prelims</option>
                <option value="Mains">Mains</option>
                <option value="Essay / Optional">Essay / Optional</option>
                <option value="Daily Practice">Daily Practice</option>
              </select>
            </div>

            <div className="ats-field">
              <label className="ats-label">Subject Category</label>
              <input className="ats-input" value={form.subjectCategory || "General Studies"} onChange={e => set("subjectCategory", e.target.value)} placeholder="e.g. GS-1, Essay, Optional-1" />
            </div>

            {!isDescriptive && (
              <div className="ats-field">
                <label className="ats-label">Negative Marking</label>
                <select className="ats-select" value={form.negativeMarkingScheme || "none"} onChange={e => set("negativeMarkingScheme", e.target.value)}>
                  <option value="none">No Negative Marking</option>
                  <option value="quarter">1/4 (Quarter)</option>
                  <option value="third">1/3</option>
                  <option value="half">1/2</option>
                  <option value="ssc">SSC Pattern</option>
                </select>
              </div>
            )}

            <div className="ats-field full" style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isOptional)}
                  onChange={e => set("isOptional", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#2563eb" }}
                />
                <span>🎯 This is an Optional Subject Paper (e.g. UPSC / State Group Optional Subject Track)</span>
              </label>

              {form.isOptional && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <label className="ats-label" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Optional Subject:</label>
                  <input
                    className="ats-input"
                    value={form.optionalSubject || ""}
                    onChange={e => set("optionalSubject", e.target.value)}
                    placeholder="e.g. Public Administration, Geography, Sociology, PSIR"
                  />
                </div>
              )}
            </div>

            {/* ── Multi-Format Question Paper & Document Upload Section ── */}
            <div className="ats-field full" style={{ marginTop: 8 }}>
              <label className="ats-label">📎 Question Paper & Model Answer Upload (Multiple Formats)</label>
              <div className="ats-dropzone" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.epub,.png,.jpg,.jpeg,.webp"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
                <div className="ats-dropzone-icon">📥</div>
                <strong>Upload Question Documents (PDF, Word DOCX, Excel XLSX, JSON, TXT, Scans)</strong>
                <small>Attach official question booklet, question keys, or model solution files</small>
              </div>

              {form.questionDocuments && form.questionDocuments.length > 0 && (
                <div className="ats-attachment-list">
                  {form.questionDocuments.map((doc, idx) => {
                    const badge = getDocFormatBadge(doc.name);
                    return (
                      <div key={idx} className="ats-attachment-item">
                        <div className="ats-attachment-left">
                          <span className={`ats-fmt-pill ${badge.class}`}>{badge.label}</span>
                          <span className="ats-attachment-title">{doc.name}</span>
                          <small style={{ color: "#64748b" }}>({formatFileSize(doc.size)})</small>
                        </div>
                        <button
                          type="button"
                          className="ats-attachment-remove"
                          onClick={() => removeAttachment(idx)}
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isDescriptive && (
            <div style={{ marginTop: 20 }}>
              <div className="ats-section-divider">
                <h3>Descriptive / Essay Rules & Limits</h3>
              </div>
              <div className="ats-form-grid" style={{ marginTop: 12 }}>
                <div className="ats-field">
                  <label className="ats-label">Max Word Count</label>
                  <input className="ats-input" type="number" min={0} placeholder="Leave blank = no limit"
                    value={fmt.maxWordCount ?? ""} onChange={e => setConfig("maxWordCount", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="ats-field">
                  <label className="ats-label">Max Page Count</label>
                  <input className="ats-input" type="number" min={0} placeholder="Leave blank = no limit"
                    value={fmt.maxPageCount ?? ""} onChange={e => setConfig("maxPageCount", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="ats-field">
                  <label className="ats-label">Max File Size (MB)</label>
                  <input className="ats-input" type="number" min={1} max={100} value={fmt.maxFileSizeMb || 10} onChange={e => setConfig("maxFileSizeMb", Number(e.target.value))} />
                </div>
                <div className="ats-field">
                  <label className="ats-label">Allowed Formats</label>
                  <input className="ats-input" value={(fmt.allowedFormats || []).join(", ")}
                    onChange={e => setConfig("allowedFormats", e.target.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean))}
                    placeholder="pdf, jpg, jpeg, png, docx" />
                </div>
                <div className="ats-field full">
                  <label className="ats-label">Submission Instructions</label>
                  <textarea className="ats-textarea" rows={3} value={fmt.instructions || ""} onChange={e => setConfig("instructions", e.target.value)}
                    placeholder="Instructions for students about how to format and submit their answer sheets..." />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ats-modal-footer">
          <button className="ats-btn ats-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ats-btn ats-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Paper" : "Add Paper"}
          </button>
        </div>
      </div>

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Series Detail Modal (Papers management)
// ─────────────────────────────────────────────────────────────────

function SeriesDetailModal({ series: initialSeries, onClose, onUpdated }: {
  series: Series;
  onClose: () => void;
  onUpdated: (s: Series) => void;
}) {
  const [series, setSeries] = useState<Series>(initialSeries);
  const [papers, setPapers] = useState<Paper[]>(initialSeries.papers || []);
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Assignment
  const [assignedStudents, setAssignedStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<{ id?: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [tab, setTab] = useState<"papers" | "assign">("papers");
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });
  const [confirmDeletePaperId, setConfirmDeletePaperId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ papers: Paper[] }>(`/admin/test-series/${series.id}/papers`)
      .then(r => setPapers(r.papers || [])).catch(() => {});
    apiGet<{ students: Student[] }>(`/admin/test-series/${series.id}/assigned-students`)
      .then(r => setAssignedStudents(r.students || [])).catch(() => {});
    apiGet<{ batches: { id?: string; name: string }[] }>("/admin/users/batches")
      .then(r => setBatches(r.batches || []))
      .catch(() => {});
    apiGet<{ users: any[] }>("/admin/users")
      .then(r => setAllStudents(
        (r.users || []).filter((u: any) => u.role === "answerer" || !u.role || u.role === "student")
          .map((u: any) => ({
            userId: u.userId,
            name: u.name || u.userId,
            email: u.email || "",
            batch: u.batch || u.batchName || "",
            courseStream: u.courseStream || u.course || ""
          }))
      )).catch(() => {});
  }, [series.id]);

  const handlePaperSaved = (p: Paper) => {
    setPapers(prev => {
      const idx = prev.findIndex(pp => pp.id === p.id);
      return idx >= 0 ? prev.map(pp => pp.id === p.id ? p : pp) : [...prev, p];
    });
    setShowPaperForm(false);
    setEditingPaper(null);
    apiGet<{ series: Series }>(`/admin/test-series/${series.id}`).then(r => { setSeries(r.series); onUpdated(r.series); }).catch(() => {});
  };

  const executeDeletePaper = async (paperId: string) => {
    setDeleting(paperId);
    setConfirmDeletePaperId(null);
    try {
      await apiDelete(`/admin/test-series/${series.id}/papers/${paperId}`);
      setPapers(prev => prev.filter(p => p.id !== paperId));
    } catch (err: any) {
      setAlertState({ isOpen: true, title: "Delete Failed", message: err?.message || "Failed to delete paper", variant: "danger" });
    } finally { setDeleting(null); }
  };

  const assignedIds = useMemo(() => new Set(assignedStudents.map(s => s.userId)), [assignedStudents]);
  const filteredStudents = useMemo(() => {
    return allStudents.filter(s =>
      !assignedIds.has(s.userId) &&
      (s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
       s.userId.toLowerCase().includes(studentSearch.toLowerCase()) ||
       (s.batch && s.batch.toLowerCase().includes(studentSearch.toLowerCase())) ||
       (s.courseStream && s.courseStream.toLowerCase().includes(studentSearch.toLowerCase())))
    );
  }, [allStudents, assignedIds, studentSearch]);

  const toggleSelect = (uid: string) =>
    setSelectedIds(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]);

  const toggleBatchSelect = (batchName: string) => {
    const unassignedBatchStudents = allStudents.filter(s => !assignedIds.has(s.userId) && (s.batch === batchName || s.courseStream === batchName));
    const batchStudentIds = unassignedBatchStudents.map(s => s.userId);
    if (!batchStudentIds.length) return;
    const allSelected = batchStudentIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !batchStudentIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...batchStudentIds])));
    }
  };

  const toggleSelectAllFiltered = () => {
    const unassignedFilteredIds = filteredStudents.map(s => s.userId);
    if (!unassignedFilteredIds.length) return;
    const allSelected = unassignedFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unassignedFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...unassignedFilteredIds])));
    }
  };

  const handleAssign = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      await apiPost(`/admin/test-series/${series.id}/assign`, { userIds: selectedIds });
      const r = await apiGet<{ students: Student[] }>(`/admin/test-series/${series.id}/assigned-students`);
      setAssignedStudents(r.students || []);
      setSelectedIds([]);
      setAlertState({ isOpen: true, title: "Students Assigned", message: `Successfully assigned ${selectedIds.length} students to this test series.`, variant: "success" });
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Assignment Failed", message: e?.message || "Failed to assign students.", variant: "danger" });
    } finally { setAssigning(false); }
  };

  const handleUnassign = async (uid: string) => {
    try {
      await apiPost(`/admin/test-series/${series.id}/assign`, { userIds: [] });
      const res = await fetch(buildUrl(`/admin/test-series/${series.id}/assign`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ userIds: [uid] }),
      });
      if (res.ok) setAssignedStudents(prev => prev.filter(s => s.userId !== uid));
    } catch { }
  };

  const [isFullPage, setIsFullPage] = useState(true);

  return (
    <div className={`ats-modal-overlay ${isFullPage ? "fullpage-overlay" : ""}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ats-modal ${isFullPage ? "ats-modal-fullpage" : "ats-modal-xl"}`}>
        <div className="ats-modal-header">
          <div className="ats-modal-title-wrap">
            <div className="ats-modal-icon-badge">📚</div>
            <div>
              <h2 className="ats-modal-title">{series.name}</h2>
              <p className="ats-modal-sub">Manage exam papers, question formats, and student assignments</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="ats-modal-close"
              onClick={() => setIsFullPage(!isFullPage)}
              title={isFullPage ? "Exit Fullscreen" : "Fullscreen"}
              style={{ fontSize: "0.85rem" }}
            >
              {isFullPage ? "🗗" : "🗖"}
            </button>
            <button className="ats-modal-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="ats-tabs" style={{ padding: "0 28px", borderBottom: "1px solid #e2e8f0" }}>
          <button className={`ats-tab ${tab === "papers" ? "active" : ""}`} onClick={() => setTab("papers")}>
            📄 Papers & Exam Pattern
            <span className="ats-tab-badge">{papers.length}</span>
          </button>
          <button className={`ats-tab ${tab === "assign" ? "active" : ""}`} onClick={() => setTab("assign")}>
            👥 Student Assignments
            <span className="ats-tab-badge">{assignedStudents.length}</span>
          </button>
        </div>

        <div className="ats-modal-body">
          {tab === "papers" && (
            <>
              <div className="ats-papers-list">
                {papers.map(p => (
                  <div key={p.id} className="ats-paper-item">
                    <div className="ats-paper-num">P{p.paperNumber}</div>
                    <div className="ats-paper-info">
                      <p className="ats-paper-name">{p.paperName}</p>
                      <div className="ats-paper-sub">
                        <span className={`ats-paper-type-pill ${p.paperType}`}>{p.paperType}</span>
                        <span>⏱️ {p.duration} min</span>
                        <span>🎯 {p.totalMarks} marks</span>
                        {p.paperType === "mcq" && <span>📊 {p.questionCount} Qs</span>}
                        {p.submissionConfig?.maxWordCount && <span>📝 Max {p.submissionConfig.maxWordCount} words</span>}
                        {p.submissionConfig?.maxPageCount && <span>📄 Max {p.submissionConfig.maxPageCount} pages</span>}
                        {p.questionDocuments && p.questionDocuments.length > 0 && (
                          <span style={{ color: "#0284c7", fontWeight: 600 }}>📎 {p.questionDocuments.length} files attached</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={() => { setEditingPaper(p); setShowPaperForm(true); }}>✏️ Edit</button>
                      <button className="ats-btn ats-btn-danger ats-btn-sm" onClick={() => setConfirmDeletePaperId(p.id)} disabled={deleting === p.id}>
                        {deleting === p.id ? "…" : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                ))}
                {papers.length === 0 && (
                  <div className="ats-empty" style={{ padding: "40px" }}>
                    <div className="ats-empty-icon">📄</div>
                    <h3>No papers added yet</h3>
                    <p>Add MCQ, Descriptive, or Essay papers to structure this test series.</p>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 20 }}>
                <button className="ats-btn ats-btn-primary" onClick={() => { setEditingPaper(null); setShowPaperForm(true); }}>
                  + Add New Paper
                </button>
              </div>
            </>
          )}

          {tab === "assign" && (
            <div className="ats-assign-grid">
              <div>
                <h3 className="ats-section-heading">
                  Assigned Candidates ({assignedStudents.length})
                </h3>
                <div className="ats-assign-list">
                  {assignedStudents.map(s => (
                    <div key={s.userId} className="ats-assign-item">
                      <div className="ats-sub-avatar" style={{ width: 34, height: 34, fontSize: "0.8rem" }}>{avatarChar(s.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ats-assign-label">{s.name}</div>
                        <div className="ats-assign-sub">{s.userId} · {s.batch || s.courseStream || "—"}</div>
                      </div>
                      <button className="ats-icon-btn danger" style={{ width: 28, height: 28 }} title="Unassign" onClick={() => handleUnassign(s.userId)}>×</button>
                    </div>
                  ))}
                  {assignedStudents.length === 0 && <div className="ats-assign-empty">No students assigned yet</div>}
                </div>
              </div>
              <div>
                <h3 className="ats-section-heading">
                  Assign More Students
                </h3>

                {/* Batch chips filter/selector */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Quick Batch Selection:</span>
                    {filteredStudents.length > 0 && (
                      <button
                        type="button"
                        className="ats-btn ats-btn-secondary ats-btn-sm"
                        style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={toggleSelectAllFiltered}
                      >
                        {filteredStudents.every(s => selectedIds.includes(s.userId)) ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>
                  <div className="ats-batch-chips">
                    {batches.length > 0 ? (
                      batches.map(b => {
                        const batchName = b.name;
                        const unassignedInBatch = allStudents.filter(s => !assignedIds.has(s.userId) && (s.batch === batchName || s.courseStream === batchName));
                        const isSelected = unassignedInBatch.length > 0 && unassignedInBatch.every(s => selectedIds.includes(s.userId));
                        return (
                          <button
                            key={b.id || batchName}
                            type="button"
                            className={`ats-batch-chip ${isSelected ? "active" : ""}`}
                            onClick={() => toggleBatchSelect(batchName)}
                            title={`Select/Deselect all candidates in ${batchName}`}
                          >
                            🏷️ {batchName} {unassignedInBatch.length > 0 ? `(${unassignedInBatch.length})` : "(0)"}
                          </button>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>No batches registered</span>
                    )}
                  </div>
                </div>

                <input className="ats-input" placeholder="Search by student name, ID, or batch…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={{ marginBottom: 10 }} />
                <div className="ats-assign-list" style={{ maxHeight: 240 }}>
                  {filteredStudents.slice(0, 80).map(s => (
                    <label key={s.userId} className={`ats-assign-item ${selectedIds.includes(s.userId) ? "selected" : ""}`}>
                      <input type="checkbox" checked={selectedIds.includes(s.userId)} onChange={() => toggleSelect(s.userId)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ats-assign-label">{s.name}</div>
                        <div className="ats-assign-sub">{s.userId} · {s.batch || s.courseStream || "—"}</div>
                      </div>
                    </label>
                  ))}
                  {filteredStudents.length === 0 && <div className="ats-assign-empty">No unassigned candidates found</div>}
                </div>
                <button className="ats-btn ats-btn-primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={handleAssign} disabled={!selectedIds.length || assigning}>
                  {assigning ? "Assigning Candidates…" : `Assign Selected Students (${selectedIds.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaperForm && (
        <PaperFormModal
          seriesId={series.id}
          paper={editingPaper}
          nextNum={papers.length + 1}
          onClose={() => { setShowPaperForm(false); setEditingPaper(null); }}
          onSaved={handlePaperSaved}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmDeletePaperId)}
        title="Delete Paper"
        message="Are you sure you want to delete this paper? All student submissions and questions for this paper will be permanently removed."
        confirmText="Yes, Delete Paper"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => confirmDeletePaperId && executeDeletePaper(confirmDeletePaperId)}
        onCancel={() => setConfirmDeletePaperId(null)}
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
}

// ─────────────────────────────────────────────────────────────────
// Evaluation Modal
// ─────────────────────────────────────────────────────────────────

function EvalModal({ submission, onClose, onSaved }: {
  submission: Submission;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  const [score, setScore] = useState<string>(submission.score != null ? String(submission.score) : "");
  const [maxMarks, setMaxMarks] = useState<string>(submission.maxMarks != null ? String(submission.maxMarks) : "100");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [improvementSuggestions, setImprovementSuggestions] = useState(submission.improvementSuggestions || "");
  const [strengths, setStrengths] = useState(submission.strengths || "");
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });

  const handleSave = async () => {
    const sc = parseFloat(score);
    const mm = parseFloat(maxMarks);
    if (isNaN(sc) || sc < 0) {
      setAlertState({ isOpen: true, title: "Invalid Score", message: "Please enter a valid awarded score (0 or greater).", variant: "warning" });
      return;
    }
    if (isNaN(mm) || mm <= 0) {
      setAlertState({ isOpen: true, title: "Invalid Maximum Marks", message: "Please enter valid maximum marks greater than 0.", variant: "warning" });
      return;
    }
    if (sc > mm) {
      setAlertState({ isOpen: true, title: "Score Exceeds Maximum", message: "Awarded score cannot exceed the maximum marks.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{ submission: Submission }>(
        `/admin/test-series/submissions/${submission.id}/evaluate`,
        {
          score: sc,
          maxMarks: mm,
          feedback,
          improvementSuggestions,
          strengths,
          publish,
          evaluatedBy: sessionStorage.getItem("userId") || "admin",
        }
      );
      onSaved(res.submission);
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Evaluation Failed", message: e?.message || "Failed to save evaluation.", variant: "danger" });
    } finally { setSaving(false); }
  };

  const downloadUrl = buildUrl(`/admin/test-series/submissions/${submission.id}/download`);

  return (
    <div className="ats-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ats-modal">
        <div className="ats-modal-header">
          <div className="ats-modal-title-wrap">
            <div className="ats-modal-icon-badge">
              <FileTextIcon size={18} color="#2563eb" />
            </div>
            <div>
              <h2 className="ats-modal-title">Evaluate Candidate Submission</h2>
              <p className="ats-modal-sub">Review uploaded answer sheet, score marks, and provide actionable feedback</p>
            </div>
          </div>
          <button className="ats-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="ats-modal-body">
          <div className="ats-eval-info-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem", marginBottom: 2 }}>{submission.userName}</div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{submission.userId} · {submission.userEmail}</div>
                <div style={{ fontSize: "0.78rem", color: "#4f46e5", fontWeight: 700, marginTop: 4 }}>{submission.seriesName} — {submission.paperName}</div>
                <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>Submitted: {fmtTime(submission.submittedAt)}</div>
              </div>
              <a href={downloadUrl} target="_blank" rel="noreferrer" className="ats-btn ats-btn-primary ats-btn-sm" style={{ textDecoration: "none", flexShrink: 0 }}>
                <DownloadIcon size={14} style={{ marginRight: 5 }} /> Download Sheet
              </a>
            </div>
            {(submission.wordCount || submission.pageCount) && (
              <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: "0.76rem" }}>
                {submission.wordCount && (
                  <span className="ats-eval-tag">
                    <FileTextIcon size={12} style={{ marginRight: 4 }} /> {submission.wordCount} words declared
                  </span>
                )}
                {submission.pageCount && (
                  <span className="ats-eval-tag">
                    <FileTextIcon size={12} style={{ marginRight: 4 }} /> {submission.pageCount} pages declared
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="ats-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16 }}>
            <div className="ats-field">
              <label className="ats-label">Awarded Score <span className="ats-req">*</span></label>
              <input className="ats-input" type="number" min={0} step={0.5} value={score} onChange={e => setScore(e.target.value)} placeholder="0" />
            </div>
            <div className="ats-field">
              <label className="ats-label">Maximum Marks <span className="ats-req">*</span></label>
              <input className="ats-input" type="number" min={1} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} />
            </div>
            <div className="ats-field">
              <label className="ats-label">Percentage</label>
              <input className="ats-input" readOnly value={score && maxMarks && !isNaN(parseFloat(maxMarks)) ? `${((parseFloat(score) / parseFloat(maxMarks)) * 100).toFixed(1)}%` : "—"} style={{ background: "#f8fafc", fontWeight: 700, color: "#4f46e5" }} />
            </div>
          </div>

          <div className="ats-field full" style={{ marginTop: 14 }}>
            <label className="ats-label">💡 Specific Improvement Suggestions & Weakness Areas (Shown to Student)</label>
            <textarea
              className="ats-textarea"
              rows={3}
              value={improvementSuggestions}
              onChange={e => setImprovementSuggestions(e.target.value)}
              placeholder="e.g. Elaborate further on environmental policy aspects; improve diagram cleanliness and paragraph transitions..."
            />
          </div>

          <div className="ats-field full" style={{ marginTop: 12 }}>
            <label className="ats-label">🌟 Key Strengths & Commendations</label>
            <textarea
              className="ats-textarea"
              rows={2}
              value={strengths}
              onChange={e => setStrengths(e.target.value)}
              placeholder="e.g. Excellent structure, strong introduction with accurate constitutional references..."
            />
          </div>

          <div className="ats-field full" style={{ marginTop: 12 }}>
            <label className="ats-label">📝 General Feedback & Evaluation Notes</label>
            <textarea
              className="ats-textarea"
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Overall examiner remarks and feedback..."
            />
          </div>

          <label className="ats-publish-toggle">
            <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
            <span>Publish result immediately to student dashboard</span>
          </label>
        </div>

        <div className="ats-modal-footer">
          <button className="ats-btn ats-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ats-btn ats-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : publish ? "Save & Publish Result" : "Save Evaluation"}
          </button>
        </div>
      </div>

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Submissions View
// ─────────────────────────────────────────────────────────────────

function SubmissionsView() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [evalTarget, setEvalTarget] = useState<Submission | null>(null);
  const [search, setSearch] = useState("");
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ submissions: Submission[] }>(`/admin/test-series/submissions${statusFilter ? `?status=${statusFilter}` : ""}`);
      setSubmissions(res.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      setSubmissions([]);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    submissions.filter(s =>
      s.userName.toLowerCase().includes(search.toLowerCase()) ||
      s.userId.toLowerCase().includes(search.toLowerCase()) ||
      s.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      s.paperName.toLowerCase().includes(search.toLowerCase())
    ), [submissions, search]);

  const handleEvalSaved = (updated: Submission) => {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEvalTarget(null);
  };

  const publishSingle = async (sub: Submission) => {
    try {
      await apiPost(`/admin/test-series/submissions/${sub.id}/publish`, {});
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "published" } : s));
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Publish Failed", message: e?.message || "Failed to publish submission result.", variant: "danger" });
    }
  };

  if (loading) return <div className="ats-loading"><div className="ats-spinner" /> Loading submissions…</div>;

  return (
    <div>
      <div className="ats-toolbar">
        <input className="ats-search" placeholder="Search by name, student ID, series…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="ats-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending Evaluation</option>
          <option value="evaluated">Evaluated</option>
          <option value="published">Published</option>
        </select>
        <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {filtered.length === 0 ? (
        <div className="ats-empty">
          <div className="ats-empty-icon">
            <FileTextIcon size={36} color="#94a3b8" />
          </div>
          <h3>No submissions found</h3>
          <p>Descriptive and essay submissions will appear here once students upload their papers.</p>
        </div>
      ) : (
        <div className="ats-eval-grid">
          {filtered.map(sub => (
            <div key={sub.id} className="ats-eval-card">
              <div className="ats-eval-avatar">{avatarChar(sub.userName)}</div>
              <div className="ats-eval-info">
                <h4>{sub.userName} <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 400 }}>({sub.userId})</span></h4>
                <p>{sub.seriesName} — {sub.paperName}</p>
                <div className="ats-eval-meta">
                  <span className={`ats-eval-status ${sub.status}`}>{sub.status}</span>
                  {sub.score != null && <span style={{ fontWeight: 700, color: "#16a34a" }}>🎯 {sub.score} / {sub.maxMarks}</span>}
                  <span>Submitted: {fmtTime(sub.submittedAt)}</span>
                </div>
              </div>
              <div className="ats-eval-actions">
                <button className="ats-btn ats-btn-primary ats-btn-sm" onClick={() => setEvalTarget(sub)}>
                  <EditIcon size={13} style={{ marginRight: 4 }} />
                  {sub.status === "pending" ? "Evaluate" : "Re-Evaluate"}
                </button>
                {sub.status === "evaluated" && (
                  <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={() => publishSingle(sub)}>
                    <CheckIcon size={13} style={{ marginRight: 4 }} /> Publish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {evalTarget && (
        <EvalModal
          submission={evalTarget}
          onClose={() => setEvalTarget(null)}
          onSaved={handleEvalSaved}
        />
      )}

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Results & Leaderboard View
// ─────────────────────────────────────────────────────────────────

function ResultsView({ seriesList }: { seriesList: Series[] }) {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(seriesList[0]?.id || "");
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });

  const loadLeaderboard = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await apiGet<{ leaderboard: LeaderboardRow[] }>(`/admin/test-series/${sid}/leaderboard`);
      setLeaderboard(res.leaderboard || []);
    } catch { setLeaderboard([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedSeriesId) loadLeaderboard(selectedSeriesId);
  }, [selectedSeriesId, loadLeaderboard]);

  const handlePublishAll = async () => {
    if (!selectedSeriesId) return;
    setPublishing(true);
    try {
      await apiPost(`/admin/test-series/${selectedSeriesId}/publish-all`, {});
      setAlertState({ isOpen: true, title: "Results Published", message: "All evaluated results for this series are now published.", variant: "success" });
      loadLeaderboard(selectedSeriesId);
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Publish Failed", message: e?.message || "Failed to publish all results.", variant: "danger" });
    } finally { setPublishing(false); }
  };

  return (
    <div>
      <div className="ats-toolbar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>Select Series:</label>
          <select className="ats-filter-select" value={selectedSeriesId} onChange={e => setSelectedSeriesId(e.target.value)}>
            {seriesList.map(s => <option key={s.id} value={s.id}>{s.name} ({EXAM_TYPE_LABELS[s.examType]})</option>)}
          </select>
        </div>
        <button className="ats-btn ats-btn-primary ats-btn-sm" onClick={handlePublishAll} disabled={publishing || !selectedSeriesId}>
          <CheckIcon size={14} style={{ marginRight: 4 }} />
          {publishing ? "Publishing All…" : "Publish All Results"}
        </button>
      </div>

      {loading ? (
        <div className="ats-loading"><div className="ats-spinner" /> Loading leaderboard…</div>
      ) : leaderboard.length === 0 ? (
        <div className="ats-empty">
          <div className="ats-empty-icon">
            <AwardIcon size={36} color="#94a3b8" />
          </div>
          <h3>No leaderboard entries</h3>
          <p>Results will appear once submissions are evaluated.</p>
        </div>
      ) : (
        <div className="ats-table-card">
          <table className="ats-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Score</th>
                <th>Total Marks</th>
                <th>Percentage</th>
                <th>Performance Band</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => {
                const rankClass = idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "";
                const band = row.percentage >= 75 ? "Top Tier" : row.percentage >= 50 ? "Satisfactory" : "Needs Attention";
                const bandColor = row.percentage >= 75 ? "#16a34a" : row.percentage >= 50 ? "#0284c7" : "#ea580c";
                return (
                  <tr key={row.userId}>
                    <td>
                      <span className={`ats-rank-badge ${rankClass}`}>{idx + 1}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{row.userId} · {row.email}</div>
                    </td>
                    <td style={{ fontWeight: 800, color: "#0f172a" }}>{row.totalScored}</td>
                    <td>{row.totalMax}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: bandColor }}>{row.percentage.toFixed(1)}%</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: bandColor, background: `${bandColor}15`, padding: "3px 10px", borderRadius: 20 }}>
                        {band}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Component: AdminTestSeriesDashboard
// ─────────────────────────────────────────────────────────────────

export const AdminTestSeriesDashboard: React.FC = () => {
  const [tab, setTab] = useState<"series" | "submissions" | "results">("series");
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [examTypeFilter, setExamTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [detailSeries, setDetailSeries] = useState<Series | null>(null);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<Series | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; variant?: AlertVariant }>({
    isOpen: false, title: "", message: "", variant: "info"
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSeries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (examTypeFilter) params.set("examType", examTypeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await apiGet<{ series: Series[] }>(`/admin/test-series?${params.toString()}`);
      setSeries(res.series || []);
    } catch (err) {
      console.error("Failed to load test series:", err);
      setSeries([]);
    } finally { setLoading(false); }
  }, [examTypeFilter, statusFilter]);

  useEffect(() => { loadSeries(); }, [loadSeries]);

  // Fetch pending submission count for badge
  useEffect(() => {
    apiGet<{ submissions: Submission[] }>("/admin/test-series/submissions?status=pending")
      .then(r => setPendingCount((r.submissions || []).length)).catch(() => {});
  }, []);

  const filtered = useMemo(() =>
    series.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [series, search]);

  const handleSeriesSaved = (s: Series) => {
    setSeries(prev => {
      const idx = prev.findIndex(p => p.id === s.id);
      return idx >= 0 ? prev.map(p => p.id === s.id ? s : p) : [s, ...prev];
    });
    setShowSeriesForm(false);
    setEditingSeries(null);
    showToast(s.name + " saved successfully!");
  };

  const executeDeleteSeries = async (s: Series) => {
    setConfirmDeleteSeries(null);
    try {
      await apiDelete(`/admin/test-series/${s.id}`);
      setSeries(prev => prev.filter(p => p.id !== s.id));
      showToast("Series deleted", "error");
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Delete Failed", message: e?.message || "Failed to delete test series.", variant: "danger" });
    }
  };

  const openDetail = async (s: Series) => {
    try {
      const res = await apiGet<{ series: Series }>(`/admin/test-series/${s.id}`);
      setDetailSeries(res.series);
    } catch { setDetailSeries(s); }
  };

  return (
    <div className="ats-root">
      <div className="ats-header">
        <div className="ats-header-left">
          <h1>Test Series</h1>
          <p>Manage UPSC, Groups & Daily Test series — papers, evaluations, results</p>
        </div>
        <div className="ats-header-actions">
          <button className="ats-btn ats-btn-primary" onClick={() => { setEditingSeries(null); setShowSeriesForm(true); }}>
            <PlusIcon size={16} style={{ marginRight: 6 }} /> New Series
          </button>
        </div>
      </div>

      <div className="ats-tabs">
        <button className={`ats-tab ${tab === "series" ? "active" : ""}`} onClick={() => setTab("series")}>
          <BookOpenIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          All Series <span className="ats-tab-badge">{series.length}</span>
        </button>
        <button className={`ats-tab ${tab === "submissions" ? "active" : ""}`} onClick={() => setTab("submissions")}>
          <FileTextIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          Evaluation Queue
          {pendingCount > 0 && <span className="ats-tab-badge" style={{ background: "rgba(245,158,11,0.25)", color: "#fbbf24" }}>{pendingCount}</span>}
        </button>
        <button className={`ats-tab ${tab === "results" ? "active" : ""}`} onClick={() => setTab("results")}>
          <AwardIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          Results
        </button>
      </div>

      <div className="ats-content">
        {tab === "series" && (
          <>
            <div className="ats-toolbar">
              <input className="ats-search" placeholder="Search series…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="ats-filter-select" value={examTypeFilter} onChange={e => setExamTypeFilter(e.target.value)}>
                <option value="">All Exam Types</option>
                {Object.entries(EXAM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="ats-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={loadSeries}>↻</button>
            </div>

            {loading ? (
              <div className="ats-loading"><div className="ats-spinner" /> Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="ats-empty">
                <div className="ats-empty-icon">
                  <BookOpenIcon size={36} color="#94a3b8" />
                </div>
                <h3>No series found</h3>
                <p>Create your first test series to get started.</p>
                <button className="ats-btn ats-btn-primary" style={{ marginTop: 16 }} onClick={() => setShowSeriesForm(true)}>
                  <PlusIcon size={16} style={{ marginRight: 6 }} /> Create Test Series
                </button>
              </div>
            ) : (
              <div className="ats-grid">
                {filtered.map(s => (
                  <div key={s.id} className="ats-card">
                    <div className="ats-card-header">
                      <div>
                        <p className="ats-card-title">{s.name}</p>
                        <p className="ats-card-desc">{s.description || "No description"}</p>
                      </div>
                      <div className="ats-card-actions-menu">
                        <button className="ats-icon-btn" title="Edit" onClick={() => { setEditingSeries(s); setShowSeriesForm(true); }}>
                          <EditIcon size={14} />
                        </button>
                        <button className="ats-icon-btn danger" title="Delete" onClick={() => setConfirmDeleteSeries(s)}>
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="ats-card-meta">
                      <span className="ats-badge ats-badge-type">{EXAM_TYPE_LABELS[s.examType] || s.examType}</span>
                      <span className={`ats-badge ats-badge-status-${s.status}`}>{s.status}</span>
                    </div>

                    <div className="ats-card-stats">
                      <div className="ats-stat">
                        <span className="ats-stat-value">{s.paperCount}</span>
                        <span className="ats-stat-label">Papers</span>
                      </div>
                      <div className="ats-stat">
                        <span className="ats-stat-value">{s.totalMarks}</span>
                        <span className="ats-stat-label">Total Marks</span>
                      </div>
                      <div className="ats-stat">
                        <span className="ats-stat-value">{s.assignmentCount}</span>
                        <span className="ats-stat-label">Students</span>
                      </div>
                    </div>

                    {s.availableFrom && (
                      <div style={{ fontSize: "0.72rem", color: "#475569", marginBottom: 14 }}>
                        📅 {fmtDate(s.availableFrom)} {s.validUntil ? `→ ${fmtDate(s.validUntil)}` : ""}
                      </div>
                    )}

                    <div className="ats-card-footer">
                      <button className="ats-btn ats-btn-primary ats-btn-sm" onClick={() => openDetail(s)}>
                        Manage Papers & Students
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "submissions" && <SubmissionsView />}
        {tab === "results" && <ResultsView seriesList={series} />}
      </div>

      {showSeriesForm && (
        <SeriesFormModal
          series={editingSeries}
          onClose={() => { setShowSeriesForm(false); setEditingSeries(null); }}
          onSaved={handleSeriesSaved}
        />
      )}

      {detailSeries && (
        <SeriesDetailModal
          series={detailSeries}
          onClose={() => setDetailSeries(null)}
          onUpdated={updated => setSeries(prev => prev.map(s => s.id === updated.id ? updated : s))}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteSeries)}
        title="Delete Test Series"
        message={`Are you sure you want to delete "${confirmDeleteSeries?.name}" and all its associated exam papers? This action is permanent and cannot be undone.`}
        confirmText="Yes, Delete Series"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => confirmDeleteSeries && executeDeleteSeries(confirmDeleteSeries)}
        onCancel={() => setConfirmDeleteSeries(null)}
      />

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />

      {toast && <div className={`ats-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
};

export default AdminTestSeriesDashboard;
