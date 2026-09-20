import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import { BookmarkIcon, PaperclipIcon, TagIcon, BookOpenIcon, PlusIcon, FileTextIcon, DownloadIcon, SearchIcon, CheckIcon } from "../common/EnterpriseIcons";
import "./CurrentAffairsHub.css";

export interface AttachmentItem {
  id?: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  url?: string;
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
  source?: {
    name: string;
    url: string;
  };
  viewsCount?: number;
  bookmarksCount?: number;
  status: string;
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
  "All", "National", "International", "Polity & Governance", "Economy",
  "Environment & Ecology", "Science & Technology", "Defence", "Space",
  "Geography", "History & Culture", "Social Issues", "Government Schemes",
  "Reports & Indices", "Andhra Pradesh", "Telangana"
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

  // Admin authoring state
  const [createModal, setCreateModal] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [articleForm, setArticleForm] = useState<{
    title: string;
    category: string;
    shortSummary: string;
    detailedExplanation: string;
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
  }>({
    title: "",
    category: "Polity & Governance",
    shortSummary: "",
    detailedExplanation: "",
    priority: "High",
    isHighlyImportant: true,
    sourceName: "The Hindu / PIB",
    sourceUrl: "",
    examRelevance: ["Prelims", "Mains"],
    applicableExams: ["UPSC", "APPSC", "TSPSC"],
    targetAudience: "all",
    assignedBatches: [],
    assignedStudentIds: [],
    attachments: []
  });

