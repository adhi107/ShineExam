import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, apiGet, apiPost, apiPut, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import "./UserManagement.css";
import "./UserManagementFilters.css";

interface Student {
  id: string; name: string; email: string; userId: string; isActive: boolean;
  createdAt?: string; lastLoginAt?: string; attempts?: number; validUntil?: string; isExpired?: boolean;
}

interface BulkResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: Array<{ row: number; name: string; userId: string; email: string; reason: string }>;
}

const emptyForm = { name: "", email: "", userId: "", password: "", validUntil: defaultStudentValidity() };

function defaultStudentValidity() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
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
      const attemptMatch = attemptFilter === "all" || (attemptFilter === "none" ? attempts === 0 : attemptFilter === "attempted" ? attempts > 0 : attempts > 1);
      const activityMatch = activityFilter === "all" || (activityFilter === "never" ? !lastLogin : activityFilter === "recent" ? lastLogin >= now - 7 * day : !!lastLogin && lastLogin < now - 30 * day);
      const joinedMatch = joinedFilter === "all" || (joinedFilter === "week" ? joined >= now - 7 * day : joinedFilter === "month" ? joined >= now - 30 * day : !!joined && joined < now - 30 * day);
      const dateRangeMatch = (!startDate || joined >= fromTime) && (!endDate || joined <= toTime);

      return text.includes(normalizeSearchText(search)) && statusMatch && attemptMatch && activityMatch && joinedMatch && dateRangeMatch;
    }).sort((a, b) => {
      return sortBy === "name" 
        ? (a.name || a.userId).localeCompare(b.name || b.userId) 
        : sortBy === "attempts" 
        ? (b.attempts || 0) - (a.attempts || 0) 
        : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [students, search, status, attemptFilter, activityFilter, joinedFilter, startDate, endDate, sortBy]);

  const active = students.filter(student => student.isActive).length;

  const hasActiveFilters = Boolean(
    search || status !== "all" || attemptFilter !== "all" || activityFilter !== "all" || joinedFilter !== "all" || startDate || endDate || sortBy !== "newest"
  );

  const resetAllFilters = () => {
    setSearch("");
    setStatus("all");
    setAttemptFilter("all");
    setActivityFilter("all");
    setJoinedFilter("all");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
  };

  const handleExportCSV = () => {
    if (!visible || visible.length === 0) {
      alert("No student records available to export.");
      return;
    }
    const headers = ["Student Name", "Username", "Email", "Attempts", "Joined Date", "Valid Until", "Last Login", "Status"];
    const rows = visible.map(s => [
      `"${(s.name || s.userId).replace(/"/g, '""')}"`,
      `"${s.userId.replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
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
      if (editing) await apiPut(`/admin/users/${editing.id}`, { name: form.name.trim(), email: form.email.trim(), validUntil: form.validUntil });
      else await apiPost("/admin/users", { ...form, role: "answerer" });
      closeModal(); 
      await loadStudents();
    } catch (error: any) { 
      alert(error?.message || "Student could not be saved."); 
    } finally { 
      setSaving(false); 
    }
  };

  const toggleBlock = async (student: Student) => {
    const action = student.isActive ? "block" : "unblock";
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${student.name}?`)) return;
    try {
      await apiPut(`/admin/users/${student.id}/status`, { isActive: !student.isActive });
      await loadStudents();
    } catch (error: any) { 
      alert(error?.message || `Could not ${action} student.`); 
    }
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
                  <th>Attempts</th>
                  <th>Joined</th>
                  <th>Valid until</th>
                  <th>Last login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(student => (
                  <tr key={student.id}>
                    <td>
                      <div className="student-cell">
                        <span>{(student.name || student.userId).charAt(0).toUpperCase()}</span>
                        <strong>{student.name || student.userId}</strong>
                      </div>
                    </td>
                    <td><code>{student.userId}</code></td>
                    <td>{student.email || "—"}</td>
                    <td>{student.attempts || 0}</td>
                    <td>{date(student.createdAt)}</td>
                    <td>{date(student.validUntil)}</td>
                    <td>{date(student.lastLoginAt)}</td>
                    <td>
                      <span className={`student-status ${student.isActive ? "active" : "blocked"}`}>
                        {student.isActive ? "● Active" : student.isExpired ? "● Expired" : "● Blocked"}
                      </span>
                    </td>
                    <td>
                      <div className="student-actions">
                        <button onClick={() => openEdit(student)}>Edit</button>
                        <button className={student.isActive ? "block" : "unblock"} onClick={() => toggleBlock(student)}>
                          {student.isActive ? "Block" : "Unblock"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Account Add/Edit Modal */}
      {(adding || editing) && (
        <div className="student-modal-backdrop" onMouseDown={closeModal}>
          <div className="student-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{editing ? "EDIT STUDENT" : "NEW STUDENT"}</span>
                <h2>{editing ? editing.name : "Create student account"}</h2>
              </div>
              <button onClick={closeModal}>×</button>
            </header>
            <div className="student-form">
              <label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
              <label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
              <label>Username<input disabled={!!editing} value={form.userId} onChange={event => setForm({ ...form, userId: event.target.value })} /></label>
              {!editing && (
                <label>Temporary password
                  <input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Minimum 4 characters" />
                </label>
              )}
              <label>Account valid until
                <input type="date" min={new Date().toISOString().slice(0,10)} value={form.validUntil} onChange={event => setForm({ ...form, validUntil: event.target.value })} />
              </label>
            </div>
            <footer>
              <button onClick={closeModal}>Cancel</button>
              <button className="save" disabled={saving} onClick={save}>{saving ? "Saving…" : editing ? "Save changes" : "Create student"}</button>
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
    </section>
  );
};

export default UserManagement;
