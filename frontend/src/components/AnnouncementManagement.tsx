import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import AlertDialog, { AlertVariant } from "./AlertDialog";
import "./AnnouncementManagement.css";

interface Announcement {
  id: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  publishAt: string;
  expiresAt: string;
  createdAt?: string;
  assignedCount: number;
  assignedUserIds: string[];
}

interface Student {
  name: string;
  userId: string;
  email: string;
  batch?: string;
}

interface BatchItem {
  name: string;
  courseStream?: string;
  joiningDate?: string;
  studentCount?: number;
}

const toInputDateTime = (value: string) => value ? value.slice(0, 16) : "";

const announcementState = (item: Announcement) => {
  const now = Date.now();
  const start = new Date(item.publishAt || item.createdAt || Date.now()).getTime();
  const end = item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity;
  return start > now ? "scheduled" : end < now ? "expired" : "published";
};

const AnnouncementManagement: React.FC = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<Announcement | null>(null);
  const [assignMode, setAssignMode] = useState<"students" | "batches">("students");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [studentBatchFilter, setStudentBatchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [notice, setNotice] = useState("");

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

  const imageRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [a, u, bRes] = await Promise.all([
      apiGet<{ announcements: Announcement[] }>("/admin/announcements"),
      apiGet<{ users: Student[] }>("/admin/users"),
      apiGet<{ batches: BatchItem[] }>("/admin/users/batches").catch(() => ({ batches: [] }))
    ]);
    setItems(a.announcements || []);
    setStudents(u.users || []);
    setBatches(bRes.batches || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const visibleStudents = useMemo(() => {
    const query = normalizeSearchText(studentSearch);
    return students.filter(s => {
      const matchesQuery = normalizeSearchText(`${s.name} ${s.userId} ${s.email}`).includes(query);
      const matchesBatch = studentBatchFilter === "all" || (s.batch || "Batch-A") === studentBatchFilter;
      return matchesQuery && matchesBatch;
    });
  }, [students, studentSearch, studentBatchFilter]);

  const visibleBatches = useMemo(() => {
    const query = normalizeSearchText(batchSearch);
    return batches.filter(b => 
      normalizeSearchText(`${b.name} ${b.courseStream || ""}`).includes(query)
    );
  }, [batches, batchSearch]);

  const handleToggleBatch = (batchName: string) => {
    const batchStudents = students.filter(s => (s.batch || "Batch-A") === batchName);
    const batchStudentIds = batchStudents.map(s => s.userId);
    const isCurrentlySelected = selectedBatches.includes(batchName);

    if (isCurrentlySelected) {
      setSelectedBatches(prev => prev.filter(b => b !== batchName));
      setSelected(prev => prev.filter(id => !batchStudentIds.includes(id)));
    } else {
      setSelectedBatches(prev => [...prev, batchName]);
      setSelected(prev => Array.from(new Set([...prev, ...batchStudentIds])));
    }
  };

  const handleSelectAllBatches = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allBatchNames = visibleBatches.map(b => b.name);
      setSelectedBatches(Array.from(new Set([...selectedBatches, ...allBatchNames])));
      const studentsInBatches = students.filter(s => allBatchNames.includes(s.batch || "Batch-A")).map(s => s.userId);
      setSelected(Array.from(new Set([...selected, ...studentsInBatches])));
    } else {
      const visibleNames = new Set(visibleBatches.map(b => b.name));
      setSelectedBatches(selectedBatches.filter(name => !visibleNames.has(name)));
      const studentsInVisibleBatches = new Set(students.filter(s => visibleNames.has(s.batch || "Batch-A")).map(s => s.userId));
      setSelected(selected.filter(id => !studentsInVisibleBatches.has(id)));
    }
  };

  const filtered = useMemo(() => items.filter(item => 
    normalizeSearchText(`${item.title} ${item.message} ${item.linkUrl}`).includes(normalizeSearchText(search)) && 
    (status === "all" || status === announcementState(item))
  ), [items, search, status]);

  const publish = async () => {
    setNotice("");
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage) {
      setNotice("Please fill in both title and message before publishing.");
      return;
    }
    if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
      setNotice("Expiration date must be after the publish date.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("title", cleanTitle);
      body.append("message", cleanMessage);
      body.append("linkUrl", linkUrl.trim());
      if (publishAt) body.append("publishAt", new Date(publishAt).toISOString());
      if (expiresAt) body.append("expiresAt", new Date(expiresAt).toISOString());
      if (image) body.append("image", image);
      await apiPostForm("/admin/announcements", body);
      setTitle(""); setMessage(""); setLinkUrl(""); setImage(null); setPublishAt(""); setExpiresAt(""); setShowLink(false); setShowImage(false);
      if (imageRef.current) imageRef.current.value = "";
      setNotice("✓ Announcement created and published successfully.");
      await load();
    } catch (e: any) {
      setAlertDialog({
        isOpen: true,
        title: "Announcement Error",
        message: e?.message || "Announcement could not be published",
        variant: "danger"
      });
    } finally {
      setUploading(false);
    }
  };

  const openAssign = (item: Announcement) => {
    setAssigning(item);
    const assigned = item.assignedUserIds || [];
    setSelected(assigned);
    setStudentSearch("");
    setBatchSearch("");
    setStudentBatchFilter("all");
    setAssignMode("students");

    if (batches.length > 0 && assigned.length > 0) {
      const activeBatches = batches
        .filter(b => {
          const bStudents = students.filter(s => (s.batch || "Batch-A") === b.name);
          return bStudents.length > 0 && bStudents.every(s => assigned.includes(s.userId));
        })
        .map(b => b.name);
      setSelectedBatches(activeBatches);
    } else {
      setSelectedBatches([]);
    }
  };

  const save = async () => {
    if (!assigning) return;
    try {
      await apiPost(`/admin/announcements/${assigning.id}/assign`, {
        userIds: selected,
        batches: selectedBatches
      });
      setAssigning(null);
      setNotice("Announcement assignment updated.");
      await load();
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Assignment Error",
        message: error?.message || "Announcement assignment could not be saved.",
        variant: "danger"
      });
    }
  };

  const remove = (item: Announcement) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Announcement",
      message: (
        <>
          Are you sure you want to delete announcement <strong>"{item.title}"</strong>?
          <br />
          This notice will be permanently removed from candidate boards.
        </>
      ),
      confirmText: "Yes, Delete Announcement",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiDelete(`/admin/announcements/${item.id}`);
          setNotice("Announcement deleted successfully.");
          await load();
        } catch(err: any) {
          setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            message: err?.message || "Could not delete announcement.",
            variant: "danger"
          });
        }
      }
    });
  };

  return (
    <section className="announcement-admin">
      <header className="announcement-page-header">
        <div>
          <span className="announcement-eyebrow">STUDENT COMMUNICATIONS</span>
          <h1>Announcements & Broadcasts</h1>
          <p>Publish immediate notices or schedule time-locked broadcast updates across student portals.</p>
        </div>
      </header>

      {/* Modern Composer Card */}
      <div className="announcement-composer-card">
        <div className="composer-header-row">
          <div className="composer-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="composer-header-text">
            <h3>Create Announcement</h3>
            <p>Publish immediately or schedule an automated notice for enrolled candidates.</p>
          </div>
        </div>

        <form onSubmit={e => { e.preventDefault(); void publish(); }} className="announcement-form-grid">
          <div className="ann-form-group">
            <label>Announcement Title <span className="ann-req-star">*</span></label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Upcoming Full Length Mock Exam Schedule Announced"
              required
            />
          </div>

          <div className="ann-form-group">
            <label>Announcement Message <span className="ann-req-star">*</span></label>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              placeholder="Write the complete broadcast message details for candidates…"
              required
            />
          </div>

          {/* Attachments Section */}
          <div className="ann-attachments-strip">
            <button 
              type="button" 
              className={`ann-attachment-toggle-btn ${showLink ? "active" : ""}`} 
              onClick={() => setShowLink(v => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>{showLink ? "Remove Link" : "Attach Link"}</span>
            </button>

            <button 
              type="button" 
              className={`ann-attachment-toggle-btn ${showImage ? "active" : ""}`} 
              onClick={() => setShowImage(v => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>{showImage ? "Remove Image" : "Upload Banner Image"}</span>
            </button>
          </div>

          {showLink && (
            <div className="ann-form-group">
              <label>External Link URL</label>
              <input 
                type="url" 
                value={linkUrl} 
                onChange={e => setLinkUrl(e.target.value)} 
                placeholder="https://example.com/mock-schedule-details"
              />
            </div>
          )}

          {showImage && (
            <div className="ann-image-picker-box">
              <input 
                ref={imageRef} 
                type="file" 
                accept=".png,.jpg,.jpeg" 
                style={{ display: "none" }}
                onChange={e => setImage(e.target.files?.[0] || null)}
              />
              <button 
                type="button" 
                className="btn-ann-browse" 
                onClick={() => imageRef.current?.click()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Choose Image File
              </button>
              <span className="ann-chosen-image-name">{image ? image.name : "No image selected (PNG, JPG)"}</span>
              {image && (
                <button 
                  type="button" 
                  className="btn-ann-remove-file" 
                  onClick={() => {
                    setImage(null);
                    if (imageRef.current) imageRef.current.value = "";
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Schedule & Action Row */}
          <div className="ann-schedule-action-row">
            <div className="ann-form-group">
              <label>Publish From</label>
              <input 
                type="datetime-local" 
                value={toInputDateTime(publishAt)} 
                onChange={e => setPublishAt(e.target.value)} 
              />
              <small className="help-text">Leave empty to publish immediately</small>
            </div>

            <div className="ann-form-group">
              <label>Expire On</label>
              <input 
                type="datetime-local" 
                value={toInputDateTime(expiresAt)} 
                onChange={e => setExpiresAt(e.target.value)} 
              />
              <small className="help-text">Optional end date for unpublishing</small>
            </div>

            <button 
              type="submit" 
              className="btn-publish-submit" 
              disabled={uploading || !title.trim() || !message.trim()} 
            >
              {uploading ? (
                <>
                  <span className="upload-spinner"></span>
                  <span>Publishing…</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  <span>Publish Announcement</span>
                </>
              )}
            </button>
          </div>

          {notice && <div className="announcement-notice-banner">{notice}</div>}
        </form>
      </div>

      {/* Filter Bar */}
      <div className="announcement-filters-bar">
        <div className="ann-search-wrapper">
          <span className="ann-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input 
            type="search" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search announcement title, message or link…"
          />
          {search && (
            <button 
              type="button" 
              className="ann-clear-search-btn" 
              onClick={() => setSearch("")}
            >
              ✕
            </button>
          )}
        </div>

        <div className="ann-filter-actions">
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
          </select>

          {(search || status !== "all") && (
            <button 
              type="button" 
              className="btn-ann-reset" 
              onClick={() => { setSearch(""); setStatus("all"); }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Announcement Grid */}
      <div className="announcement-grid">
        {filtered.map(item => {
          const state = announcementState(item);
          return (
            <article key={item.id} className="announcement-card-row">
              <div className="ann-badge-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="ann-badge-label">NOTICE</span>
              </div>

              <div className="ann-details-col">
                <h3 className="ann-title-text">{item.title}</h3>
                <p className="ann-message-text">{item.message}</p>
                <div className="ann-chips-row">
                  <span className={`ann-status-chip ${state}`}>
                    <span className="ann-status-dot" />
                    {state}
                  </span>
                  {item.publishAt && (
                    <span className="ann-meta-chip">
                      Publish: {new Date(item.publishAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                  {item.expiresAt && (
                    <span className="ann-meta-chip">
                      Expires: {new Date(item.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                  {item.linkUrl && (
                    <span className="ann-meta-chip">
                      Link attached
                    </span>
                  )}
                </div>
              </div>

              <div className="ann-assigned-stat-box">
                <strong className="ann-stat-num">{item.assignedCount}</strong>
                <span className="ann-stat-label">students</span>
              </div>

              <div className="ann-row-actions">
                <button type="button" className="btn-ann-assign" onClick={() => openAssign(item)}>
                  Assign
                </button>
                <button type="button" className="btn-ann-delete" onClick={() => remove(item)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="announcement-empty-card">
            <h3>No announcements match these filters</h3>
            <p>Create your first broadcast notice using the composer form above or clear your active filters.</p>
          </div>
        )}
      </div>

      {/* Dual Mode Assignment Modal: Specific Candidates & Cohorts/Batches */}
      {assigning && (
        <div className="document-modal-backdrop" onMouseDown={() => setAssigning(null)}>
          <div className="document-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span>ASSIGN ANNOUNCEMENT</span>
                <h2>{assigning.title}</h2>
              </div>
              <button type="button" onClick={() => setAssigning(null)} aria-label="Close modal">✕</button>
            </header>

            {/* Mode Switcher Tabs */}
            <div className="ann-assign-tabs">
              <button
                type="button"
                className={`ann-assign-tab-btn ${assignMode === "students" ? "active" : ""}`}
                onClick={() => setAssignMode("students")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Specific Candidates ({selected.length})
              </button>
              <button
                type="button"
                className={`ann-assign-tab-btn ${assignMode === "batches" ? "active" : ""}`}
                onClick={() => setAssignMode("batches")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Assign by Cohort / Batch ({selectedBatches.length})
              </button>
            </div>

            {assignMode === "students" ? (
              <div className="ann-assign-body">
                <div className="ann-filter-strip">
                  <input 
                    type="text" 
                    className="student-search-input" 
                    placeholder="Search candidate name, ID or email…" 
                    value={studentSearch} 
                    onChange={e => setStudentSearch(e.target.value)} 
                  />
                  {batches.length > 0 && (
                    <select
                      className="ann-batch-filter-select"
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
                  {visibleStudents.map(s => {
                    const isChecked = selected.includes(s.userId);
                    return (
                      <label key={s.userId} className={`ann-student-item ${isChecked ? "selected" : ""}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={e => setSelected(e.target.checked ? [...selected, s.userId] : selected.filter(id => id !== s.userId))} 
                        />
                        <div className="ann-student-avatar">{s.name.charAt(0).toUpperCase()}</div>
                        <div className="ann-student-info">
                          <strong>{s.name}</strong>
                          <small>{s.userId} • {s.email} {s.batch ? `• ${s.batch}` : ""}</small>
                        </div>
                      </label>
                    );
                  })}
                  {visibleStudents.length === 0 && (
                    <div className="ann-empty-selection">No candidates match the current search or batch filter.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ann-assign-body">
                <div className="ann-filter-strip">
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
                      <label key={batch.name} className={`ann-batch-card-item ${isChecked ? "selected" : ""}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleBatch(batch.name)} 
                        />
                        <div className="ann-batch-info">
                          <div className="ann-batch-title-row">
                            <strong className="ann-batch-name">{batch.name}</strong>
                            <span className="ann-batch-badge">{batch.studentCount || 0} candidates</span>
                          </div>
                          <div className="ann-batch-meta">
                            <span>Course: {batch.courseStream || "Banking PO/Clerk"}</span>
                            {batch.joiningDate && <span> • Joined: {batch.joiningDate}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {visibleBatches.length === 0 && (
                    <div className="ann-empty-selection">No academic batches or cohorts found.</div>
                  )}
                </div>
              </div>
            )}

            <footer>
              <span className="ann-selected-summary">
                <strong>{selected.length}</strong> candidates selected {selectedBatches.length > 0 && `(across ${selectedBatches.length} cohorts)`}
              </span>
              <button type="button" className="btn-save-assignment" onClick={save}>
                Assign Announcement
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

export default AnnouncementManagement;