  const [adminStats, setAdminStats] = useState<any>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean; title: string; message: string; variant: AlertVariant;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (search) params.set("search", search);
      const res = await apiGet<{ articles: CurrentAffairItem[]; categories: string[] }>(`/admin/current-affairs/articles?${params}`);
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
      setBatches(batchRes.batches || [
        { name: "Batch-A" },
        { name: "UPSC 2026 Prelims" },
        { name: "Mains Enrichment Track" },
        { name: "APPSC Group-1 Morning" },
        { name: "TSPSC Weekend Batch" }
      ]);
      setStudents(userRes.users || []);
    } catch {}
  }, [isAdmin]);

  const loadBookmarks = useCallback(async () => {
    try {
      const res = await apiGet<{ bookmarks: any[] }>(`/answerer/current-affairs/bookmarks?userId=${encodeURIComponent(userName)}`);
      const bSet = new Set<string>((res.bookmarks || []).map(b => b.articleId));
      setBookmarkedIds(bSet);
    } catch {}
  }, [userName]);

  useEffect(() => {
    loadArticles();
    if (isAdmin) {
      loadAdminStats();
      loadBatchesAndUsers();
    }
    loadBookmarks();
  }, [loadArticles, loadAdminStats, loadBatchesAndUsers, loadBookmarks, isAdmin]);

  const handleToggleBookmark = async (art: CurrentAffairItem) => {
    try {
      const res = await apiPost<{ isBookmarked: boolean }>("/answerer/current-affairs/bookmarks", {
        userId: userName,
        articleId: art.id
      });
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (res.isBookmarked) next.add(art.id);
        else next.delete(art.id);
        return next;
      });
      setAlertState({
        isOpen: true,
        title: res.isBookmarked ? "Article Bookmarked" : "Bookmark Removed",
        message: res.isBookmarked ? "Article added to your personal Current Affairs revision list." : "Bookmark removed.",
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

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await apiPostForm<{ attachment: AttachmentItem }>("/admin/current-affairs/upload-attachment", formData);
        if (res?.attachment) {
          setArticleForm((p) => ({
            ...p,
            attachments: [...p.attachments, res.attachment]
          }));
        }
      } catch (uploadErr) {
        // Fallback to local dataUrl only if file is small (< 500 KB)
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

    if (fileInputRef.current) fileInputRef.current.value = "";
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
        priority: "High",
        isHighlyImportant: true,
        sourceName: "The Hindu / PIB",
        sourceUrl: "",
        examRelevance: ["Prelims", "Mains"],
        applicableExams: ["UPSC", "APPSC", "TSPSC"],
        targetAudience: "all",
        assignedBatches: [],
        assignedStudentIds: [],
        attachments: []
      });
      setAlertState({
        isOpen: true,
        title: "Article Published",
        message: "Current Affairs article with attachments & target audience published successfully.",
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

  return (
    <div className="ca-root">
      {/* Header */}
      <div className="ca-header">
        <div>
          <span className="ca-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            </svg>
            UPSC / State PSC Daily Current Affairs & Daily GK
          </span>
          <h1 className="ca-title">Current Affairs & Editorial Analysis</h1>
          <p className="ca-sub">
            Curated daily exam-oriented briefs, dimensional analysis, multi-format handouts, and topic practice.
          </p>
        </div>

        {isAdmin && (
          <button className="ca-btn ca-btn-primary" onClick={() => setCreateModal(true)}>
            <PlusIcon size={15} style={{ marginRight: 4 }} /> Publish Article
          </button>
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
        </div>
      )}

      {/* Nav & Search */}
      <div className="ca-nav-bar">
        <div className="ca-tabs">
          <button
            className={`ca-tab ${viewTab === "articles" ? "active" : ""}`}
            onClick={() => { setViewTab("articles"); setActiveArticle(null); }}
          >
            All Articles
          </button>
          <button
            className={`ca-tab ${viewTab === "bookmarks" ? "active" : ""}`}
            onClick={() => setViewTab("bookmarks")}
          >
            <BookmarkIcon size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} filled={viewTab === "bookmarks"} />
            Bookmarked ({bookmarkedIds.size})
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
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {loading ? (
          <div className="ca-loading">
            <div className="ca-spinner" />
            <span>Loading Current Affairs feed...</span>
          </div>
        ) : activeArticle ? (
          /* Reader View */
          <div className="ca-reader-container">
            <div className="ca-reader-topbar">
              <button
                className="ca-btn ca-btn-secondary ca-btn-sm"
                onClick={() => setActiveArticle(null)}
              >
                ← Back to Articles
              </button>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
                  <button
                    style={{ border: "none", background: fontSize === "normal" ? "#fff" : "transparent", padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", cursor: "pointer" }}
                    onClick={() => setFontSize("normal")}
                  >
                    A
                  </button>
                  <button
                    style={{ border: "none", background: fontSize === "large" ? "#fff" : "transparent", padding: "4px 8px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer", fontWeight: "bold" }}
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
                  <BookmarkIcon size={14} style={{ marginRight: 4, verticalAlign: "-1px" }} filled={bookmarkedIds.has(activeArticle.id)} />
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

            {activeArticle.detailedExplanation && (
              <div className="ca-reader-body" style={{ fontSize: fontSize === "large" ? "1.05rem" : "0.92rem" }}>
                <h3>In-Depth Analysis & Dimensions</h3>
                <p>{activeArticle.detailedExplanation}</p>
              </div>
            )}

            {/* Attached Documents in Reader */}
            {activeArticle.attachments && activeArticle.attachments.length > 0 && (
              <div className="ca-attached-section">
                <h3>
                  <PaperclipIcon size={16} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                  Attached Handouts & Study Documents ({activeArticle.attachments.length})
                </h3>
                <div className="ca-attach-cards-grid">
                  {activeArticle.attachments.map((att, idx) => {
                    const badge = getFormatBadge(att.name);
                    return (
                      <a
                        key={idx}
                        className="ca-attach-download-card"
                        href={att.dataUrl || att.url || "#"}
                        download={att.name}
                        target="_blank"
                        rel="noreferrer"
                        title="Download Document"
                      >
                        <div className="ca-attach-info">
                          <span className="ca-attach-name">{att.name}</span>
                          <span className="ca-attach-meta">{formatFileSize(att.size)}</span>
                        </div>
                        <span className={`ca-fmt-pill ${badge.class}`}>{badge.label}</span>
                      </a>
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
                <button
                  className="ca-btn ca-btn-primary ca-btn-sm"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving..." : "Save Private Note"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Articles Grid */
          articles.length === 0 ? (
            <div className="ca-empty">
              <div className="ca-empty-icon">
                <BookOpenIcon size={36} color="#94a3b8" />
              </div>
              <h3>No current affairs briefs found</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Try selecting a different category or search term.
              </p>
            </div>
          ) : (
            <div className="ca-grid">
              {articles.map((art) => (
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
                      {art.examRelevance && art.examRelevance.map((r, i) => (
                        <span key={i} className="ca-chip-exam">{r}</span>
                      ))}
                      {art.attachments && art.attachments.length > 0 && (
                        <span className="ca-chip-attach">
                          <PaperclipIcon size={12} style={{ marginRight: 3, verticalAlign: "-1px" }} />
                          {art.attachments.length} {art.attachments.length === 1 ? "Doc" : "Docs"}
                        </span>
                      )}
                      {art.assignedBatches && art.assignedBatches.length > 0 && (
                        <span className="ca-chip-batch">
                          <TagIcon size={12} style={{ marginRight: 3, verticalAlign: "-1px" }} />
                          {art.assignedBatches.slice(0, 2).join(", ")}
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
                      <BookmarkIcon size={15} filled={bookmarkedIds.has(art.id)} color={bookmarkedIds.has(art.id) ? "#f59e0b" : "#94a3b8"} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Admin Create Article Modal */}
      {createModal && (
        <div className="ca-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreateModal(false); }}>
          <div className="ca-modal">
            <div className="ca-modal-header">
              <h3>Publish Daily Current Affairs & Handouts</h3>
              <button className="ca-modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>

            <div className="ca-modal-body">
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
                      <option key={c} value={c}>{c}</option>
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
                  <label>📎 Attach Study Documents & Handouts (Different Formats Supported)</label>
                  <div className="ca-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.epub,.png,.jpg,.jpeg,.webp"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                    />
                    <div className="ca-dropzone-icon">📁</div>
                    <strong>Click or Drag files to attach (PDF, DOCX, PPT, XLSX, TXT, Images)</strong>
                    <small>Multiple file uploads supported up to 50MB each</small>
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

                  {/* Batch Selection */}
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

                  {/* Exam Selection */}
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
