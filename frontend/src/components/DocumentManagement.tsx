import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import AlertDialog, { AlertVariant } from "./AlertDialog";
import "./DocumentManagement.css";

interface Doc {
  id: string;
  title: string;
  description: string;
  originalName: string;
  size: number;
  createdAt: string;
  assignedCount: number;
  assignedUserIds: string[];
}

interface Student {
  name: string;
  userId: string;
  email: string;
  isActive: boolean;
  batch?: string;
  courseStream?: string;
}

interface BatchItem {
  name: string;
  studentCount?: number;
  activeCount?: number;
  courseStream?: string;
  joiningDate?: string;
  startDate?: string;
  endDate?: string;
}

const DocumentManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<Doc | null>(null);
  const [assignMode, setAssignMode] = useState<"students" | "batches">("students");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [studentBatchFilter, setStudentBatchFilter] = useState("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [feedbackNotice, setFeedbackNotice] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText: string;
    variant: DialogVariant;
    icon?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    variant?: AlertVariant;
    icon?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [docs, users, batchRes] = await Promise.all([
      apiGet<{ documents: Doc[] }>("/admin/documents"),
      apiGet<{ users: Student[] }>("/admin/users"),
      apiGet<{ batches: BatchItem[] }>("/admin/users/batches").catch(() => ({ batches: [] }))
    ]);
    setDocuments(docs.documents || []);
    setStudents(users.users || []);
    setBatches(batchRes.batches || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const visibleStudents = useMemo(() => {
    const query = normalizeSearchText(studentSearch);
    return students.filter(student => {
      const matchesQuery = normalizeSearchText(`${student.name} ${student.userId} ${student.email}`).includes(query);
      const matchesBatch = studentBatchFilter === "all" || (student.batch || "Batch-A") === studentBatchFilter;
      return matchesQuery && matchesBatch;
    });
  }, [students, studentSearch, studentBatchFilter]);

  const visibleBatches = useMemo(() => {
    const query = normalizeSearchText(batchSearch);
    return batches.filter(b => 
      normalizeSearchText(`${b.name} ${b.courseStream || ""}`).includes(query)
    );
  }, [batches, batchSearch]);

  const filteredDocuments = useMemo(() => documents.filter(doc => {
    const matchesSearch = normalizeSearchText(`${doc.title} ${doc.description} ${doc.originalName}`).includes(normalizeSearchText(documentSearch));
    const extension = doc.originalName.split(".").pop()?.toLowerCase() || "";
    const matchesType = fileType === "all" || (
      fileType === "pdf" ? extension === "pdf" : 
      fileType === "image" ? ["png", "jpg", "jpeg"].includes(extension) : 
      !["pdf", "png", "jpg", "jpeg"].includes(extension)
    );
    const matchesAssignment = assignment === "all" || (
      assignment === "assigned" ? doc.assignedCount > 0 : doc.assignedCount === 0
    );
    return matchesSearch && matchesType && matchesAssignment;
  }), [documents, documentSearch, fileType, assignment]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("description", description.trim());

      await apiPostForm("/admin/documents", formData);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFeedbackNotice("✓ Document uploaded successfully.");
      await load();
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Upload Failed",
        message: error?.message || "Document upload could not be completed.",
        variant: "danger",
        icon: "🚫"
      });
    } finally {
      setUploading(false);
    }
  };

  const openAssign = (doc: Doc) => {
    setAssigning(doc);
    const assigned = doc.assignedUserIds || [];
    setSelected(assigned);
    setStudentSearch("");
    setBatchSearch("");
    setStudentBatchFilter("all");
    setAssignMode("students");

    if (batches.length > 0 && assigned.length > 0) {
      const activeBatches = batches.filter(b => {
        const batchStudentIds = students.filter(s => (s.batch || "Batch-A") === b.name).map(s => s.userId);
        return batchStudentIds.length > 0 && batchStudentIds.every(id => assigned.includes(id));
      }).map(b => b.name);
      setSelectedBatches(activeBatches);
    } else {
      setSelectedBatches([]);
    }
  };

  const handleToggleBatch = (batchName: string) => {
    const isSelected = selectedBatches.includes(batchName);
    const nextBatches = isSelected
      ? selectedBatches.filter(b => b !== batchName)
      : [...selectedBatches, batchName];
    setSelectedBatches(nextBatches);

    const batchStudents = students.filter(s => (s.batch || "Batch-A") === batchName).map(s => s.userId);
    if (isSelected) {
      const otherSelectedBatchStudents = new Set(
        students.filter(s => nextBatches.includes(s.batch || "Batch-A")).map(s => s.userId)
      );
      setSelected(prev => prev.filter(id => otherSelectedBatchStudents.has(id) || !batchStudents.includes(id)));
    } else {
      setSelected(prev => Array.from(new Set([...prev, ...batchStudents])));
    }
  };

  const handleSelectAllBatches = () => {
    const allVisSelected = visibleBatches.length > 0 && visibleBatches.every(b => selectedBatches.includes(b.name));
    if (allVisSelected) {
      const visNames = new Set(visibleBatches.map(b => b.name));
      const nextBatches = selectedBatches.filter(b => !visNames.has(b));
      setSelectedBatches(nextBatches);
      const remainingStudents = new Set(
        students.filter(s => nextBatches.includes(s.batch || "Batch-A")).map(s => s.userId)
      );
      setSelected(prev => prev.filter(id => remainingStudents.has(id)));
    } else {
      const nextBatches = Array.from(new Set([...selectedBatches, ...visibleBatches.map(b => b.name)]));
      setSelectedBatches(nextBatches);
      const addedStudents = students.filter(s => nextBatches.includes(s.batch || "Batch-A")).map(s => s.userId);
      setSelected(prev => Array.from(new Set([...prev, ...addedStudents])));
    }
  };

  const saveAssignments = async () => {
    if (!assigning) return;
    try {
      await apiPost(`/admin/documents/${assigning.id}/assign`, { userIds: selected });
      setAssigning(null);
      setFeedbackNotice("✓ Document assignments updated.");
      await load();
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Assignment Failed",
        message: error?.message || "Could not update document assignments.",
        variant: "danger",
        icon: "🚫"
      });
    }
  };

  const remove = (doc: Doc) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Document",
      message: (
        <>
          Are you sure you want to permanently delete document <strong>"{doc.title}"</strong>?
          <br />
          Candidates will no longer be able to view or download this resource.
        </>
      ),
      confirmText: "Yes, Delete Document",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        try {
          await apiDelete(`/admin/documents/${doc.id}`);
          setFeedbackNotice("Document deleted.");
          await load();
        } catch (error: any) {
          setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            message: error?.message || "Could not delete document.",
            variant: "danger"
          });
        }
      }
    });
  };

  return (
    <section className="document-admin">
      <header className="document-header">
        <div>
          <span>RESOURCE HUB</span>
          <h1>Document Management</h1>
          <p>Share curated study notes, syllabus blueprints, and offline guides with candidates.</p>
        </div>
      </header>

      {feedbackNotice && (
        <div className="document-feedback-banner">
          <span>{feedbackNotice}</span>
          <button type="button" onClick={() => setFeedbackNotice("")}>✕</button>
        </div>
      )}

      {/* Upload Card */}
      <form className="document-upload-card" onSubmit={upload}>
        <div className="upload-header">
          <div className="upload-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div className="upload-header-text">
            <h3>Upload Learning Material</h3>
            <p>Files are stored in the secure document vault and can be distributed to cohorts or individual students.</p>
          </div>
        </div>

        <div className="document-fields-grid">
          <div className="doc-field-group">
            <label>Document Title <span className="doc-req-star">*</span></label>
            <input
              type="text"
              placeholder="e.g. Quantitative Aptitude Shortcuts & Formulas"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="doc-field-group">
            <label>Description / Study Notes Topic</label>
            <input
              type="text"
              placeholder="e.g. Tier-1 Quick Reference, Chapter 1-5 Formula Sheets"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="upload-action-row">
          <div className="custom-file-picker-box">
            <input
              type="file"
              id="doc-file-input"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              required
            />
            <button
              type="button"
              className="btn-browse-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Choose File
            </button>
            <div className="file-status-label">
              {file ? (
                <span className="chosen-file-tag">
                  <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  <button
                    type="button"
                    className="btn-clear-chosen-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    title="Remove selected file"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="file-placeholder-text">
                  No file chosen · Supports PDF, DOCX, XLSX, Images (Max 25MB)
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-upload-submit"
            disabled={uploading || !file || !title.trim()}
          >
            {uploading ? (
              <>
                <span className="upload-spinner"></span>
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <span>Upload</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Filter Row */}
      <div className="document-filters-bar">
        <div className="doc-search-wrapper">
          <span className="doc-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search documents by title, description or file name…"
            value={documentSearch}
            onChange={e => setDocumentSearch(e.target.value)}
          />
          {documentSearch && (
            <button
              type="button"
              className="doc-clear-search-btn"
              onClick={() => setDocumentSearch("")}
            >
              ✕
            </button>
          )}
        </div>

        <div className="doc-filter-dropdowns">
          <div className="doc-select-wrap">
            <select value={fileType} onChange={e => setFileType(e.target.value)}>
              <option value="all">All File Types</option>
              <option value="pdf">PDF Documents</option>
              <option value="image">Images (PNG, JPG)</option>
              <option value="other">Other Formats</option>
            </select>
          </div>

          <div className="doc-select-wrap">
            <select value={assignment} onChange={e => setAssignment(e.target.value)}>
              <option value="all">All Assignment States</option>
              <option value="assigned">Assigned to Candidates</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {(documentSearch || fileType !== "all" || assignment !== "all") && (
            <button
              type="button"
              className="btn-reset-doc-filters"
              onClick={() => {
                setDocumentSearch("");
                setFileType("all");
                setAssignment("all");
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Document Grid */}
      <div className="document-grid">
        {filteredDocuments.map(doc => {
          const ext = doc.originalName.split(".").pop()?.toUpperCase() || "DOC";
          const isPdf = ext === "PDF";
          const isImg = ["PNG", "JPG", "JPEG"].includes(ext);
          return (
            <article key={doc.id} className="document-card-row">
              <div className={`doc-icon-badge ${isPdf ? "badge-pdf" : isImg ? "badge-img" : "badge-doc"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ext-icon-svg">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="ext-label">{ext}</span>
              </div>

              <div className="doc-details-col">
                <div className="doc-title-row">
                  <h3 className="doc-title-text">{doc.title}</h3>
                  <span className="doc-filename-badge">{doc.originalName}</span>
                </div>
                {doc.description && (
                  <p className="doc-description-text">{doc.description}</p>
                )}
                <div className="doc-chips-row">
                  <span className="doc-meta-chip">
                    Size: {(doc.size / 1024).toFixed(1)} KB
                  </span>
                  <span className="doc-meta-chip">
                    Uploaded: {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span className={`doc-status-chip ${doc.assignedCount > 0 ? "assigned" : "unassigned"}`}>
                    <span className="status-dot" />
                    {doc.assignedCount > 0 ? `Assigned (${doc.assignedCount})` : "Unassigned"}
                  </span>
                </div>
              </div>

              <div className="doc-assigned-stat-box">
                <strong className="doc-stat-num">{doc.assignedCount}</strong>
                <span className="doc-stat-label">students</span>
              </div>

              <div className="doc-row-actions">
                <button
                  type="button"
                  className="btn-doc-assign"
                  onClick={() => openAssign(doc)}
                >
                  Assign
                </button>
                <button
                  type="button"
                  className="btn-doc-delete"
                  onClick={() => remove(doc)}
                  title="Delete document permanently"
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {filteredDocuments.length === 0 && (
          <div className="document-empty-card">
            <div className="empty-icon-wrap">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>No documents found</h3>
            <p>
              {documents.length === 0
                ? "Upload your first study document or syllabus note using the form above."
                : "No learning materials match your current search and filter criteria."}
            </p>
          </div>
        )}
      </div>

      {/* Candidate / Batch Assignment Modal */}
      {assigning && (
        <div className="document-modal-backdrop" onMouseDown={() => setAssigning(null)}>
          <div className="document-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span className="modal-eyebrow">ASSIGN DOCUMENT ACCESS</span>
                <h2>{assigning.title}</h2>
              </div>
              <button type="button" className="doc-modal-close" onClick={() => setAssigning(null)}>×</button>
            </header>

            {/* Mode Switcher Tabs */}
            <div className="doc-assign-tab-nav">
              <button
                type="button"
                className={`doc-assign-tab-btn ${assignMode === "students" ? "active" : ""}`}
                onClick={() => setAssignMode("students")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                Individual Students ({selected.length})
              </button>
              <button
                type="button"
                className={`doc-assign-tab-btn ${assignMode === "batches" ? "active" : ""}`}
                onClick={() => setAssignMode("batches")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Assign by Cohort / Batch ({selectedBatches.length})
              </button>
            </div>

            {assignMode === "students" ? (
              <div className="doc-assign-body">
                <div className="doc-filter-strip">
                  <input 
                    type="text" 
                    className="student-search-input" 
                    placeholder="Search candidate name, ID or email…" 
                    value={studentSearch} 
                    onChange={e => setStudentSearch(e.target.value)} 
                  />
                  {batches.length > 0 && (
                    <select
                      className="doc-batch-filter-select"
                      value={studentBatchFilter}
                      onChange={e => setStudentBatchFilter(e.target.value)}
                    >
                      <option value="all">All Batches</option>
                      {batches.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <label className="select-all">
                  <input 
                    type="checkbox" 
                    checked={visibleStudents.length > 0 && visibleStudents.every(s => selected.includes(s.userId))} 
                    onChange={e => setSelected(e.target.checked ? Array.from(new Set([...selected, ...visibleStudents.map(s => s.userId)])) : selected.filter(id => !visibleStudents.some(s => s.userId === id)))} 
                  />
                  <span>Select all visible candidates ({visibleStudents.length})</span>
                </label>

                <div className="document-students">
                  {visibleStudents.map(student => (
                    <label key={student.userId} className={`doc-student-item ${selected.includes(student.userId) ? "selected" : ""}`}>
                      <input 
                        type="checkbox" 
                        checked={selected.includes(student.userId)} 
                        onChange={e => setSelected(e.target.checked ? [...selected, student.userId] : selected.filter(id => id !== student.userId))} 
                      />
                      <span className="student-info-col">
                        <strong>{student.name}</strong>
                        <small>{student.userId} • {student.email} • <span className="batch-pill-tiny">{student.batch || "Batch-A"}</span></small>
                      </span>
                    </label>
                  ))}
                  {visibleStudents.length === 0 && (
                    <div className="doc-empty-selection">No students match current search / batch filter.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="doc-assign-body">
                <div className="doc-filter-strip">
                  <input 
                    type="text" 
                    className="student-search-input" 
                    placeholder="Search batch or cohort name…" 
                    value={batchSearch} 
                    onChange={e => setBatchSearch(e.target.value)} 
                  />
                </div>

                <label className="select-all">
                  <input 
                    type="checkbox" 
                    checked={visibleBatches.length > 0 && visibleBatches.every(b => selectedBatches.includes(b.name))} 
                    onChange={handleSelectAllBatches} 
                  />
                  <span>Select all visible cohorts / batches ({visibleBatches.length})</span>
                </label>

                <div className="document-batches-list">
                  {visibleBatches.map(batch => {
                    const isChecked = selectedBatches.includes(batch.name);
                    return (
                      <label key={batch.name} className={`doc-batch-card-item ${isChecked ? "selected" : ""}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleBatch(batch.name)} 
                        />
                        <div className="doc-batch-info">
                          <div className="doc-batch-title-row">
                            <strong className="doc-batch-name">{batch.name}</strong>
                            <span className="doc-batch-badge">{batch.studentCount || 0} students</span>
                          </div>
                          <div className="doc-batch-meta">
                            <span>Course: {batch.courseStream || "Banking PO/Clerk"}</span>
                            {batch.joiningDate && <span> • Joined: {batch.joiningDate}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {visibleBatches.length === 0 && (
                    <div className="doc-empty-selection">No academic batches found.</div>
                  )}
                </div>
              </div>
            )}

            <footer>
              <span className="doc-selected-summary">
                <strong>{selected.length}</strong> candidates selected {selectedBatches.length > 0 && `(across ${selectedBatches.length} cohorts)`}
              </span>
              <button type="button" className="btn-save-assignment" onClick={saveAssignments}>
                Assign Document Access
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Screen Center Custom Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={async () => {
            const cb = confirmDialog.onConfirm;
            setConfirmDialog(null);
            await cb();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Screen Center Custom Alert Dialog */}
      {alertDialog && (
        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          variant={alertDialog.variant}
          icon={alertDialog.icon}
          onClose={() => setAlertDialog(null)}
        />
      )}
    </section>
  );
};

export default DocumentManagement;

