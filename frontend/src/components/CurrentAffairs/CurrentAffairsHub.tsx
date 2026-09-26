import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPostForm, apiPut, apiDelete, getMediaUrl } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import {
  BookmarkIcon,
  PaperclipIcon,
  TagIcon,
  BookOpenIcon,
  PlusIcon,
  FileTextIcon,
  DownloadIcon,
  SearchIcon,
  CheckIcon,
  TrashIcon,
  EditIcon,
  UploadIcon,
  UsersIcon
} from "../common/EnterpriseIcons";
import "./CurrentAffairsHub.css";

export interface AttachmentItem {
  id?: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  url?: string;
}

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
}

export interface CurrentAffairItem {
  id: string;
  title: string;
  shortSummary: string;
  detailedExplanation?: string;
  keyPoints?: string[];
  importantFacts?: string[];
  publishDate: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  isHighlyImportant?: boolean;
  examRelevance?: string[];
  applicableExams?: string[];
  relatedSyllabusTopics?: string[];
  targetAudience?: "all" | "batches" | "exams" | "students";
  assignedBatches?: string[];
  assignedStudentIds?: string[];
  attachments?: AttachmentItem[];
  pdfUrl?: string;
  mcqPracticeQuestions?: MCQQuestion[];
  source?: {
    name: string;
    url: string;
  };
  viewsCount?: number;
  bookmarksCount?: number;
  status: string;
}

export interface CAQuiz {
  id: string;
  title: string;
  quizDate: string;
  duration: number;
  totalMarks: number;
  negativeMarking: number;
  questionsCount: number;
  questions: MCQQuestion[];
  applicableExams?: string[];
  status?: string;
}

export interface QuizAttemptReview {
  questionIndex: number;
  question: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  status: "correct" | "incorrect" | "unattempted";
  explanation?: string;
}

export interface CAQuizAttempt {
  id?: string;
  quizId: string;
  quizTitle: string;
  quizDate: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  scoredMarks: number;
  maxMarks: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: Record<string, string>;
  review: QuizAttemptReview[];
  submittedAt: string;
}

interface BatchOption {
  name: string;
  studentCount?: number;
}

interface StudentOption {
  userId: string;
  name?: string;
  batch?: string;
}

const CATEGORIES = [
  "All",
  "National",
  "International",
  "Polity & Governance",
  "Economy",
  "Environment & Ecology",
  "Science & Technology",
  "Defence",
  "Space",
  "Geography",
  "History & Culture",
  "Social Issues",
  "Government Schemes",
  "Reports & Indices",
  "Andhra Pradesh",
  "Telangana"
];

const EXAM_OPTIONS = ["UPSC", "APPSC", "TSPSC", "SSC", "Banking", "State PSC"];

interface Props {
  isAdmin?: boolean;
  userName?: string;
}

