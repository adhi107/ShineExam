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
  batch?: string;
  rollNumber?: string;
  mobile?: string;
  section?: string;
  gender?: string;
  notes?: string;
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

interface BatchOption {
  name: string;
  studentCount: number;
  activeCount: number;
  userIds: string[];
  courseStream?: string;
  startDate?: string;
  joiningDate?: string;
  endDate?: string;
  description?: string;
  createdAt?: string;
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
  batch: "Batch-A",
  customBatch: "",
  rollNumber: "",
  mobile: "",
  section: "Section A",
  gender: "Male",
  courseStream: "Banking PO/Clerk",
  validUntil: defaultStudentValidity(),
  notes: "",
};

function defaultStudentValidity() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [attemptFilter, setAttemptFilter] = useState<"all" | "none" | "attempted" | "multiple">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "recent" | "inactive" | "never">("all");
  const [joinedFilter, setJoinedFilter] = useState<"all" | "week" | "month" | "older">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "attempts">("newest");

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchAssignModalOpen, setBatchAssignModalOpen] = useState(false);
  const [targetBatchName, setTargetBatchName] = useState("Batch-A");
  const [customTargetBatch, setCustomTargetBatch] = useState("");
  const [assigningBatch, setAssigningBatch] = useState(false);
  const [assignModalSearch, setAssignModalSearch] = useState("");
  const [showInModalPicker, setShowInModalPicker] = useState(false);

  // Batch Management Modal State with Dates
  const [batchManagerOpen, setBatchManagerOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchStream, setNewBatchStream] = useState("Banking PO/Clerk");
  const [newBatchJoiningDate, setNewBatchJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newBatchEndDate, setNewBatchEndDate] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);

  // In-Screen Popup Toast State (No Native Browser Alerts)
  const [inScreenToast, setInScreenToast] = useState<{
    id: number;
    title: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  const showPopup = (message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const id = Date.now();
    const defaultTitle = type === "success" ? "Success" : type === "error" ? "Action Failed" : type === "warning" ? "Attention" : "Notification";
    setInScreenToast({
      id,
      title: title || defaultTitle,
      message,
      type
    });
    setTimeout(() => {
      setInScreenToast(curr => (curr && curr.id === id ? null : curr));
    }, 4500);
  };

  // Student Form Batch Mode
  const [isCreatingNewBatch, setIsCreatingNewBatch] = useState(false);

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

  const loadBatches = async () => {
    try {
      const res = await apiGet<{ batches: BatchOption[] }>("/admin/users/batches");
      setBatches(res.batches || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try { 
      const [response] = await Promise.all([
        apiGet<{ users: Student[] }>("/admin/users"),
        loadBatches()
      ]);
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
      const text = normalizeSearchText(`${student.name} ${student.userId} ${student.email} ${student.batch || ""} ${student.rollNumber || ""} ${student.mobile || ""}`);
      const attempts = student.attempts || 0;
      const lastLogin = student.lastLoginAt ? new Date(student.lastLoginAt).getTime() : 0;
      const joined = student.createdAt ? new Date(student.createdAt).getTime() : 0;
      
      const statusMatch = status === "all" || (status === "active" ? student.isActive : !student.isActive);
      const streamMatch = streamFilter === "all" || (student.courseStream || "Banking PO/Clerk").toLowerCase().includes(streamFilter.toLowerCase());
      const batchMatch = batchFilter === "all" || (student.batch || "Batch-A").toLowerCase() === batchFilter.toLowerCase();
      const attemptMatch = attemptFilter === "all" || (attemptFilter === "none" ? attempts === 0 : attemptFilter === "attempted" ? attempts > 0 : attempts > 1);
      const activityMatch = activityFilter === "all" || (activityFilter === "never" ? !lastLogin : activityFilter === "recent" ? lastLogin >= now - 7 * day : !!lastLogin && lastLogin < now - 30 * day);
      const joinedMatch = joinedFilter === "all" || (joinedFilter === "week" ? joined >= now - 7 * day : joinedFilter === "month" ? joined >= now - 30 * day : !!joined && joined < now - 30 * day);
      const dateRangeMatch = (!startDate || joined >= fromTime) && (!endDate || joined <= toTime);

      return text.includes(normalizeSearchText(search)) && statusMatch && streamMatch && batchMatch && attemptMatch && activityMatch && joinedMatch && dateRangeMatch;
    }).sort((a, b) => {
      return sortBy === "name" 
        ? (a.name || a.userId).localeCompare(b.name || b.userId) 
        : sortBy === "attempts" 
        ? (b.attempts || 0) - (a.attempts || 0) 
        : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [students, search, status, streamFilter, batchFilter, attemptFilter, activityFilter, joinedFilter, startDate, endDate, sortBy]);

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
    const headers = ["Student Name", "Username", "Email", "Batch", "Course", "Attempts", "Joined Date", "Valid Until", "Last Login", "Status"];
    const rows = visible.map(s => [
      `"${(s.name || s.userId).replace(/"/g, '""')}"`,
      `"${s.userId.replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.batch || "Batch-A").replace(/"/g, '""')}"`,
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

  const openAdd = () => {
    setForm({
      ...emptyForm,
      batch: batches[0]?.name || "Batch-A",
      customBatch: "",
    });
    setIsCreatingNewBatch(false);
    setAdding(true);
    setEditing(null);
  };

  const openEdit = (student: Student) => { 
    setForm({ 
      name: student.name || "", 
      email: student.email || "", 
      userId: student.userId, 
      password: "", 
      batch: student.batch || batches[0]?.name || "Batch-A",
      customBatch: "",
      rollNumber: "",
      mobile: student.mobile || "",
      section: student.section || "Section A",
      gender: student.gender || "Male",
      courseStream: student.courseStream || "Banking PO/Clerk",
      validUntil: student.validUntil ? student.validUntil.slice(0, 10) : defaultStudentValidity(),
      notes: student.notes || "",
    }); 
    setIsCreatingNewBatch(false);
    setEditing(student); 
    setAdding(false); 
  };
  
  const closeModal = () => {
    setAdding(false);
    setEditing(null);
    setIsCreatingNewBatch(false);
    setForm(emptyForm);
  };
  
  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editing && (!form.userId.trim() || form.password.length < 4))) return;
    setSaving(true);
    const finalBatch = (isCreatingNewBatch || form.batch === "__new__")
      ? (form.customBatch.trim() || "Batch-A")
      : (form.batch.trim() || "Batch-A");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      courseStream: form.courseStream,
      validUntil: form.validUntil,
      batch: finalBatch,
      mobile: form.mobile.trim(),
      section: form.section.trim(),
      gender: form.gender.trim(),
      notes: form.notes?.trim() || "",
    };
    try {
      if (editing) {
        await apiPut(`/admin/users/${editing.id}`, payload);
        showPopup(`Student '${payload.name}' updated successfully!`, "success", "Student Updated");
      } else {
        await apiPost("/admin/users", { ...payload, userId: form.userId.trim(), password: form.password, role: "answerer" });
        showPopup(`Student account '${payload.name}' created successfully!`, "success", "Student Created");
      }
      closeModal(); 
      await loadStudents();
      await loadBatches();
    } catch (error: any) { 
      showPopup(error?.message || "Student could not be saved.", "error", "Save Failed"); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleCreateBatchInManager = async () => {
    const name = newBatchName.trim();
    if (!name) {
      showPopup("Please enter a batch name.", "warning", "Batch Name Required");
      return;
    }
    setCreatingBatch(true);
    try {
      const res = await apiPost<any>("/admin/users/batches", {
        name,
        courseStream: newBatchStream,
        joiningDate: newBatchJoiningDate,
        startDate: newBatchJoiningDate,
        endDate: newBatchEndDate,
      });
      showPopup(res.message || `Batch '${name}' created successfully!`, "success", "Batch Created");
      setNewBatchName("");
      await loadBatches();
    } catch (err: any) {
      showPopup(err?.message || "Failed to create batch.", "error", "Creation Failed");
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleAssignBatch = async () => {
    if (!selectedStudentIds.length) {
      showPopup("Please select at least one student to assign.", "warning", "No Students Selected");
      return;
    }
    const finalBatch = targetBatchName === "__new__" ? customTargetBatch.trim() : targetBatchName.trim();
    if (!finalBatch) {
      showPopup("Please select or enter a batch name.", "warning", "Batch Required");
      return;
    }
    setAssigningBatch(true);
    try {
      const res = await apiPost<any>("/admin/users/assign-batch", {
        userIds: selectedStudentIds,
        batch: finalBatch,
      });
      setBatchAssignModalOpen(false);
      const count = selectedStudentIds.length;
      setSelectedStudentIds([]);
      showPopup(res?.message || `Successfully assigned ${count} student(s) to '${finalBatch}'!`, "success", "Batch Assigned");
      await loadStudents();
      await loadBatches();
    } catch (err: any) {
      showPopup(err?.message || "Failed to assign batch to students.", "error", "Assignment Failed");
    } finally {
      setAssigningBatch(false);
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
          showPopup(`Student '${student.name || student.userId}' removed successfully.`, "success", "Candidate Removed");
          await loadStudents();
          await loadBatches();
        } catch (error: any) {
          showPopup(error?.message || "Could not delete student.", "error", "Delete Failed");
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
          showPopup(`Student access ${student.isActive ? "blocked" : "unblocked"} successfully.`, "success", "Status Updated");
          await loadStudents();
        } catch (error: any) {
          showPopup(error?.message || `Could not update student status.`, "error", "Status Update Failed");
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
        showPopup(`Successfully imported ${res.createdCount} students from Excel!`, "success", "Bulk Import Complete");
        await loadStudents();
        await loadBatches();
      }
    } catch (error: any) {
      showPopup(error?.message || "Failed to process bulk Excel upload.", "error", "Bulk Upload Failed");
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
          <button
            type="button"
            className="manage-batches-btn"
            onClick={() => setBatchManagerOpen(true)}
          >
            <span>🏷️ Manage Batches</span>
            {batches.length > 0 && <span className="header-batch-count">{batches.length}</span>}
          </button>
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
            <label>Select Batch</label>
            <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
              <option value="all">All Batches ({students.length})</option>
              {batches.map(b => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.studentCount} students)
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Course</label>
            <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
              <option value="all">All Courses</option>
              <option value="Banking">Banking PO/Clerk</option>
              <option value="SSC">SSC CGL/CHSL</option>
              <option value="Combo">Banking + SSC Combo</option>
              <option value="Railway">RRB Railway</option>
              <option value="Civil">UPSC / Civil Services</option>
              <option value="General">General Aptitude</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Attempts</label>
            <select value={attemptFilter} onChange={e => setAttemptFilter(e.target.value as any)}>
              <option value="all">Any attempts</option>
              <option value="none">Never attempted</option>
              <option value="attempted">Attempted ≥ 1</option>
              <option value="multiple">Multiple (≥ 2)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Activity</label>
            <select value={activityFilter} onChange={e => setActivityFilter(e.target.value as any)}>
              <option value="all">Any activity</option>
              <option value="recent">Active last 7 days</option>
              <option value="inactive">Inactive 30+ days</option>
              <option value="never">Never logged in</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Joined</label>
            <select value={joinedFilter} onChange={e => { setJoinedFilter(e.target.value as any); setStartDate(""); setEndDate(""); }}>
              <option value="all">All time</option>
              <option value="week">Past 7 days</option>
              <option value="month">Past 30 days</option>
              <option value="older">Older than 30 days</option>
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

      {/* Floating Multi-Select Batch Action Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="batch-floating-bar">
          <div className="batch-floating-left">
            <span>Selected Students:</span>
            <span className="batch-floating-count">{selectedStudentIds.length}</span>
          </div>
          <div className="batch-floating-actions">
            <button
              type="button"
              className="btn-assign-batch-trigger"
              onClick={() => {
                setTargetBatchName(batches[0]?.name || "Batch-A");
                setCustomTargetBatch("");
                setBatchAssignModalOpen(true);
              }}
            >
              🏷️ Assign Batch Wise
            </button>
            <button
              type="button"
              className="btn-clear-selection"
              onClick={() => setSelectedStudentIds([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
                  <th style={{ width: "36px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="table-select-checkbox"
                      checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIds.includes(s.id || s.userId))}
                      onChange={e => {
                        if (e.target.checked) {
                          const ids = paginatedStudents.map(s => s.id || s.userId);
                          setSelectedStudentIds(prev => Array.from(new Set([...prev, ...ids])));
                        } else {
                          const ids = new Set(paginatedStudents.map(s => s.id || s.userId));
                          setSelectedStudentIds(prev => prev.filter(id => !ids.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th>Student</th>
                  <th>Batch</th>
                  <th>Course</th>
                  <th>Contact</th>
                  <th>Attempts</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map(student => (
                  <tr key={student.id}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="table-select-checkbox"
                        checked={selectedStudentIds.includes(student.id || student.userId)}
                        onChange={e => {
                          const sid = student.id || student.userId;
                          if (e.target.checked) {
                            setSelectedStudentIds(prev => [...prev, sid]);
                          } else {
                            setSelectedStudentIds(prev => prev.filter(id => id !== sid));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <div className="student-cell">
                        <span>{(student.name || student.userId).charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{student.name || student.userId}</strong>
                          <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}><code>{student.userId}</code></small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="batch-pill-badge">
                        🏷️ {student.batch || "Batch-A"}
                      </span>
                    </td>
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
                      {student.section && <small style={{ display: "block", color: "#64748b", fontSize: "11px", marginTop: "2px" }}>{student.section}</small>}
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: "12px", color: "#334155" }}>{student.email || "—"}</div>
                        {student.mobile && <small style={{ fontSize: "11px", color: "#64748b" }}>📞 {student.mobile}</small>}
                      </div>
                    </td>
                    <td><strong>{student.attempts || 0}</strong></td>
                    <td>{date(student.validUntil)}</td>
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
              {/* Row 1: Full Name & Email Address */}
              <label>
                <span className="field-label-text">
                  Full name <span className="required-star">*</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g. Adithya Kumar"
                  value={form.name}
                  onChange={event => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label-text">
                  Email address <span className="required-star">*</span>
                </span>
                <input
                  type="email"
                  placeholder="e.g. adithya@victory.com"
                  value={form.email}
                  onChange={event => setForm({ ...form, email: event.target.value })}
                />
              </label>

              {/* Row 2: Username & Password / Access */}
              <label>
                <span className="field-label-text">
                  Username <span className="required-star">*</span>
                </span>
                <input
                  type="text"
                  disabled={!!editing}
                  placeholder="Unique login ID"
                  value={form.userId}
                  onChange={event => setForm({ ...form, userId: event.target.value })}
                />
              </label>
              {!editing ? (
                <label>
                  <span className="field-label-text">
                    Temporary password <span className="required-star">*</span>
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={event => setForm({ ...form, password: event.target.value })}
                    placeholder="Minimum 4 characters"
                  />
                </label>
              ) : (
                <label>
                  <span className="field-label-text">Role & Access</span>
                  <input
                    type="text"
                    disabled
                    value="Candidate / Student (Active)"
                    style={{ backgroundColor: "#f1f5f9", color: "#64748b", fontWeight: 600 }}
                  />
                </label>
              )}

              {/* Row 3: Assign Batch & Course */}
              <div className="batch-field-group">
                <div className="batch-field-header">
                  <span className="field-label-text">
                    Assign Batch <span className="required-star">*</span>
                  </span>
                  <button
                    type="button"
                    className="inline-batch-toggle-btn"
                    onClick={() => {
                      setIsCreatingNewBatch(!isCreatingNewBatch);
                      if (!isCreatingNewBatch) setForm(f => ({ ...f, customBatch: "" }));
                    }}
                  >
                    {isCreatingNewBatch ? "← Choose Existing Batch" : "+ Create New Batch"}
                  </button>
                </div>

                {isCreatingNewBatch ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Enter new batch name (e.g. Batch 2026-Alpha)"
                      value={form.customBatch}
                      onChange={event => setForm({ ...form, customBatch: event.target.value })}
                      autoFocus
                      style={{
                        borderColor: "#2563eb",
                        boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.14)",
                      }}
                    />
                    <small style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>
                      ✨ This batch will be created and assigned automatically
                    </small>
                  </div>
                ) : (
                  <select
                    className="student-course-select"
                    value={form.batch}
                    onChange={event => {
                      if (event.target.value === "__new__") {
                        setIsCreatingNewBatch(true);
                      } else {
                        setForm({ ...form, batch: event.target.value });
                      }
                    }}
                  >
                    {batches.length === 0 ? (
                      <>
                        <option value="Batch-A">Batch-A</option>
                        <option value="Batch-B">Batch-B</option>
                        <option value="__new__">+ Create New Batch…</option>
                      </>
                    ) : (
                      <>
                        {batches.map(b => (
                          <option key={b.name} value={b.name}>
                            {b.name} ({b.studentCount} students)
                          </option>
                        ))}
                        <option value="__new__">+ Create New Batch…</option>
                      </>
                    )}
                  </select>
                )}
              </div>

              <label>
                <span className="field-label-text">Course</span>
                <select
                  className="student-course-select"
                  value={form.courseStream || "Banking PO/Clerk"}
                  onChange={event => setForm({ ...form, courseStream: event.target.value })}
                >
                  <option value="Banking PO/Clerk">Banking PO / Clerk (IBPS, SBI, RRB)</option>
                  <option value="SSC CGL/CHSL">SSC Exams (CGL, CHSL, MTS, CPO)</option>
                  <option value="RRB Railway NTPC/Group D">RRB Railway (NTPC, Group D, ALP)</option>
                  <option value="UPSC & State PSC">UPSC & State PSC Civil Services</option>
                  <option value="Banking + SSC Combo">Banking + SSC Comprehensive Combo</option>
                  <option value="Defense & Police">Defense & Police (NDA, CDS, SI, Constable)</option>
                  <option value="Teaching & TET">Teaching Exams (CTET, State TET)</option>
                  <option value="Insurance Exams">Insurance Exams (LIC, NIACL, OICL)</option>
                  <option value="General Aptitude">General Aptitude & Reasoning</option>
                </select>
              </label>

              {/* Row 4: Phone & Gender */}
              <label>
                <span className="field-label-text">Phone / Mobile Number</span>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={form.mobile}
                  onChange={event => setForm({ ...form, mobile: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label-text">Gender</span>
                <select
                  value={form.gender}
                  onChange={event => setForm({ ...form, gender: event.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              {/* Row 5: Account Validity */}
              <label className="full-width-field">
                <span className="field-label-text">Account valid until</span>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.validUntil}
                  onChange={event => setForm({ ...form, validUntil: event.target.value })}
                />
              </label>

              {/* Row 6: Notes / Remarks (Full width) */}
              <label className="full-width-field">
                <span className="field-label-text">Notes / Remarks (Optional)</span>
                <input
                  type="text"
                  placeholder="Additional student notes, mentor, scholarship details…"
                  value={form.notes}
                  onChange={event => setForm({ ...form, notes: event.target.value })}
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

      {/* Batch Assign Modal */}
      {batchAssignModalOpen && (
        <div className="student-modal-backdrop" onMouseDown={() => setBatchAssignModalOpen(false)}>
          <div className="student-modal batch-assign-dialog" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span className="modal-badge">BATCH ASSIGNMENT</span>
                <h2>Assign Students to Batch</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setBatchAssignModalOpen(false)}>×</button>
            </header>

            <div className="student-form batch-assign-form-body">
              {/* Target Batch Selection Card */}
              <div className="assign-step-card">
                <div className="assign-step-title">
                  <span className="step-num">1</span>
                  <strong>Choose Target Cohort</strong>
                </div>
                <div className="full-width-field">
                  <select
                    className="assign-batch-select"
                    value={targetBatchName}
                    onChange={e => setTargetBatchName(e.target.value)}
                  >
                    {batches.map(b => (
                      <option key={b.name} value={b.name}>
                        🏷️ {b.name} ({b.studentCount} students currently)
                      </option>
                    ))}
                    <option value="__new__">✨ + Create New Batch Cohort…</option>
                  </select>
                </div>

                {targetBatchName === "__new__" && (
                  <div className="assign-new-batch-box">
                    <div className="assign-new-batch-grid">
                      <div>
                        <label>New Batch Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. SSC-2026-Alpha"
                          value={customTargetBatch}
                          onChange={e => setCustomTargetBatch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label>📅 Joining Date *</label>
                        <input
                          type="date"
                          value={newBatchJoiningDate}
                          onChange={e => setNewBatchJoiningDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Candidate Selection Section */}
              <div className="assign-step-card">
                <div className="assign-step-title" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="step-num">2</span>
                    <strong>Candidates to Assign ({selectedStudentIds.length})</strong>
                  </div>
                  {selectedStudentIds.length > 0 && (
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={() => setShowInModalPicker(!showInModalPicker)}
                    >
                      {showInModalPicker ? "Hide Student List" : "+ Add / Change Candidates"}
                    </button>
                  )}
                </div>

                {/* Selected candidate chips summary */}
                {selectedStudentIds.length > 0 && (
                  <div className="selected-chips-container">
                    {selectedStudentIds.map(id => {
                      const st = students.find(s => s.id === id || s.userId === id);
                      return (
                        <span key={id} className="selected-student-chip">
                          <span className="chip-avatar">{st?.name ? st.name.charAt(0).toUpperCase() : "U"}</span>
                          <span className="chip-name">{st?.name || id}</span>
                          <button
                            type="button"
                            className="chip-remove-btn"
                            onClick={() => setSelectedStudentIds(curr => curr.filter(sid => sid !== id))}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      className="btn-clear-chips"
                      onClick={() => setSelectedStudentIds([])}
                    >
                      Clear All
                    </button>
                  </div>
                )}

                {/* In-Modal Candidate Picker (when none selected or toggled) */}
                {(selectedStudentIds.length === 0 || showInModalPicker) && (
                  <div className="in-modal-candidate-picker">
                    <div className="picker-toolbar">
                      <input
                        type="text"
                        placeholder="Search candidate name or ID..."
                        value={assignModalSearch}
                        onChange={e => setAssignModalSearch(e.target.value)}
                        className="picker-search-input"
                      />
                      <button
                        type="button"
                        className="picker-select-all-btn"
                        onClick={() => {
                          const matched = students.filter(s =>
                            !assignModalSearch.trim() ||
                            s.name.toLowerCase().includes(assignModalSearch.toLowerCase()) ||
                            s.userId.toLowerCase().includes(assignModalSearch.toLowerCase())
                          );
                          const allSelected = matched.every(s => selectedStudentIds.includes(s.id));
                          if (allSelected) {
                            setSelectedStudentIds(curr => curr.filter(id => !matched.some(m => m.id === id)));
                          } else {
                            const newIds = Array.from(new Set([...selectedStudentIds, ...matched.map(m => m.id)]));
                            setSelectedStudentIds(newIds);
                          }
                        }}
                      >
                        Select All Filtered
                      </button>
                    </div>

                    <div className="picker-student-list">
                      {students
                        .filter(s =>
                          !assignModalSearch.trim() ||
                          s.name.toLowerCase().includes(assignModalSearch.toLowerCase()) ||
                          s.userId.toLowerCase().includes(assignModalSearch.toLowerCase())
                        )
                        .map(s => {
                          const isChecked = selectedStudentIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`picker-student-row ${isChecked ? "checked" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedStudentIds(curr => curr.filter(id => id !== s.id));
                                  } else {
                                    setSelectedStudentIds(curr => [...curr, s.id]);
                                  }
                                }}
                              />
                              <div className="picker-student-info">
                                <strong>{s.name}</strong>
                                <span>{s.userId} · {s.email}</span>
                              </div>
                              <span className="picker-current-batch">
                                {s.batch || "Batch-A"}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <footer>
              <button type="button" className="btn-cancel" onClick={() => setBatchAssignModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="save"
                disabled={assigningBatch || selectedStudentIds.length === 0 || (targetBatchName === "__new__" && !customTargetBatch.trim())}
                onClick={handleAssignBatch}
              >
                {assigningBatch
                  ? "Assigning Candidates…"
                  : `Assign ${selectedStudentIds.length} Student(s) to ${targetBatchName === "__new__" ? customTargetBatch || "New Batch" : targetBatchName}`}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Dedicated Batch Management Modal */}
      {batchManagerOpen && (
        <div className="student-modal-backdrop" onMouseDown={() => setBatchManagerOpen(false)}>
          <div className="student-modal batch-manager-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span className="modal-badge">BATCH GOVERNANCE</span>
                <h2>Batch & Academic Cohort Management</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setBatchManagerOpen(false)}>×</button>
            </header>
            <div className="batch-manager-body">
              {/* Quick Create Batch Card with Dates */}
              <div className="batch-create-box">
                <div className="batch-create-box-head">
                  <div className="batch-create-icon-wrap">🏷️</div>
                  <div>
                    <strong>+ Create New Cohort / Batch</strong>
                    <span>Define cohort schedule, target course, and student onboarding dates</span>
                  </div>
                </div>
                <div className="batch-create-form-grid">
                  <div className="batch-form-field">
                    <label>Batch Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. SSC-2026-Alpha, Morning Group"
                      value={newBatchName}
                      onChange={e => setNewBatchName(e.target.value)}
                    />
                  </div>
                  <div className="batch-form-field">
                    <label>Course</label>
                    <select
                      value={newBatchStream}
                      onChange={e => setNewBatchStream(e.target.value)}
                    >
                      <option value="Banking PO/Clerk">Banking PO / Clerk</option>
                      <option value="SSC CGL/CHSL">SSC Exams (CGL, CHSL, MTS)</option>
                      <option value="RRB Railway NTPC/Group D">Railway RRB</option>
                      <option value="UPSC & State PSC">UPSC & State PSC</option>
                      <option value="Banking + SSC Combo">Banking + SSC Combo</option>
                      <option value="Defense & Police">Defense & Police</option>
                      <option value="Teaching & TET">Teaching & TET</option>
                      <option value="Insurance Exams">Insurance Exams</option>
                      <option value="General Aptitude">General Aptitude</option>
                    </select>
                  </div>
                  <div className="batch-form-field">
                    <label>📅 Joining / Start Date *</label>
                    <input
                      type="date"
                      value={newBatchJoiningDate}
                      onChange={e => setNewBatchJoiningDate(e.target.value)}
                    />
                  </div>
                  <div className="batch-form-field">
                    <label>🏁 Completion Date (Optional)</label>
                    <input
                      type="date"
                      value={newBatchEndDate}
                      onChange={e => setNewBatchEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="batch-create-actions-row">
                  <button
                    type="button"
                    className="btn-create-batch-action"
                    disabled={creatingBatch || !newBatchName.trim()}
                    onClick={handleCreateBatchInManager}
                  >
                    {creatingBatch ? "Creating Cohort…" : "+ Save & Create Batch"}
                  </button>
                </div>
              </div>

              {/* Existing Batches List */}
              <div className="batch-list-header">
                <div>
                  <h3>Active Cohorts & Batches ({batches.length})</h3>
                  <p>Overview of academic cohorts, schedule dates, and enrolled candidates</p>
                </div>
              </div>

              <div className="batch-cards-grid">
                {batches.map(b => (
                  <div key={b.name} className="batch-card-item">
                    <div className="batch-card-top">
                      <div className="batch-card-title-group">
                        <span className="batch-icon">🏷️</span>
                        <strong className="batch-card-name">{b.name}</strong>
                      </div>
                      <div className="batch-counts-group">
                        <span className="batch-count-badge total">
                          {b.studentCount} {b.studentCount === 1 ? "student" : "students"}
                        </span>
                        {b.activeCount !== undefined && (
                          <span className="batch-count-badge active">
                            {b.activeCount} active
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="batch-card-meta-chips">
                      {b.courseStream && (
                        <span className="meta-chip stream">
                          📚 {b.courseStream}
                        </span>
                      )}
                      {(b.joiningDate || b.startDate) && (
                        <span className="meta-chip date">
                          📅 Joining: {new Date(b.joiningDate || b.startDate || "").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {b.endDate && (
                        <span className="meta-chip date end">
                          🏁 End: {new Date(b.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    <div className="batch-card-actions">
                      <button
                        type="button"
                        className="btn-batch-filter-action"
                        onClick={() => {
                          setBatchFilter(b.name);
                          setBatchManagerOpen(false);
                        }}
                      >
                        🔍 Filter Candidates
                      </button>
                      <button
                        type="button"
                        className="btn-batch-assign-action"
                        onClick={() => {
                          setTargetBatchName(b.name);
                          setBatchAssignModalOpen(true);
                          setBatchManagerOpen(false);
                        }}
                      >
                        👥 Assign Students
                      </button>
                    </div>
                  </div>
                ))}
                {batches.length === 0 && (
                  <div className="batch-empty-box">
                    <p>No batches created yet. Enter a batch name above to create your first cohort.</p>
                  </div>
                )}
              </div>
            </div>
            <footer>
              <button type="button" className="btn-cancel" onClick={() => setBatchManagerOpen(false)}>Close</button>
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

      {/* In-Screen Popup Toast Notification with Best CSS */}
      {inScreenToast && (
        <div className={`screen-popup-toast ${inScreenToast.type}`} onClick={() => setInScreenToast(null)}>
          <div className="popup-icon-col">
            {inScreenToast.type === "success" && <span className="popup-icon-sym success">✓</span>}
            {inScreenToast.type === "error" && <span className="popup-icon-sym error">✕</span>}
            {inScreenToast.type === "warning" && <span className="popup-icon-sym warning">⚠️</span>}
            {inScreenToast.type === "info" && <span className="popup-icon-sym info">ℹ️</span>}
          </div>
          <div className="popup-content-col">
            <div className="popup-header-row">
              <strong className="popup-title">{inScreenToast.title}</strong>
              <button
                type="button"
                className="popup-close-btn"
                onClick={(e) => { e.stopPropagation(); setInScreenToast(null); }}
              >
                ✕
              </button>
            </div>
            <p className="popup-msg">{inScreenToast.message}</p>
          </div>
          <div className="popup-progress-bar" />
        </div>
      )}
    </section>
  );
};

export default UserManagement;

