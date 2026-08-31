import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, apiGet, apiPost, apiPut, apiDelete, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import "./UserManagement.css";
import "./UserManagementFilters.css";

interface Student {
  id: string;
  name: string;
  email: string;
  userId: string;
  isActive: boolean;
  courseStream?: string;
  createdAt?: string;
  lastLoginAt?: string;
  attempts?: number;
  validUntil?: string;
  isExpired?: boolean;
  statusReason?: string;
  blockedDueTo?: string;
  statusUpdatedAt?: string;
}


interface BulkResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: Array<{ row: number; name: string; userId: string; email: string; reason: string }>;
}

const emptyForm = {
  name: "",
  email: "",
  userId: "",
  password: "",
  courseStream: "Banking PO/Clerk",
  validUntil: defaultStudentValidity(),
};

function defaultStudentValidity() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [attemptFilter, setAttemptFilter] = useState<"all" | "none" | "attempted" | "multiple">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "recent" | "inactive" | "never">("all");
  const [joinedFilter, setJoinedFilter] = useState<"all" | "week" | "month" | "older">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "attempts">("newest");

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText: string;
    variant: DialogVariant;
    icon?: string;
    action: () => Promise<void>;
  } | null>(null);


  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Bulk Excel Upload state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    try { 
      const response = await apiGet<{ users: Student[] }>("/admin/users"); 
      setStudents(response.users || []); 
    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadStudents(); }, []);

  const visible = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const fromTime = startDate ? new Date(startDate + "T00:00:00").getTime() : 0;
    const toTime = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;

    return students.filter(student => {
      const text = normalizeSearchText(`${student.name} ${student.userId} ${student.email}`);
      const attempts = student.attempts || 0;
      const lastLogin = student.lastLoginAt ? new Date(student.lastLoginAt).getTime() : 0;
      const joined = student.createdAt ? new Date(student.createdAt).getTime() : 0;
      
      const statusMatch = status === "all" || (status === "active" ? student.isActive : !student.isActive);
      const streamMatch = streamFilter === "all" || (student.courseStream || "Banking PO/Clerk").toLowerCase().includes(streamFilter.toLowerCase());
      const attemptMatch = attemptFilter === "all" || (attemptFilter === "none" ? attempts === 0 : attemptFilter === "attempted" ? attempts > 0 : attempts > 1);
      const activityMatch = activityFilter === "all" || (activityFilter === "never" ? !lastLogin : activityFilter === "recent" ? lastLogin >= now - 7 * day : !!lastLogin && lastLogin < now - 30 * day);
      const joinedMatch = joinedFilter === "all" || (joinedFilter === "week" ? joined >= now - 7 * day : joinedFilter === "month" ? joined >= now - 30 * day : !!joined && joined < now - 30 * day);
      const dateRangeMatch = (!startDate || joined >= fromTime) && (!endDate || joined <= toTime);

      return text.includes(normalizeSearchText(search)) && statusMatch && streamMatch && attemptMatch && activityMatch && joinedMatch && dateRangeMatch;
    }).sort((a, b) => {
      return sortBy === "name" 
        ? (a.name || a.userId).localeCompare(b.name || b.userId) 
        : sortBy === "attempts" 
        ? (b.attempts || 0) - (a.attempts || 0) 
        : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [students, search, status, streamFilter, attemptFilter, activityFilter, joinedFilter, startDate, endDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, currentPage, pageSize]);

  const active = students.filter(student => student.isActive).length;

  const hasActiveFilters = Boolean(
    search || status !== "all" || streamFilter !== "all" || attemptFilter !== "all" || activityFilter !== "all" || joinedFilter !== "all" || startDate || endDate || sortBy !== "newest"
  );

  const resetAllFilters = () => {
    setSearch("");
    setStatus("all");
    setStreamFilter("all");
    setAttemptFilter("all");
    setActivityFilter("all");
    setJoinedFilter("all");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
    setCurrentPage(1);
  };


  const handleExportCSV = () => {
    if (!visible || visible.length === 0) {
      alert("No student records available to export.");
      return;
    }
    const headers = ["Student Name", "Username", "Email", "Batch / Stream", "Attempts", "Joined Date", "Valid Until", "Last Login", "Status"];
    const rows = visible.map(s => [
      `"${(s.name || s.userId).replace(/"/g, '""')}"`,
      `"${s.userId.replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.courseStream || "Banking PO/Clerk").replace(/"/g, '""')}"`,
      s.attempts || 0,
      s.createdAt ? s.createdAt.slice(0, 10) : "",
      s.validUntil ? s.validUntil.slice(0, 10) : "",
      s.lastLoginAt ? s.lastLoginAt.slice(0, 10) : "",
      s.isActive ? "Active" : s.isExpired ? "Expired" : "Blocked"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Students_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAdd = () => { setForm(emptyForm); setAdding(true); setEditing(null); };
  const openEdit = (student: Student) => { 
    setForm({ 
      name: student.name || "", 
      email: student.email || "", 
      userId: student.userId, 
      password: "", 
      courseStream: student.courseStream || "Banking PO/Clerk",
      validUntil: student.validUntil ? student.validUntil.slice(0, 10) : defaultStudentValidity() 
    }); 
    setEditing(student); 
    setAdding(false); 
  };
  
  const closeModal = () => { setAdding(false); setEditing(null); setForm(emptyForm); };
  
  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editing && (!form.userId.trim() || form.password.length < 4))) return;
    setSaving(true);
    try {
      if (editing) await apiPut(`/admin/users/${editing.id}`, { name: form.name.trim(), email: form.email.trim(), courseStream: form.courseStream, validUntil: form.validUntil });
      else await apiPost("/admin/users", { ...form, role: "answerer" });
      closeModal(); 
      await loadStudents();
    } catch (error: any) { 
      alert(error?.message || "Student could not be saved."); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteStudent = (student: Student) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Student: ${student.name || student.userId}`,
      message: (
        <>
          Are you sure you want to permanently delete candidate <strong>{student.name || student.userId}</strong> (<code>{student.userId}</code>)?
          <br />
          <span style={{ color: "#ef4444", fontSize: "12px", marginTop: "6px", display: "inline-block" }}>
            ⚠️ All attempts, scorecards, and violation logs for this student will be deleted.
          </span>
        </>
      ),
      confirmText: "Yes, Delete Student",
      variant: "danger",
      icon: "🗑️",
      action: async () => {
        try {
          await apiDelete(`/admin/users/${student.id || student.userId}`);
          await loadStudents();
        } catch (error: any) {
          alert(error?.message || "Could not delete student.");
        }
      },
    });
  };

  const toggleBlock = (student: Student) => {
    const isBlocking = student.isActive;
    setConfirmDialog({
      isOpen: true,
      title: isBlocking ? "Block Candidate Access" : "Unblock Candidate Access",
      message: (
        <>
          Are you sure you want to {isBlocking ? "block" : "unblock"}{" "}
          <strong>{student.name}</strong> (<code>{student.userId}</code>)?
          <br />
          {isBlocking
            ? "They will not be able to log in or write tests until unblocked."
            : "Their portal access and exam eligibility will be restored."}
        </>
      ),
      confirmText: isBlocking ? "Yes, Block Candidate" : "Yes, Unblock Candidate",
      variant: isBlocking ? "danger" : "unblock",
      icon: isBlocking ? "🚫" : "🔓",
      action: async () => {
        try {
          await apiPut(`/admin/users/${student.id}/status`, { isActive: !student.isActive });
          await loadStudents();
        } catch (error: any) {
          alert(error?.message || `Could not update student status.`);
        }
      },
    });
  };


  const date = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const handleDownloadTemplate = (format: "xlsx" | "csv" = "xlsx") => {
    const url = `${API_BASE}/admin/users/template?format=${format}`;
    window.open(url, "_blank");
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const res = await apiPostForm<BulkResult>("/admin/users/bulk-upload", formData);
      setBulkResult(res);
      if (res.createdCount > 0) {
        await loadStudents();
      }
    } catch (error: any) {
      alert(error?.message || "Failed to process bulk Excel upload.");
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <section className="students-admin-page">
      <header className="students-page-head">
        <div>
          <span>STUDENT DIRECTORY</span>
          <h1>Students</h1>
          <p>Manage candidate accounts and examination access.</p>
        </div>
        <div className="students-page-actions">
          <button className="bulk-import-btn" onClick={() => { setBulkModalOpen(true); setBulkResult(null); setBulkFile(null); }}>
            📤 Bulk Upload (Excel)
          </button>
          <button className="add-student-btn" onClick={openAdd}>+ Add student</button>
        </div>
      </header>

      <div className="students-kpis">
        <button onClick={() => setStatus("all")}><span>Total students</span><strong>{students.length}</strong></button>
        <button onClick={() => setStatus("active")}><span>Active</span><strong>{active}</strong></button>
        <button onClick={() => setStatus("blocked")}><span>Blocked</span><strong>{students.length - active}</strong></button>
        <div><span>Total attempts</span><strong>{students.reduce((sum, student) => sum + (student.attempts || 0), 0)}</strong></div>
      </div>

      {/* Standalone Filter Card */}
      <div className="students-filter-card">
        <div className="students-filter-bar">
          <div className="filter-group main-search">
            <label>Search Users</label>
            <div className="filter-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search name, email or ID…" 
              />
              {search && <button type="button" className="clear-search-btn" onClick={() => setSearch("")}>✕</button>}
            </div>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="all">All statuses</option>
              <option value="active">Active students</option>
              <option value="blocked">Blocked students</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Batch / Stream</label>
            <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
              <option value="all">All Streams / Batches</option>
              <option value="Banking">Banking PO/Clerk</option>
              <option value="SSC">SSC CGL/CHSL</option>
              <option value="Combo">Banking + SSC Combo</option>
              <option value="Railway">RRB Railway</option>
              <option value="Civil">UPSC / Civil Services</option>
              <option value="General">General / Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Exam Attempts</label>
            <select value={attemptFilter} onChange={e => setAttemptFilter(e.target.value as any)}>
              <option value="all">All attempts</option>
              <option value="none">No attempts (0)</option>
              <option value="attempted">Attempted (1+)</option>
              <option value="multiple">Multiple (2+)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Login Activity</label>
            <select value={activityFilter} onChange={e => setActivityFilter(e.target.value as any)}>
              <option value="all">All activity</option>
              <option value="recent">Active this week</option>
              <option value="inactive">Inactive 30+ days</option>
              <option value="never">Never logged in</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Joined Preset</label>
            <select value={joinedFilter} onChange={e => {
              setJoinedFilter(e.target.value as any);
              if (e.target.value !== "all") { setStartDate(""); setEndDate(""); }
            }}>
              <option value="all">Any join date</option>
              <option value="week">Joined this week</option>
              <option value="month">Joined this month</option>
              <option value="older">Joined earlier</option>
            </select>
          </div>

          <div className="filter-group date-group">
            <label>Joined From</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setJoinedFilter("all"); }} 
              className="filter-date-input"
            />
          </div>

          <div className="filter-group date-group">
            <label>Joined To</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setJoinedFilter("all"); }} 
              className="filter-date-input"
            />
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="attempts">Most attempts</option>
            </select>
          </div>

          <div className="filter-group-end">
            {hasActiveFilters && (
              <button type="button" className="clear-filters-action-btn" onClick={resetAllFilters}>
                Clear Filters ✕
              </button>
            )}
            <button type="button" className="export-csv-btn" onClick={handleExportCSV}>
              📥 Export Data
            </button>
            <small className="records-count-badge">{visible.length} records</small>
          </div>
        </div>
      </div>

      {/* Standalone Student Table Card */}
      <div className="students-table-card">
        {loading ? (
          <div className="students-empty">Loading students…</div>
        ) : visible.length === 0 ? (
          <div className="students-empty">
            No students match this view. {hasActiveFilters && <button className="inline-reset-btn" onClick={resetAllFilters}>Reset Filters</button>}
          </div>
        ) : (
          <div className="students-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Batch / Stream</th>
                  <th>Attempts</th>
                  <th>Joined</th>
                  <th>Valid until</th>
                  <th>Last login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map(student => (
                  <tr key={student.id}>
                    <td>
                      <div className="student-cell">
                        <span>{(student.name || student.userId).charAt(0).toUpperCase()}</span>
                        <strong>{student.name || student.userId}</strong>
                      </div>
                    </td>
                    <td><code>{student.userId}</code></td>
                    <td>{student.email || "—"}</td>
                    <td>
                      <span className={`stream-tag stream-${
                        (student.courseStream || "").toLowerCase().includes("combo") ? "combo" :
                        (student.courseStream || "").toLowerCase().includes("ssc") ? "ssc" :
                        (student.courseStream || "").toLowerCase().includes("railway") || (student.courseStream || "").toLowerCase().includes("rrb") ? "railway" :
                        (student.courseStream || "").toLowerCase().includes("civil") || (student.courseStream || "").toLowerCase().includes("upsc") ? "upsc" :
                        "banking"
                      }`}>
                        {student.courseStream || "Banking PO/Clerk"}
                      </span>
                    </td>
                    <td>{student.attempts || 0}</td>
                    <td>{date(student.createdAt)}</td>
                    <td>{date(student.validUntil)}</td>
                    <td>{date(student.lastLoginAt)}</td>
                    <td>
                      <span className={`student-status ${student.isActive ? "active" : "blocked"}`}>
                        {student.isActive 
                          ? "● Active" 
                          : student.statusReason === "security_violation_screenshot"
                          ? "● Suspended (Screenshot)"
                          : student.statusReason === "security_violation_recording"
                          ? "● Suspended (Recording)"
                          : student.isExpired 
                          ? "● Expired" 
                          : "● Blocked"}
                      </span>
                    </td>
                    <td>
                      <div className="student-actions">
                        <button onClick={() => openEdit(student)}>Edit</button>
                        <button className={student.isActive ? "block" : "unblock"} onClick={() => toggleBlock(student)}>
                          {student.isActive ? "Block" : "Unblock"}
                        </button>
                        <button className="delete-student-btn" onClick={() => handleDeleteStudent(student)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Student Table Pagination */}
        {visible.length > 0 && (
          <div className="table-pagination-bar">
            <div className="pagination-info">
              Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
              <strong>{Math.min(currentPage * pageSize, visible.length)}</strong> of{" "}
              <strong>{visible.length}</strong> students
            </div>

            <div className="pagination-controls">
              <label className="page-size-picker">
                <span>Rows:</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <button
                type="button"
                className="page-nav-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ‹ Previous
              </button>

              <span className="page-current-indicator">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="page-nav-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Single Account Add/Edit Modal */}
      {(adding || editing) && (
        <div className="student-modal-backdrop" onMouseDown={closeModal}>
          <div className="student-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span className="modal-badge">{editing ? "EDIT STUDENT" : "NEW STUDENT"}</span>
                <h2>{editing ? editing.name : "Create student account"}</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeModal} aria-label="Close modal">×</button>
            </header>
            <div className="student-form">
              <label>
                Full name
                <input
                  type="text"
                  placeholder="e.g. Adithya Kumar"
                  value={form.name}
                  onChange={event => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  placeholder="e.g. adithya@victory.com"
                  value={form.email}
                  onChange={event => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label>
                Username
                <input
                  type="text"
                  disabled={!!editing}
                  placeholder="Unique login ID"
                  value={form.userId}
                  onChange={event => setForm({ ...form, userId: event.target.value })}
                />
              </label>
              <label>
                Enrolled Course / Batch
                <select
                  className="student-course-select"
                  value={form.courseStream || "Banking PO/Clerk"}
                  onChange={event => setForm({ ...form, courseStream: event.target.value })}
                >
                  <option value="Banking PO/Clerk">Banking PO/Clerk (Prelims + Mains)</option>
                  <option value="SSC CGL/CHSL">SSC CGL/CHSL (Tier 1 & 2)</option>
                  <option value="Banking + SSC Combo">Banking + SSC Combo Comprehensive</option>
                  <option value="RRB Railway NTPC/Group D">RRB Railway NTPC/Group D</option>
                  <option value="UPSC & State PSC">UPSC & State PSC Civil Services</option>
                  <option value="General Aptitude">General Aptitude & Placement Training</option>
                </select>
              </label>
              {!editing && (
                <label>
                  Temporary password
                  <input
                    type="password"
                    value={form.password}
                    onChange={event => setForm({ ...form, password: event.target.value })}
                    placeholder="Minimum 4 characters"
                  />
                </label>
              )}
              <label>
                Account valid until
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.validUntil}
                  onChange={event => setForm({ ...form, validUntil: event.target.value })}
                />
              </label>
            </div>
            <footer>
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="button" className="save" disabled={saving} onClick={save}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create student"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Bulk Excel Upload Modal */}
      {bulkModalOpen && (
        <div className="student-modal-backdrop" onMouseDown={() => setBulkModalOpen(false)}>
          <div className="student-modal bulk-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span>EXCEL BULK IMPORT</span>
                <h2>Bulk Create Student Accounts</h2>
              </div>
              <button onClick={() => setBulkModalOpen(false)}>×</button>
            </header>

            <div className="bulk-modal-body">
              <div className="template-banner">
                <div className="template-info">
                  <span className="template-icon">📊</span>
                  <div>
                    <strong>Need the Excel Template?</strong>
                    <p>Download pre-formatted template prefilled with headers & sample entries.</p>
                  </div>
                </div>
                <div className="template-actions">
                  <button type="button" className="template-btn xlsx" onClick={() => handleDownloadTemplate("xlsx")}>
                    📥 Excel Template (.xlsx)
                  </button>
                  <button type="button" className="template-btn csv" onClick={() => handleDownloadTemplate("csv")}>
                    📄 CSV Template
                  </button>
                </div>
              </div>

              {!bulkResult ? (
                <div
                  className={`bulk-dropzone ${dragOver ? "drag-over" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setBulkFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <input
                    type="file"
                    id="bulk-excel-input"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setBulkFile(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="dropzone-icon">📑</div>
                  <h4 className="dropzone-title">
                    {bulkFile ? bulkFile.name : "Drag & drop your Excel document here"}
                  </h4>
                  <p className="dropzone-sub">Supports Excel (.xlsx, .xls) and CSV (.csv) files</p>

                  <label htmlFor="bulk-excel-input" className="choose-file-btn">
                    📂 {bulkFile ? "Change File" : "Choose Excel Document"}
                  </label>

                  {bulkFile && (
                    <div className="selected-file-badge">
                      <span>📄 {bulkFile.name} ({(bulkFile.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={() => setBulkFile(null)}>✕</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bulk-result-section">
                  <div className={`results-summary-card ${bulkResult.failedCount === 0 ? "success" : "warning"}`}>
                    <div className="result-stat">
                      <span className="label">Total Rows</span>
                      <span className="val">{bulkResult.totalRows}</span>
                    </div>
                    <div className="result-stat success">
                      <span className="label">Created Successfully</span>
                      <span className="val">✓ {bulkResult.createdCount}</span>
                    </div>
                    <div className="result-stat danger">
                      <span className="label">Failed / Skipped</span>
                      <span className="val">{bulkResult.failedCount}</span>
                    </div>
                  </div>

                  {bulkResult.errors && bulkResult.errors.length > 0 && (
                    <div className="bulk-error-list">
                      <h4>Skipped Rows ({bulkResult.errors.length}):</h4>
                      <div className="error-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Name</th>
                              <th>Username</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResult.errors.map((err, idx) => (
                              <tr key={idx}>
                                <td>#{err.row}</td>
                                <td>{err.name || "—"}</td>
                                <td><code>{err.userId}</code></td>
                                <td className="err-reason">{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer>
              <button onClick={() => setBulkModalOpen(false)}>
                {bulkResult ? "Close" : "Cancel"}
              </button>
              {!bulkResult && (
                <button
                  className="save"
                  disabled={!bulkFile || bulkUploading}
                  onClick={handleBulkUpload}
                >
                  {bulkUploading ? "Uploading & Importing…" : "Upload & Create Students"}
                </button>
              )}
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
            const action = confirmDialog.action;
            setConfirmDialog(null);
            await action();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </section>
  );
};

export default UserManagement;