export const CurrentAffairsHub: React.FC<Props> = ({ isAdmin = false, userName = "student" }) => {
  const [articles, setArticles] = useState<CurrentAffairItem[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<"articles" | "reader" | "bookmarks" | "quiz" | "revision">("articles");
  const [activeArticle, setActiveArticle] = useState<CurrentAffairItem | null>(null);

  // Student tools
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savedNotes, setSavedNotes] = useState<any[]>([]);

  // Document PDF Previewer Modal & Local Blob State
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const [docBlobUrl, setDocBlobUrl] = useState<string | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState<boolean>(false);

  useEffect(() => {
    if (!previewDoc?.url) {
      if (docBlobUrl) {
        URL.revokeObjectURL(docBlobUrl);
      }
      setDocBlobUrl(null);
      setIsLoadingBlob(false);
      return;
    }

    let active = true;
    setIsLoadingBlob(true);

    fetch(previewDoc.url)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const blobUrl = URL.createObjectURL(blob);
        setDocBlobUrl(blobUrl);
        setIsLoadingBlob(false);
      })
      .catch((err) => {
        console.warn("Blob conversion fallback:", err);
        if (active) {
          setIsLoadingBlob(false);
        }
      });

    return () => {
      active = false;
    };
  }, [previewDoc?.url]);

  // Admin authoring state
  const [createModal, setCreateModal] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoExtractInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Quiz state
  const [quizzes, setQuizzes] = useState<CAQuiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<CAQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizTimer, setQuizTimer] = useState(0);
  const [quizResult, setQuizResult] = useState<CAQuizAttempt | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [userAttempts, setUserAttempts] = useState<CAQuizAttempt[]>([]);
  const [createQuizModal, setCreateQuizModal] = useState(false);
  const [quizForm, setQuizForm] = useState<{
    title: string;
    quizDate: string;
    duration: number;
    applicableExams: string[];
    questions: MCQQuestion[];
  }>({
    title: "",
    quizDate: new Date().toISOString().slice(0, 10),
    duration: 20,
    applicableExams: ["UPSC", "APPSC", "TSPSC"],
    questions: []
  });

  const [articleForm, setArticleForm] = useState<{
    title: string;
    category: string;
    shortSummary: string;
    detailedExplanation: string;
    keyPoints: string[];
    importantFacts: string[];
    priority: "High" | "Medium" | "Low";
    isHighlyImportant: boolean;
    sourceName: string;
    sourceUrl: string;
    examRelevance: string[];
    applicableExams: string[];
    targetAudience: "all" | "batches" | "exams" | "students";
    assignedBatches: string[];
    assignedStudentIds: string[];
    attachments: AttachmentItem[];
    mcqPracticeQuestions: MCQQuestion[];
  }>({
    title: "",
    category: "Polity & Governance",
    shortSummary: "",
    detailedExplanation: "",
    keyPoints: [],
    importantFacts: [],
    priority: "High",
    isHighlyImportant: true,
    sourceName: "The Hindu / PIB",
    sourceUrl: "",
    examRelevance: ["Prelims", "Mains"],
    applicableExams: ["UPSC", "APPSC", "TSPSC"],
    targetAudience: "all",
    assignedBatches: [],
    assignedStudentIds: [],
    attachments: [],
    mcqPracticeQuestions: []
  });

  const [adminStats, setAdminStats] = useState<any>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: AlertVariant;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (search) params.set("search", search);
      const res = await apiGet<{ articles: CurrentAffairItem[]; categories: string[] }>(
        `/admin/current-affairs/articles?${params}`
      );
      setArticles(res.articles || []);
      if (res.categories && res.categories.length) {
        setCategories(["All", ...res.categories]);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  const loadAdminStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiGet<any>("/admin/current-affairs/admin/dashboard");
      setAdminStats(res.metrics || null);
    } catch {}
  }, [isAdmin]);

  const loadBatchesAndUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [batchRes, userRes] = await Promise.all([
        apiGet<{ batches: BatchOption[] }>("/admin/users/batches").catch(() => ({ batches: [] })),
        apiGet<{ users: StudentOption[] }>("/admin/users").catch(() => ({ users: [] }))
      ]);
      setBatches(
        batchRes.batches || [
          { name: "Batch-A" },
          { name: "UPSC 2026 Prelims" },
          { name: "Mains Enrichment Track" },
          { name: "APPSC Group-1 Morning" },
          { name: "TSPSC Weekend Batch" }
        ]
      );
      setStudents(userRes.users || []);
    } catch {}
  }, [isAdmin]);

  const loadBookmarks = useCallback(async () => {
    try {
      const res = await apiGet<{ bookmarks: any[] }>(
        `/answerer/current-affairs/bookmarks?userId=${encodeURIComponent(userName)}`
      );
      const bSet = new Set<string>((res.bookmarks || []).map((b) => b.articleId));
      setBookmarkedIds(bSet);
    } catch {}
  }, [userName]);

  const loadQuizzes = useCallback(async () => {
    try {
      const res = await apiGet<{ quizzes: CAQuiz[] }>("/admin/current-affairs/quizzes");
      setQuizzes(res.quizzes || []);
    } catch {
      setQuizzes([]);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const res = await apiGet<{ notes: any[] }>(
        `/answerer/current-affairs/notes?userId=${encodeURIComponent(userName)}`
      );
      setSavedNotes(res.notes || []);
    } catch {}
  }, [userName]);

  const loadUserAttempts = useCallback(async () => {
    try {
      const res = await apiGet<{ attempts: CAQuizAttempt[] }>(
        `/answerer/current-affairs/quizzes/attempts?userId=${encodeURIComponent(userName)}`
      );
      setUserAttempts(res.attempts || []);
    } catch {}
  }, [userName]);

  useEffect(() => {
    loadArticles();
    if (isAdmin) {
      loadAdminStats();
      loadBatchesAndUsers();
    }
    loadBookmarks();
    loadQuizzes();
    loadNotes();
    loadUserAttempts();
  }, [loadArticles, loadAdminStats, loadBatchesAndUsers, loadBookmarks, loadQuizzes, loadNotes, loadUserAttempts, isAdmin]);

  // Quiz Timer interval
  useEffect(() => {
    let interval: any = null;
    if (activeQuiz && !quizResult && quizTimer > 0) {
      interval = setInterval(() => {
        setQuizTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeQuiz, quizResult, quizTimer]);

  const handleToggleBookmark = async (art: CurrentAffairItem) => {
    try {
      const res = await apiPost<{ isBookmarked: boolean }>("/answerer/current-affairs/bookmarks", {
        userId: userName,
        articleId: art.id
      });
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (res.isBookmarked) next.add(art.id);
        else next.delete(art.id);
        return next;
      });
      setAlertState({
        isOpen: true,
        title: res.isBookmarked ? "Article Bookmarked" : "Bookmark Removed",
        message: res.isBookmarked
          ? "Article added to your personal Current Affairs revision list."
          : "Bookmark removed.",
        variant: "info"
      });
    } catch {}
  };

  const handleSaveNote = async () => {
    if (!activeArticle || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await apiPost("/answerer/current-affairs/notes", {
        userId: userName,
        articleId: activeArticle.id,
        noteText: noteText.trim()
      });
      setAlertState({
        isOpen: true,
        title: "Note Saved",
        message: "Your private study note has been securely saved.",
        variant: "success"
      });
      loadNotes();
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: "Note Error",
        message: err?.message || "Could not save study note.",
        variant: "danger"
      });
    } finally {
      setSavingNote(false);
    }
  };

  // Multiple format file upload handler with direct server upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await apiPostForm<{ attachment: AttachmentItem }>(
          "/admin/current-affairs/upload-attachment",
          formData
        );
        if (res?.attachment) {
          setArticleForm((p) => ({
            ...p,
            attachments: [...p.attachments, res.attachment]
          }));
        }
      } catch (uploadErr) {
        if (file.size < 500 * 1024) {
          const reader = new FileReader();
          reader.onload = () => {
            const item: AttachmentItem = {
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              dataUrl: reader.result as string
            };
            setArticleForm((p) => ({
              ...p,
              attachments: [...p.attachments, item]
            }));
          };
          reader.readAsDataURL(file);
        } else {
          setAlertState({
            isOpen: true,
            title: "File Upload Notice",
            message: `Could not upload "${file.name}" to server (${Math.round(file.size / 1024)} KB).`,
            variant: "warning"
          });
        }
      }
    }
    setIsUploadingAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ⚡ AUTO-EXTRACT from PDF or Document
  const handleAutoExtractDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiPostForm<{
        message: string;
        data: {
          title: string;
          category: string;
          shortSummary: string;
          detailedExplanation: string;
          keyPoints: string[];
          importantFacts: string[];
          questions: MCQQuestion[];
          attachment?: AttachmentItem;
        };
      }>("/admin/current-affairs/parse-document", formData);

      if (res?.data) {
        const d = res.data;
        setArticleForm((p) => ({
          ...p,
          title: d.title || p.title,
          category: d.category || p.category,
          shortSummary: d.shortSummary || p.shortSummary,
          detailedExplanation: d.detailedExplanation || p.detailedExplanation,
          keyPoints: d.keyPoints && d.keyPoints.length ? d.keyPoints : p.keyPoints,
          importantFacts: d.importantFacts && d.importantFacts.length ? d.importantFacts : p.importantFacts,
          mcqPracticeQuestions: d.questions && d.questions.length ? d.questions : p.mcqPracticeQuestions,
          attachments: d.attachment ? [...p.attachments, d.attachment] : p.attachments
        }));

        setAlertState({
          isOpen: true,
          title: "Document Parsed Successfully",
          message: `Extracted Headline, Category (${d.category}), Summary, Detailed Analysis, ${
            d.keyPoints?.length || 0
          } Key Points, and ${d.questions?.length || 0} MCQ practice questions from "${file.name}".`,
          variant: "success"
        });
      }
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: "Document Extraction Error",
        message: err?.message || "Failed to extract structured current affairs from the uploaded file.",
        variant: "danger"
      });
    } finally {
      setIsExtracting(false);
      if (autoExtractInputRef.current) autoExtractInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setArticleForm((p) => ({
      ...p,
      attachments: p.attachments.filter((_, i) => i !== index)
    }));
  };

  const toggleBatchSelection = (bName: string) => {
    setArticleForm((p) => {
      const exists = p.assignedBatches.includes(bName);
      return {
        ...p,
        assignedBatches: exists
          ? p.assignedBatches.filter((b) => b !== bName)
          : [...p.assignedBatches, bName]
      };
    });
  };

  const toggleExamSelection = (exam: string) => {
    setArticleForm((p) => {
      const exists = p.applicableExams.includes(exam);
      return {
        ...p,
        applicableExams: exists
          ? p.applicableExams.filter((e) => e !== exam)
          : [...p.applicableExams, exam]
      };
    });
  };

  const handleCreateArticle = async () => {
    if (!articleForm.title.trim() || !articleForm.shortSummary.trim()) {
      setAlertState({
        isOpen: true,
        title: "Validation Error",
        message: "Headline and Short Summary are mandatory.",
        variant: "warning"
      });
      return;
    }

    try {
      await apiPost("/admin/current-affairs/articles", articleForm);
      setCreateModal(false);
      setArticleForm({
        title: "",
        category: "Polity & Governance",
        shortSummary: "",
        detailedExplanation: "",
        keyPoints: [],
        importantFacts: [],
        priority: "High",
        isHighlyImportant: true,
        sourceName: "The Hindu / PIB",
        sourceUrl: "",
        examRelevance: ["Prelims", "Mains"],
        applicableExams: ["UPSC", "APPSC", "TSPSC"],
        targetAudience: "all",
        assignedBatches: [],
        assignedStudentIds: [],
        attachments: [],
        mcqPracticeQuestions: []
      });
      setAlertState({
        isOpen: true,
        title: "Article Published",
        message: "Current Affairs article with handouts & questions published successfully.",
        variant: "success"
      });
      loadArticles();
      if (isAdmin) loadAdminStats();
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: "Publishing Failed",
        message: err?.message || "Could not publish article.",
        variant: "danger"
      });
    }
  };

  // ── Quiz Taking Workflow ──────────────────────────────────────────
  const startQuiz = (quiz: CAQuiz) => {
    setActiveQuiz(quiz);
    setQuizAnswers({});
    setCurrentQuestionIdx(0);
    setQuizTimer(quiz.duration * 60);
    setQuizResult(null);
  };

  const handleSelectQuizAnswer = (qIndex: number, optionValue: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [String(qIndex)]: optionValue
    }));
  };

  const handleAutoSubmitQuiz = () => {
    if (activeQuiz) {
      submitQuizAttempt();
    }
  };

  const submitQuizAttempt = async () => {
    if (!activeQuiz) return;
    setSubmittingQuiz(true);
    const timeSpent = activeQuiz.duration * 60 - quizTimer;

    try {
      const res = await apiPost<{ message: string; result: CAQuizAttempt }>(
        `/answerer/current-affairs/quizzes/${activeQuiz.id}/submit`,
        {
          userId: userName,
          answers: quizAnswers,
          timeSpentSeconds: Math.max(1, timeSpent)
        }
      );

      if (res?.result) {
        setQuizResult(res.result);
        loadUserAttempts();
      }
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: "Quiz Submission Failed",
        message: err?.message || "Could not submit quiz.",
        variant: "danger"
      });
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getFormatBadge = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return { label: "PDF", class: "pdf" };
    if (["doc", "docx"].includes(ext)) return { label: "DOCX", class: "docx" };
    if (["xls", "xlsx", "csv"].includes(ext)) return { label: "EXCEL", class: "xlsx" };
    if (["ppt", "pptx"].includes(ext)) return { label: "PPT", class: "pptx" };
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return { label: "IMG", class: "image" };
    if (["txt", "md"].includes(ext)) return { label: "TXT", class: "txt" };
    return { label: ext.toUpperCase() || "DOC", class: "txt" };
  };

  const formatTimeMinutesSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="ca-root">
      {/* Header */}
      <div className="ca-header">
        <div>
          <span className="ca-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            </svg>
            UPSC / State PSC Daily Current Affairs & Editorial Analysis
          </span>
          <h1 className="ca-title">Current Affairs Hub & Test Practice</h1>
          <p className="ca-sub">
            Curated daily exam-oriented briefs, dimensional analysis, multi-format handouts (PDF, DOCX), and topic practice tests.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="ca-btn ca-btn-secondary" onClick={() => setCreateQuizModal(true)}>
              <PlusIcon size={15} style={{ marginRight: 4 }} /> Create Daily Quiz
            </button>
            <button className="ca-btn ca-btn-primary" onClick={() => setCreateModal(true)}>
              <PlusIcon size={15} style={{ marginRight: 4 }} /> Publish Article
            </button>
          </div>
        )}
      </div>

      {/* Admin Stats */}
      {isAdmin && adminStats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card">
            <span className="ca-stat-val">{adminStats.todayArticles || 0}</span>
            <span className="ca-stat-lbl">Today's Briefs</span>
          </div>
          <div className="ca-stat-card">
            <span className="ca-stat-val">{adminStats.publishedThisMonth || 0}</span>
            <span className="ca-stat-lbl">Published This Month</span>
          </div>
          <div className="ca-stat-card">
            <span className="ca-stat-val">{adminStats.totalArticles || 0}</span>
            <span className="ca-stat-lbl">Total Repository</span>
          </div>
          <div className="ca-stat-card">
            <span className="ca-stat-val">{adminStats.totalBookmarks || 0}</span>
            <span className="ca-stat-lbl">Student Bookmarks</span>
          </div>
          <div className="ca-stat-card">
            <span className="ca-stat-val">{adminStats.totalQuizzes || 0}</span>
            <span className="ca-stat-lbl">Daily Quizzes</span>
          </div>
        </div>
      )}

      {/* Nav & Search */}
      <div className="ca-nav-bar">
        <div className="ca-tabs">
          <button
            className={`ca-tab ${viewTab === "articles" ? "active" : ""}`}
            onClick={() => {
              setViewTab("articles");
              setActiveArticle(null);
            }}
          >
            All Articles
          </button>
          <button
            className={`ca-tab ${viewTab === "quiz" ? "active" : ""}`}
            onClick={() => {
              setViewTab("quiz");
              setActiveArticle(null);
            }}
          >
            <BookOpenIcon size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
            Daily Quizzes & Mock Practice ({quizzes.length})
          </button>
          <button
            className={`ca-tab ${viewTab === "bookmarks" ? "active" : ""}`}
            onClick={() => {
              setViewTab("bookmarks");
              setActiveArticle(null);
            }}
          >
            <BookmarkIcon size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} filled={viewTab === "bookmarks"} />
            Bookmarked ({bookmarkedIds.size})
          </button>
          <button
            className={`ca-tab ${viewTab === "revision" ? "active" : ""}`}
            onClick={() => {
              setViewTab("revision");
              setActiveArticle(null);
            }}
          >
            <FileTextIcon size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
            Personal Revision & Notes ({savedNotes.length})
          </button>
        </div>

        <div className="ca-search-box">
          <input
            className="ca-search-input"
            placeholder="Search current affairs, schemes, committee reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Pills */}
      {viewTab === "articles" && (
        <div className="ca-category-bar">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`ca-cat-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {loading ? (
          <div className="ca-loading">
            <div className="ca-spinner" />
            <span>Loading Current Affairs feed...</span>
          </div>
        ) : activeArticle ? (
          /* Reader View */
          <div className="ca-reader-container">
            <div className="ca-reader-topbar">
              <button className="ca-btn ca-btn-secondary ca-btn-sm" onClick={() => setActiveArticle(null)}>
                ← Back to Articles
              </button>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
                  <button
                    style={{
                      border: "none",
                      background: fontSize === "normal" ? "#fff" : "transparent",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      cursor: "pointer"
                    }}
                    onClick={() => setFontSize("normal")}
                  >
                    A
                  </button>
                  <button
                    style={{
                      border: "none",
                      background: fontSize === "large" ? "#fff" : "transparent",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                    onClick={() => setFontSize("large")}
                  >
                    A+
                  </button>
                </div>

                <button
                  className="ca-bookmark-btn"
                  onClick={() => handleToggleBookmark(activeArticle)}
                  title="Bookmark"
                >
                  <BookmarkIcon
                    size={14}
                    style={{ marginRight: 4, verticalAlign: "-1px" }}
                    filled={bookmarkedIds.has(activeArticle.id)}
                  />
                  {bookmarkedIds.has(activeArticle.id) ? "Bookmarked" : "Bookmark"}
                </button>
              </div>
            </div>

            <span className="ca-card-cat">{activeArticle.category}</span>
            <h2 className="ca-reader-title" style={{ fontSize: fontSize === "large" ? "1.85rem" : "1.6rem" }}>
              {activeArticle.title}
            </h2>

            <div style={{ fontSize: "0.76rem", color: "#64748b", marginBottom: 16 }}>
              Published on {activeArticle.publishDate} • Source: <strong>{activeArticle.source?.name || "PIB / Official"}</strong>
            </div>

            <div className="ca-reader-summary">
              <strong>Executive Summary:</strong> {activeArticle.shortSummary}
            </div>

            {/* Key Points / Takeaways */}
            {activeArticle.keyPoints && activeArticle.keyPoints.length > 0 && (
              <div className="ca-keypoints-box">
                <h4>🎯 High-Yield Exam Takeaways</h4>
                <ul>
                  {activeArticle.keyPoints.map((kp, idx) => (
                    <li key={idx}>{kp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Important Facts */}
            {activeArticle.importantFacts && activeArticle.importantFacts.length > 0 && (
              <div className="ca-facts-box">
                <h4>📊 Prelims Pointers & Key Facts</h4>
                <div className="ca-facts-chips">
                  {activeArticle.importantFacts.map((fact, idx) => (
                    <span key={idx} className="ca-fact-chip">
                      📌 {fact}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeArticle.detailedExplanation && (
              <div className="ca-reader-body" style={{ fontSize: fontSize === "large" ? "1.05rem" : "0.92rem" }}>
                <h3>In-Depth Analysis & Dimensions</h3>
                <p style={{ whiteSpace: "pre-line" }}>{activeArticle.detailedExplanation}</p>
              </div>
            )}

            {/* Embedded MCQ Practice */}
            {activeArticle.mcqPracticeQuestions && activeArticle.mcqPracticeQuestions.length > 0 && (
              <div className="ca-article-mcqs">
                <h3>📝 Practice Questions for this Article ({activeArticle.mcqPracticeQuestions.length})</h3>
                {activeArticle.mcqPracticeQuestions.map((mcq, mIdx) => (
                  <div key={mIdx} className="ca-mcq-card">
                    <div className="ca-mcq-stem">
                      <strong>Q{mIdx + 1}.</strong> {mcq.question}
                    </div>
                    <div className="ca-mcq-opts">
                      {mcq.options.map((opt, oIdx) => (
                        <div key={oIdx} className="ca-mcq-opt">
                          <span className="ca-opt-letter">{String.fromCharCode(65 + oIdx)}</span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                    <div className="ca-mcq-solution">
                      <strong>Correct Answer:</strong> {mcq.correctAnswer}
                      {mcq.explanation && <p style={{ margin: "4px 0 0", color: "#475569" }}>{mcq.explanation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Attached Documents in Reader with Preview & Download */}
            {activeArticle.attachments && activeArticle.attachments.length > 0 && (
              <div className="ca-attached-section">
                <h3>
                  <PaperclipIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                  Attached Handouts & Multi-Format Documents ({activeArticle.attachments.length})
                </h3>
                <div className="ca-attach-cards-grid">
                  {activeArticle.attachments.map((att, idx) => {
                    const badge = getFormatBadge(att.name);
                    const fullUrl = getMediaUrl(att.url || att.dataUrl);
                    return (
                      <div key={idx} className="ca-attach-download-card">
                        <div className="ca-attach-info">
                          <div className="ca-attach-title-row">
                            <span className={`ca-fmt-pill ${badge.class}`}>{badge.label}</span>
                            <span className="ca-attach-name" title={att.name}>{att.name}</span>
                          </div>
                          <span className="ca-attach-meta">{formatFileSize(att.size)}</span>
                        </div>
                        <div className="ca-attach-actions">
                          <button
                            type="button"
                            className="ca-btn ca-btn-primary"
                            onClick={() => setPreviewDoc({ url: fullUrl, name: att.name })}
                            title="Interactive In-App Preview"
                          >
                            View
                          </button>
                          <a
                            className="ca-btn ca-btn-secondary"
                            href={fullUrl || "#"}
                            download={att.name}
                            target="_blank"
                            rel="noreferrer"
                            title="Download Document"
                          >
                            <DownloadIcon size={13} style={{ marginRight: 3 }} /> Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Private Student Notes */}
            <div className="ca-notes-section">
              <h3>
                <FileTextIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                My Private Study Notes (Personal Revision)
              </h3>
              <textarea
                className="ca-notes-textarea"
                rows={3}
                placeholder="Write your key points, mnemonics, or revision pointers for this topic..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="ca-btn ca-btn-primary ca-btn-sm" onClick={handleSaveNote} disabled={savingNote}>
                  {savingNote ? "Saving..." : "Save Private Note"}
                </button>
              </div>
            </div>
          </div>
        ) : viewTab === "quiz" ? (
          /* ── Daily Quizzes & Mock Practice Tab ─────────────────────── */
          <div className="ca-quiz-section">
            <div className="ca-quiz-header">
              <div>
                <h2>Daily Current Affairs Quizzes & Mock Test Series</h2>
                <p>Timed practice quizzes mapped to civil services and banking general awareness standards.</p>
              </div>
            </div>

            {quizzes.length === 0 ? (
              <div className="ca-empty">
                <div className="ca-empty-icon">
                  <BookOpenIcon size={36} color="#94a3b8" />
                </div>
                <h3>No daily current affairs quizzes available yet</h3>
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                  Check back daily for fresh 10-20 question current affairs speed drills.
                </p>
              </div>
            ) : (
              <div className="ca-quiz-grid">
                {quizzes.map((q) => {
                  const pastAttempt = userAttempts.find((a) => a.quizId === q.id);
                  return (
                    <div key={q.id} className="ca-quiz-card">
                      <div className="ca-quiz-meta">
                        <span className="ca-quiz-date">📅 {q.quizDate}</span>
                        <span className="ca-quiz-duration">⏱️ {q.duration} mins</span>
                      </div>
                      <h3 className="ca-quiz-title">{q.title}</h3>
                      <div className="ca-quiz-stats">
                        <span>📝 {q.questionsCount || q.questions?.length || 0} Questions</span>
                        <span>🎯 {q.totalMarks} Marks</span>
                        <span>⚠️ -{q.negativeMarking} Neg</span>
                      </div>

                      {pastAttempt && (
                        <div className="ca-quiz-past-score">
                          <span>
                            Previous Score: <strong>{pastAttempt.scoredMarks}</strong> / {pastAttempt.maxMarks} ({pastAttempt.percentage}%)
                          </span>
                        </div>
                      )}

                      <button className="ca-btn ca-btn-primary" onClick={() => startQuiz(q)} style={{ width: "100%", marginTop: 8 }}>
                        {pastAttempt ? "Retake Quiz Drill" : "Start Timed Quiz"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewTab === "revision" ? (
          /* ── Personal Revision Tab ─────────────────────────────────── */
          <div className="ca-revision-section">
            <div className="ca-quiz-header">
              <div>
                <h2>Personal Revision Hub & Study Notes</h2>
                <p>Private revision repository containing your highlighted notes, bookmarks, and high-yield facts.</p>
              </div>
            </div>

            {savedNotes.length === 0 ? (
              <div className="ca-empty">
                <div className="ca-empty-icon">
                  <FileTextIcon size={36} color="#94a3b8" />
                </div>
                <h3>No private study notes created yet</h3>
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                  Open any Current Affairs brief and write notes to populate your personal revision pool.
                </p>
              </div>
            ) : (
              <div className="ca-notes-grid">
                {savedNotes.map((n, idx) => (
                  <div key={idx} className="ca-note-card">
                    <span className="ca-note-date">Updated on {n.updatedAt?.slice(0, 10)}</span>
                    <p className="ca-note-content">{n.noteText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Articles Grid (All or Bookmarked) */
          (() => {
            const displayList =
              viewTab === "bookmarks" ? articles.filter((a) => bookmarkedIds.has(a.id)) : articles;

            if (displayList.length === 0) {
              return (
                <div className="ca-empty">
                  <div className="ca-empty-icon">
                    <BookOpenIcon size={36} color="#94a3b8" />
                  </div>
                  <h3>
                    {viewTab === "bookmarks" ? "No bookmarked articles" : "No current affairs briefs found"}
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    {viewTab === "bookmarks"
                      ? "Bookmark articles using the bookmark icon to review them here."
                      : "Try selecting a different category or search term."}
                  </p>
                </div>
              );
            }

            return (
              <div className="ca-grid">
                {displayList.map((art) => (
                  <div
                    key={art.id}
                    className={`ca-card ${art.priority === "High" ? "high-priority" : ""}`}
                    onClick={() => setActiveArticle(art)}
                  >
                    <div className="ca-card-meta">
                      <span className="ca-card-cat">{art.category}</span>
                      <span>{art.publishDate}</span>
                    </div>

                    <h3 className="ca-card-title">{art.title}</h3>
                    <p className="ca-card-summary">{art.shortSummary}</p>

                    <div className="ca-card-footer">
                      <div className="ca-chips-group">
                        {art.examRelevance &&
                          art.examRelevance.map((r, i) => (
                            <span key={i} className="ca-chip-exam">
                              {r}
                            </span>
                          ))}
                        {art.attachments && art.attachments.length > 0 && (
                          <span className="ca-chip-attach">
                            <PaperclipIcon size={12} style={{ marginRight: 3, verticalAlign: "-1px" }} />
                            {art.attachments.length} {art.attachments.length === 1 ? "Handout" : "Handouts"}
                          </span>
                        )}
                        {art.mcqPracticeQuestions && art.mcqPracticeQuestions.length > 0 && (
                          <span className="ca-chip-batch">
                            📝 {art.mcqPracticeQuestions.length} MCQs
                          </span>
                        )}
                      </div>

                      <button
                        className="ca-bookmark-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(art);
                        }}
                        title="Bookmark"
                      >
                        <BookmarkIcon
                          size={15}
                          filled={bookmarkedIds.has(art.id)}
                          color={bookmarkedIds.has(art.id) ? "#f59e0b" : "#94a3b8"}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* ── INTERACTIVE TIMED QUIZ MODAL PLAYER ──────────────────────── */}
      {activeQuiz && (
        <div className="ca-modal-overlay">
          <div className="ca-quiz-modal">
            <div className="ca-quiz-modal-header">
              <div>
                <h3>{activeQuiz.title}</h3>
                <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                  Question {currentQuestionIdx + 1} of {activeQuiz.questions.length} • Total Marks: {activeQuiz.totalMarks}
                </span>
              </div>
              {!quizResult && (
                <div className={`ca-timer-badge ${quizTimer < 120 ? "timer-warning" : ""}`}>
                  ⏱️ {formatTimeMinutesSeconds(quizTimer)}
                </div>
              )}
              <button
                className="ca-modal-close"
                onClick={() => {
                  if (quizResult || window.confirm("Are you sure you want to exit the quiz?")) {
                    setActiveQuiz(null);
                    setQuizResult(null);
                  }
                }}
              >
                ✕
              </button>
            </div>

            <div className="ca-quiz-modal-body">
              {quizResult ? (
                /* Quiz Results & Score Breakdown */
                <div className="ca-result-container">
                  <div className="ca-result-banner">
                    <span className="ca-result-score">
                      {quizResult.scoredMarks} / {quizResult.maxMarks}
                    </span>
                    <span className="ca-result-pct">{quizResult.percentage}% Accuracy</span>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                      ✅ {quizResult.correctCount} Correct • ❌ {quizResult.incorrectCount} Incorrect • ⚪ {quizResult.unattemptedCount} Unattempted
                    </p>
                  </div>

                  <h4>Detailed Question-by-Question Review & Solutions</h4>
                  <div className="ca-review-list">
                    {quizResult.review.map((item, rIdx) => (
                      <div key={rIdx} className={`ca-review-card ${item.status}`}>
                        <div className="ca-review-stem">
                          <strong>Q{rIdx + 1}.</strong> {item.question}
                        </div>
                        <div className="ca-review-details">
                          <span>
                            Your Answer: <strong>{item.userAnswer || "None (Skipped)"}</strong>
                          </span>
                          <span>
                            Correct Answer: <strong>{item.correctAnswer}</strong>
                          </span>
                        </div>
                        {item.explanation && (
                          <div className="ca-review-expl">
                            <strong>Explanation:</strong> {item.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Question Player */
                (() => {
                  const q = activeQuiz.questions[currentQuestionIdx];
                  if (!q) return null;
                  const selectedOpt = quizAnswers[String(currentQuestionIdx)] || "";

                  return (
                    <div className="ca-player-container">
                      <div className="ca-question-stem">
                        <strong>Q{currentQuestionIdx + 1}.</strong> {q.question}
                      </div>

                      <div className="ca-player-options">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selectedOpt === opt;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              className={`ca-player-opt-btn ${isSelected ? "selected" : ""}`}
                              onClick={() => handleSelectQuizAnswer(currentQuestionIdx, opt)}
                            >
                              <span className="ca-opt-letter">{String.fromCharCode(65 + oIdx)}</span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Question Palette Nav */}
                      <div className="ca-palette-bar">
                        {activeQuiz.questions.map((_, pIdx) => {
                          const isAnswered = !!quizAnswers[String(pIdx)];
                          const isCurrent = pIdx === currentQuestionIdx;
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              className={`ca-palette-btn ${isCurrent ? "current" : ""} ${isAnswered ? "answered" : ""}`}
                              onClick={() => setCurrentQuestionIdx(pIdx)}
                            >
                              {pIdx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="ca-quiz-modal-footer">
              {quizResult ? (
                <button
                  className="ca-btn ca-btn-primary"
                  onClick={() => {
                    setActiveQuiz(null);
                    setQuizResult(null);
                  }}
                >
                  Done & Back to Hub
                </button>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <button
                    className="ca-btn ca-btn-secondary"
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                  >
                    ← Previous
                  </button>

                  <div style={{ display: "flex", gap: 10 }}>
                    {currentQuestionIdx < activeQuiz.questions.length - 1 ? (
                      <button
                        className="ca-btn ca-btn-secondary"
                        onClick={() => setCurrentQuestionIdx((p) => Math.min(activeQuiz.questions.length - 1, p + 1))}
                      >
                        Next →
                      </button>
                    ) : null}

                    <button
                      className="ca-btn ca-btn-primary"
                      onClick={submitQuizAttempt}
                      disabled={submittingQuiz}
                    >
                      {submittingQuiz ? "Submitting..." : "Submit Test Drill"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── IN-APP DOCUMENT / PDF HANDOUT VIEWER MODAL ────────────────── */}
      {previewDoc && (
        <div className="ca-modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="ca-doc-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ca-doc-preview-header">
              <div className="ca-doc-preview-title-wrap">
                <span className="ca-doc-preview-badge">📄 Study Handout & Document</span>
                <h3 title={previewDoc.name}>{previewDoc.name}</h3>
              </div>
              <div className="ca-doc-preview-header-actions">
                <a
                  className="ca-btn ca-btn-sm ca-btn-primary"
                  href={docBlobUrl || previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in new window"
                >
                  ↗ Full Tab
                </a>
                <a
                  className="ca-btn ca-btn-sm ca-btn-secondary"
                  href={docBlobUrl || previewDoc.url}
                  download={previewDoc.name}
                  target="_blank"
                  rel="noreferrer"
                  title="Download Document"
                >
                  <DownloadIcon size={13} style={{ marginRight: 4 }} /> Download
                </a>
                <button className="ca-modal-close" onClick={() => setPreviewDoc(null)} title="Close preview">
                  ✕
                </button>
              </div>
            </div>
            <div className="ca-doc-preview-body">
              {isLoadingBlob ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff", gap: 14 }}>
                  <div className="shine-btn-spinner" style={{ width: 36, height: 36, borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#3b82f6" }} />
                  <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Opening Study Document...</span>
                </div>
              ) : previewDoc.url.toLowerCase().endsWith(".pdf") || previewDoc.url.includes("pdf") ? (
                <iframe
                  src={`${docBlobUrl || previewDoc.url}#view=FitH&toolbar=1&navpanes=0`}
                  title={previewDoc.name}
                  className="ca-doc-preview-iframe"
                  tabIndex={0}
                  style={{ border: "none", width: "100%", height: "100%", minHeight: "100%", background: "#525659" }}
                />
              ) : (
                <div style={{ padding: 32, textAlign: "center", background: "#ffffff", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                  <h4 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "1.1rem" }}>{previewDoc.name}</h4>
                  <p style={{ color: "#64748b", maxWidth: 360, margin: "0 0 18px", fontSize: "0.88rem" }}>
                    This study document format can be opened directly or downloaded to your device.
                  </p>
                  <a
                    className="ca-btn ca-btn-primary"
                    href={docBlobUrl || previewDoc.url}
                    download={previewDoc.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DownloadIcon size={14} style={{ marginRight: 6 }} /> Open / Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN CREATE ARTICLE MODAL (WITH AUTO-EXTRACT) ───────────── */}
      {createModal && (
        <div
          className="ca-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModal(false);
          }}
        >
          <div className="ca-modal">
            <div className="ca-modal-header">
              <h3>Publish Daily Current Affairs & Handouts</h3>
              <button className="ca-modal-close" onClick={() => setCreateModal(false)}>
                ✕
              </button>
            </div>

            <div className="ca-modal-body">
              {/* ⚡ Auto-Extract from PDF Banner */}
              <div className="ca-extract-banner">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="ca-extract-icon">⚡</div>
                  <div>
                    <strong>Auto-Extract from PDF, Handout, or Word Document</strong>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#475569" }}>
                      Upload any Current Affairs PDF (PIB, The Hindu editorial, monthly capsule) to automatically parse
                      Headline, Summary, Key Points, and MCQs!
                    </p>
                  </div>
                </div>
                <input
                  ref={autoExtractInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.epub"
                  style={{ display: "none" }}
                  onChange={handleAutoExtractDocument}
                />
                <button
                  type="button"
                  className="ca-btn ca-btn-primary ca-btn-sm"
                  onClick={() => autoExtractInputRef.current?.click()}
                  disabled={isExtracting}
                >
                  {isExtracting ? "Parsing Document..." : "Auto-Extract from File"}
                </button>
              </div>

              <div className="ca-form-grid">
                <div className="ca-field full">
                  <label>Headline / Title *</label>
                  <input
                    className="ca-input"
                    value={articleForm.title}
                    onChange={(e) => setArticleForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. RBI Keeps Repo Rate Unchanged at 6.5% in Monetary Policy Review"
                  />
                </div>

                <div className="ca-field">
                  <label>Category *</label>
                  <select
                    className="ca-input"
                    value={articleForm.category}
                    onChange={(e) => setArticleForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ca-field">
                  <label>Priority</label>
                  <select
                    className="ca-input"
                    value={articleForm.priority}
                    onChange={(e) => setArticleForm((p) => ({ ...p, priority: e.target.value as any }))}
                  >
                    <option value="High">High (⭐ Daily Highlight)</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="ca-field full">
                  <label>Short Summary (Executive Overview) *</label>
                  <textarea
                    className="ca-input"
                    rows={3}
                    value={articleForm.shortSummary}
                    onChange={(e) => setArticleForm((p) => ({ ...p, shortSummary: e.target.value }))}
                    placeholder="Crisp 2-3 sentence overview for quick reading..."
                  />
                </div>

                <div className="ca-field full">
                  <label>Detailed In-Depth Explanation & Dimensions</label>
                  <textarea
                    className="ca-input"
                    rows={4}
                    value={articleForm.detailedExplanation}
                    onChange={(e) => setArticleForm((p) => ({ ...p, detailedExplanation: e.target.value }))}
                    placeholder="Detailed context, committee recommendations, legal backing, economic effects..."
                  />
                </div>

                {/* ── Document Upload with Multi-Format Support ── */}
                <div className="ca-field full">
                  <label>📎 Attach Study Documents & Handouts (PDF, DOCX, XLSX, TXT, EPUB)</label>
                  <div className="ca-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.epub,.png,.jpg,.jpeg,.webp,.rtf,.odt,.ods,.tsv"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                    />
                    <div className="ca-dropzone-icon">📁</div>
                    <strong>Click or Drag files to attach (PDF, DOCX, PPT, XLSX, TXT, Images)</strong>
                    <small>
                      {isUploadingAttachment
                        ? "Uploading & processing file on server..."
                        : "Multiple file formats supported with instant candidate in-app reader"}
                    </small>
                  </div>

                  {articleForm.attachments.length > 0 && (
                    <div className="ca-attachment-list">
                      {articleForm.attachments.map((att, idx) => {
                        const badge = getFormatBadge(att.name);
                        return (
                          <div key={idx} className="ca-attachment-item">
                            <div className="ca-attachment-left">
                              <span className={`ca-fmt-pill ${badge.class}`}>{badge.label}</span>
                              <span className="ca-attachment-title">{att.name}</span>
                              <small style={{ color: "#64748b" }}>({formatFileSize(att.size)})</small>
                            </div>
                            <button
                              type="button"
                              className="ca-attachment-remove"
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

                {/* ── Audience & Batch-wise Targeting ── */}
                <div className="ca-field full">
                  <label>👥 Assign / Target Audience</label>
                  <div className="ca-audience-selector">
                    <button
                      type="button"
                      className={`ca-audience-btn ${articleForm.targetAudience === "all" ? "active" : ""}`}
                      onClick={() => setArticleForm((p) => ({ ...p, targetAudience: "all" }))}
                    >
                      🌐 All Students
                    </button>
                    <button
                      type="button"
                      className={`ca-audience-btn ${articleForm.targetAudience === "batches" ? "active" : ""}`}
                      onClick={() => setArticleForm((p) => ({ ...p, targetAudience: "batches" }))}
                    >
                      🏷️ Batch-Wise
                    </button>
                    <button
                      type="button"
                      className={`ca-audience-btn ${articleForm.targetAudience === "exams" ? "active" : ""}`}
                      onClick={() => setArticleForm((p) => ({ ...p, targetAudience: "exams" }))}
                    >
                      🏛️ Target Exams
                    </button>
                    <button
                      type="button"
                      className={`ca-audience-btn ${articleForm.targetAudience === "students" ? "active" : ""}`}
                      onClick={() => setArticleForm((p) => ({ ...p, targetAudience: "students" }))}
                    >
                      👤 Specific Candidates
                    </button>
                  </div>

                  {articleForm.targetAudience === "batches" && (
                    <div className="ca-batch-chip-wrap">
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#475569", width: "100%" }}>
                        Select Enrolled Batches to Assign:
                      </span>
                      {batches.map((b) => {
                        const isSel = articleForm.assignedBatches.includes(b.name);
                        return (
                          <button
                            type="button"
                            key={b.name}
                            className={`ca-batch-chip ${isSel ? "selected" : ""}`}
                            onClick={() => toggleBatchSelection(b.name)}
                          >
                            {isSel ? "✓ " : "+ "}
                            {b.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {articleForm.targetAudience === "exams" && (
                    <div className="ca-batch-chip-wrap">
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#475569", width: "100%" }}>
                        Select Target Examinations:
                      </span>
                      {EXAM_OPTIONS.map((exam) => {
                        const isSel = articleForm.applicableExams.includes(exam);
                        return (
                          <button
                            type="button"
                            key={exam}
                            className={`ca-batch-chip ${isSel ? "selected" : ""}`}
                            onClick={() => toggleExamSelection(exam)}
                          >
                            {isSel ? "✓ " : "+ "}
                            {exam}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="ca-field">
                  <label>Source Name</label>
                  <input
                    className="ca-input"
                    value={articleForm.sourceName}
                    onChange={(e) => setArticleForm((p) => ({ ...p, sourceName: e.target.value }))}
                    placeholder="e.g. The Hindu / PIB / Indian Express"
                  />
                </div>

                <div className="ca-field">
                  <label>Source URL</label>
                  <input
                    className="ca-input"
                    value={articleForm.sourceUrl}
                    onChange={(e) => setArticleForm((p) => ({ ...p, sourceUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="ca-modal-footer">
              <button className="ca-btn ca-btn-secondary" onClick={() => setCreateModal(false)}>
                Cancel
              </button>
              <button className="ca-btn ca-btn-primary" onClick={handleCreateArticle}>
                Publish Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE DAILY QUIZ MODAL ───────────────────────────────────── */}
      {createQuizModal && (
        <div className="ca-modal-overlay" onClick={() => setCreateQuizModal(false)}>
          <div className="ca-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ca-modal-header">
              <h3>Create Daily Current Affairs Quiz</h3>
              <button className="ca-modal-close" onClick={() => setCreateQuizModal(false)}>
                ✕
              </button>
            </div>
            <div className="ca-modal-body">
              <div className="ca-form-grid">
                <div className="ca-field full">
                  <label>Quiz Title *</label>
                  <input
                    className="ca-input"
                    placeholder="e.g. Daily Current Affairs Mock Drill — 26 September 2026"
                    value={quizForm.title}
                    onChange={(e) => setQuizForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="ca-field">
                  <label>Quiz Date</label>
                  <input
                    type="date"
                    className="ca-input"
                    value={quizForm.quizDate}
                    onChange={(e) => setQuizForm((p) => ({ ...p, quizDate: e.target.value }))}
                  />
                </div>
                <div className="ca-field">
                  <label>Duration (Minutes)</label>
                  <input
                    type="number"
                    className="ca-input"
                    value={quizForm.duration}
                    onChange={(e) => setQuizForm((p) => ({ ...p, duration: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="ca-modal-footer">
              <button className="ca-btn ca-btn-secondary" onClick={() => setCreateQuizModal(false)}>
                Cancel
              </button>
              <button
                className="ca-btn ca-btn-primary"
                onClick={async () => {
                  if (!quizForm.title.trim()) {
                    setAlertState({
                      isOpen: true,
                      title: "Validation Error",
                      message: "Quiz title is required",
                      variant: "warning"
                    });
                    return;
                  }
                  try {
                    await apiPost("/admin/current-affairs/quizzes", {
                      ...quizForm,
                      questions:
                        quizForm.questions.length > 0
                          ? quizForm.questions
                          : [
                              {
                                question: "What is the primary objective of PM Surya Ghar Muft Bijli Yojana?",
                                options: [
                                  "Provide free rooftop solar up to 300 units",
                                  "Free thermal electricity for industries",
                                  "Subsidized diesel generators",
                                  "Rural grid disconnection"
                                ],
                                correctAnswer: "Provide free rooftop solar up to 300 units",
                                explanation: "PM Surya Ghar Muft Bijli Yojana provides solar rooftop subsidy for up to 300 units free power.",
                                marks: 2,
                                negativeMarks: 0.66
                              }
                            ]
                    });
                    setCreateQuizModal(false);
                    loadQuizzes();
                    setAlertState({
                      isOpen: true,
                      title: "Quiz Created",
                      message: "Daily Current Affairs Quiz has been published successfully.",
                      variant: "success"
                    });
                  } catch (err: any) {
                    setAlertState({
                      isOpen: true,
                      title: "Error",
                      message: err?.message || "Failed to create quiz",
                      variant: "danger"
                    });
                  }
                }}
              >
                Publish Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default CurrentAffairsHub;
