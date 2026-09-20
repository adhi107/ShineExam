import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../services/api";
import AlertDialog, { AlertVariant } from "../AlertDialog";
import "./StudentEnrollmentManager.css";

interface StudentProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile?: string;
  qualification?: string;
  batch?: string;
  course?: string;
  courseStream?: string;
  status: string;
  category?: string;
  organization?: string;
  branch?: string;
  enrolledExams?: string[];
  optionalSubject?: string;
}

interface OptionalHistoryItem {
  id: string;
  previousSubject: string;
  newSubject: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

interface EnrollmentStats {
  totalStudents: number;
  enrolledStudents: number;
  optionalConfigured: number;
  totalBatches: number;
  batches: string[];
  courses: string[];
}

const EXAM_OPTIONS = [
  "UPSC Civil Services",
  "APPSC Group-I",
  "APPSC Group-II",
  "TSPSC / TGPSC Group-I",
  "TSPSC / TGPSC Group-II",
  "SSC CGL",
  "Banking PO & Clerk",
  "State Forest Service",
];

const OPTIONAL_SUBJECTS = [
  "Public Administration",
  "Geography",
  "History",
  "Sociology",
  "Anthropology",
  "Political Science & IR",
  "Telugu Literature",
  "Psychology",
  "Economics",
  "Mathematics",
  "Philosophy",
  "Law",
  "Commerce & Accountancy",
];

const StudentEnrollmentManager: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [stats, setStats] = useState<EnrollmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedEnrollFilter, setSelectedEnrollFilter] = useState("all"); // 'all' | 'enrolled' | 'not_enrolled' | 'has_optional'

  // Multi-selection for bulk actions
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Selected student for modals
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // Modals
  const [createStudentModal, setCreateStudentModal] = useState(false);
  const [editStudentModal, setEditStudentModal] = useState(false);
  const [enrollModal, setEnrollModal] = useState(false);
  const [bulkEnrollModal, setBulkEnrollModal] = useState(false);
  const [bulkBatchModal, setBulkBatchModal] = useState(false);
  const [optionalModal, setOptionalModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [eligibleModal, setEligibleModal] = useState(false);

  // Form states
  const [studentForm, setStudentForm] = useState({
    name: "", email: "", userId: "", mobile: "", qualification: "",
    batch: "2026-Batch-A", course: "UPSC Civil Services", organization: "Main Institute", status: "Active"
  });

  const [editForm, setEditForm] = useState({
    name: "", email: "", userId: "", mobile: "", batch: "", course: "", status: "Active", category: "General", organization: ""
  });

  const [enrollForm, setEnrollForm] = useState({
    examName: "UPSC Civil Services", examYear: 2026, stage: "Mains", optionalSubject: "Public Administration"
  });

  const [bulkEnrollForm, setBulkEnrollForm] = useState({
    examName: "UPSC Civil Services", examYear: 2026, selectedStages: ["prelims", "mains", "optional"]
  });

  const [bulkBatchName, setBulkBatchName] = useState("");

  const [optionalForm, setOptionalForm] = useState({
    optionalSubject: "Public Administration", reason: "Student chosen mains specialization track"
  });

  const [optionalHistory, setOptionalHistory] = useState<OptionalHistoryItem[]>([]);
  const [eligibleTests, setEligibleTests] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean; title: string; message: string; variant: AlertVariant;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const loadStats = useCallback(async () => {
    try {
      const res = await apiGet<EnrollmentStats>("/admin/enrollments/stats");
      setStats(res);
    } catch {}
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ students: StudentProfile[] }>(
        `/admin/enrollments/students?search=${encodeURIComponent(search)}`
      );
      setStudents(res.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadStudents();
    loadStats();
  }, [loadStudents, loadStats]);

  // Derived filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedBatch !== "all" && s.batch !== selectedBatch) return false;
      if (selectedCourse !== "all" && s.course !== selectedCourse) return false;
      if (selectedStatus !== "all" && (s.status || "Active").toLowerCase() !== selectedStatus.toLowerCase()) return false;
      if (selectedEnrollFilter === "enrolled" && (!s.enrolledExams || s.enrolledExams.length === 0)) return false;
      if (selectedEnrollFilter === "not_enrolled" && s.enrolledExams && s.enrolledExams.length > 0) return false;
      if (selectedEnrollFilter === "has_optional" && !s.optionalSubject) return false;
      return true;
    });
  }, [students, selectedBatch, selectedCourse, selectedStatus, selectedEnrollFilter]);

  // Unique batches from current student list and stats
  const availableBatches = useMemo(() => {
    const list = new Set<string>();
    if (stats?.batches) stats.batches.forEach(b => list.add(b));
    students.forEach(s => { if (s.batch) list.add(s.batch); });
    return Array.from(list).sort();
  }, [students, stats]);

  // Multi-select handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(filteredStudents.map(s => s.userId));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleSelect = (uid: string) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  };

  const handleCopyUserId = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setAlertState({
      isOpen: true,
      title: "Copied!",
      message: `Student ID "${uid}" copied to clipboard.`,
      variant: "success",
    });
  };

  // 1. Create Student
  const handleCreateStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.email.trim()) {
      setAlertState({ isOpen: true, title: "Missing Fields", message: "Name and Email are required.", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/admin/enrollments/students", studentForm);
      setAlertState({ isOpen: true, title: "Student Registered", message: `Student profile for ${studentForm.name} created successfully.`, variant: "success" });
      setCreateStudentModal(false);
      setStudentForm({
        name: "", email: "", userId: "", mobile: "", qualification: "",
        batch: "2026-Batch-A", course: "UPSC Civil Services", organization: "Main Institute", status: "Active"
      });
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Registration Failed", message: e?.message || "Could not register student.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 2. Edit Student Profile
  const openEditModal = (st: StudentProfile) => {
    setSelectedStudent(st);
    setEditForm({
      name: st.name || "",
      email: st.email || "",
      userId: st.userId || "",
      mobile: st.mobile || "",
      batch: st.batch || "",
      course: st.course || st.courseStream || "UPSC Civil Services",
      status: st.status || "Active",
      category: st.category || "General",
      organization: st.organization || "Main Institute",
    });
    setEditStudentModal(true);
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await apiPut(`/admin/enrollments/students/${selectedStudent.userId}`, editForm);
      setAlertState({ isOpen: true, title: "Profile Updated", message: `Student profile for ${editForm.name} updated successfully.`, variant: "success" });
      setEditStudentModal(false);
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Update Failed", message: e?.message || "Could not update profile.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 3. Enroll in Exam
  const handleEnrollExam = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await apiPost("/admin/enrollments/enroll", {
        userId: selectedStudent.userId,
        ...enrollForm
      });
      setAlertState({ isOpen: true, title: "Exam Enrolled", message: `Enrolled in ${enrollForm.examName} (${enrollForm.stage}) successfully.`, variant: "success" });
      setEnrollModal(false);
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Enrollment Failed", message: e?.message || "Could not complete enrollment.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 4. Bulk Enroll
  const handleBulkEnroll = async () => {
    if (selectedUserIds.length === 0) return;
    setSaving(true);
    try {
      const res = await apiPost<{ message: string; count: number }>("/admin/enrollments/bulk-enroll", {
        userIds: selectedUserIds,
        examName: bulkEnrollForm.examName,
        examYear: bulkEnrollForm.examYear,
        selectedStages: bulkEnrollForm.selectedStages,
      });
      setAlertState({ isOpen: true, title: "Bulk Enrollment Complete", message: res.message || `Successfully enrolled ${res.count} students.`, variant: "success" });
      setBulkEnrollModal(false);
      setSelectedUserIds([]);
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Bulk Enrollment Failed", message: e?.message || "Error enrolling students.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 5. Bulk Batch Reassign
  const handleBulkBatch = async () => {
    if (selectedUserIds.length === 0 || !bulkBatchName.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost<{ message: string; count: number }>("/admin/enrollments/bulk-batch", {
        userIds: selectedUserIds,
        batch: bulkBatchName.trim(),
      });
      setAlertState({ isOpen: true, title: "Batch Updated", message: res.message || `Updated batch for ${res.count} students.`, variant: "success" });
      setBulkBatchModal(false);
      setBulkBatchName("");
      setSelectedUserIds([]);
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Batch Update Failed", message: e?.message || "Error updating batch.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 6. Set Optional Subject
  const handleSaveOptional = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await apiPost("/admin/enrollments/optional-subject", {
        userId: selectedStudent.userId,
        ...optionalForm
      });
      setAlertState({ isOpen: true, title: "Optional Subject Configured", message: `Optional track updated to ${optionalForm.optionalSubject} with audit history logged.`, variant: "success" });
      setOptionalModal(false);
      loadStudents();
      loadStats();
    } catch (e: any) {
      setAlertState({ isOpen: true, title: "Update Failed", message: e?.message || "Could not update optional subject.", variant: "danger" });
    } finally { setSaving(false); }
  };

  // 7. Audit History
  const openOptionalHistory = async (st: StudentProfile) => {
    setSelectedStudent(st);
    try {
      const res = await apiGet<{ history: OptionalHistoryItem[] }>(`/admin/enrollments/optional-subject/history?userId=${encodeURIComponent(st.userId)}`);
      setOptionalHistory(res.history || []);
      setHistoryModal(true);
    } catch {
      setOptionalHistory([]);
      setHistoryModal(true);
    }
  };

  // 8. Eligible Tests
  const openEligibleTests = async (st: StudentProfile) => {
    setSelectedStudent(st);
    try {
      const res = await apiGet<any>(`/admin/enrollments/students/${st.userId}/eligible-tests`);
      setEligibleTests(res);
      setEligibleModal(true);
    } catch {
      setEligibleTests(null);
    }
  };

  // 9. Export to CSV
  const handleExportCSV = () => {
    const listToExport = selectedUserIds.length > 0
      ? filteredStudents.filter(s => selectedUserIds.includes(s.userId))
      : filteredStudents;

    if (listToExport.length === 0) {
      setAlertState({ isOpen: true, title: "No Records", message: "No student records available to export.", variant: "warning" });
      return;
    }

    const headers = ["Student Name", "User ID", "Email", "Mobile", "Batch", "Course", "Status", "Enrolled Exams", "Optional Subject"];
    const rows = listToExport.map(s => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.userId}"`,
      `"${s.email}"`,
      `"${s.mobile || ""}"`,
      `"${s.batch || ""}"`,
      `"${s.course || s.courseStream || ""}"`,
      `"${s.status || "Active"}"`,
      `"${(s.enrolledExams || []).join("; ")}"`,
      `"${s.optionalSubject || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `students_enrollment_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="sem-root">
      {/* Top Header */}
      <div className="sem-header">
        <div>
          <div className="sem-badge">🎓 Enterprise Student Management</div>
          <h1 className="sem-title">Student Enrollment & Exam Configuration</h1>
          <p className="sem-sub">
            Manage student registrations, multi-stage exam enrollments, compulsory + optional paper tracks, and audit logs.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="sem-btn sem-btn-secondary" onClick={handleExportCSV} title="Export filtered student list to CSV">
            📥 Export CSV
          </button>
          <button className="sem-btn sem-btn-primary" onClick={() => setCreateStudentModal(true)}>
            + Register New Student
          </button>
        </div>
      </div>

      {/* KPI Stats Showcase */}
      <div className="sem-stats-grid">
        <div className="sem-stat-card">
          <div className="sem-stat-icon-wrap" style={{ background: "#eff6ff", color: "#2563eb" }}>👥</div>
          <div>
            <div className="sem-stat-label">Total Candidates</div>
            <div className="sem-stat-value">{stats?.totalStudents ?? students.length}</div>
          </div>
        </div>
        <div className="sem-stat-card">
          <div className="sem-stat-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>🏛️</div>
          <div>
            <div className="sem-stat-label">Enrolled in Exams</div>
            <div className="sem-stat-value">{stats?.enrolledStudents ?? students.filter(s => s.enrolledExams && s.enrolledExams.length > 0).length}</div>
          </div>
        </div>
        <div className="sem-stat-card">
          <div className="sem-stat-icon-wrap" style={{ background: "#faf5ff", color: "#9333ea" }}>🎯</div>
          <div>
            <div className="sem-stat-label">Optional Track Set</div>
            <div className="sem-stat-value">{stats?.optionalConfigured ?? students.filter(s => s.optionalSubject).length}</div>
          </div>
        </div>
        <div className="sem-stat-card">
          <div className="sem-stat-icon-wrap" style={{ background: "#fff7ed", color: "#ea580c" }}>🏷️</div>
          <div>
            <div className="sem-stat-label">Active Batches</div>
            <div className="sem-stat-value">{availableBatches.length}</div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="sem-toolbar">
        <div className="sem-filters-wrap">
          <div className="sem-search-box">
            <input
              className="sem-search"
              placeholder="Search by student name, ID, email, or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="sem-search-clear" onClick={() => setSearch("")} title="Clear search">✕</button>
            )}
          </div>

          <div className="sem-dropdown-filters">
            <select
              className="sem-filter-select"
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              title="Filter by Course / Exam"
            >
              <option value="all">All Courses / Exams</option>
              {EXAM_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>

            <select
              className="sem-filter-select"
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              title="Filter by Batch"
            >
              <option value="all">All Batches</option>
              {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <select
              className="sem-filter-select"
              value={selectedEnrollFilter}
              onChange={e => setSelectedEnrollFilter(e.target.value)}
              title="Filter by Enrollment Status"
            >
              <option value="all">All Enrollment Status</option>
              <option value="enrolled">Enrolled Only</option>
              <option value="not_enrolled">Not Enrolled</option>
              <option value="has_optional">Has Optional Track</option>
            </select>

            <select
              className="sem-filter-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              title="Filter by Account Status"
            >
              <option value="all">All Account Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>

            {(search || selectedBatch !== "all" || selectedCourse !== "all" || selectedStatus !== "all" || selectedEnrollFilter !== "all") && (
              <button
                className="sem-btn sem-btn-link"
                onClick={() => {
                  setSearch("");
                  setSelectedBatch("all");
                  setSelectedCourse("all");
                  setSelectedStatus("all");
                  setSelectedEnrollFilter("all");
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Floating / Inline Bulk Action Bar */}
        {selectedUserIds.length > 0 && (
          <div className="sem-bulk-action-bar">
            <div className="sem-bulk-count">
              <span>✓</span> <strong>{selectedUserIds.length}</strong> {selectedUserIds.length === 1 ? "student" : "students"} selected
            </div>
            <div className="sem-bulk-buttons">
              <button className="sem-btn sem-btn-primary sem-btn-sm" onClick={() => setBulkEnrollModal(true)}>
                🏛️ Bulk Enroll in Exam
              </button>
              <button className="sem-btn sem-btn-secondary sem-btn-sm" onClick={() => setBulkBatchModal(true)}>
                🏷️ Change Batch
              </button>
              <button className="sem-btn sem-btn-secondary sem-btn-sm" onClick={handleExportCSV}>
                📥 Export Selected
              </button>
              <button className="sem-btn sem-btn-link sem-btn-sm" onClick={() => setSelectedUserIds([])}>
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table Body */}
      <div className="sem-body">
        {loading ? (
          <div className="sem-loading">
            <div className="sem-spinner" /> Loading student records…
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="sem-empty">
            <div className="sem-empty-icon">👥</div>
            <h3>No students found</h3>
            <p>
              {students.length === 0
                ? "Register a student to configure exams and optional paper tracks."
                : "No student records match the active filter criteria."}
            </p>
            {students.length === 0 ? (
              <button className="sem-btn sem-btn-primary" style={{ marginTop: "14px" }} onClick={() => setCreateStudentModal(true)}>
                + Register First Student
              </button>
            ) : (
              <button
                className="sem-btn sem-btn-secondary"
                style={{ marginTop: "14px" }}
                onClick={() => {
                  setSearch("");
                  setSelectedBatch("all");
                  setSelectedCourse("all");
                  setSelectedEnrollFilter("all");
                  setSelectedStatus("all");
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="sem-table-wrap">
            <div className="sem-table-info-bar">
              <span>Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> candidates</span>
            </div>
            <table className="sem-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedUserIds.length === filteredStudents.length}
                      onChange={handleSelectAll}
                      title="Select / Deselect all visible"
                    />
                  </th>
                  <th>Student Info</th>
                  <th>ID & Contact</th>
                  <th>Batch / Course</th>
                  <th>Enrolled Exams & Tracks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const isSelected = selectedUserIds.includes(s.userId);
                  return (
                    <tr key={s.id || s.userId} className={isSelected ? "sem-row-selected" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(s.userId)}
                        />
                      </td>
                      <td>
                        <div className="sem-user-cell">
                          <div className="sem-avatar">{s.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="sem-name-row">
                              <strong>{s.name}</strong>
                              <span className={`sem-status-pill ${(s.status || "Active").toLowerCase()}`}>
                                {s.status || "Active"}
                              </span>
                            </div>
                            <span className="sem-email">{s.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="sem-id-wrap">
                          <span className="sem-tag-id">{s.userId}</span>
                          <button
                            className="sem-copy-btn"
                            title="Copy Student ID"
                            onClick={() => handleCopyUserId(s.userId)}
                          >
                            📋
                          </button>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "3px" }}>
                          {s.mobile ? `📞 ${s.mobile}` : "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>
                          {s.course || s.courseStream || "UPSC Civil Services"}
                        </div>
                        <span className="sem-tag-batch">🏷️ {s.batch || "General"}</span>
                      </td>
                      <td>
                        <div className="sem-exam-tags">
                          {s.enrolledExams && s.enrolledExams.length > 0 ? (
                            s.enrolledExams.map((ex, i) => (
                              <span key={i} className="sem-exam-chip">🏛️ {ex}</span>
                            ))
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic" }}>
                              Not Enrolled
                            </span>
                          )}

                          {s.optionalSubject && (
                            <span className="sem-optional-chip" title="Chosen Mains Optional Track">
                              🎯 {s.optionalSubject}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="sem-actions-row">
                          <button
                            className="sem-btn sem-btn-secondary sem-btn-sm"
                            onClick={() => { setSelectedStudent(s); setEnrollModal(true); }}
                            title="Enroll in exam"
                          >
                            🏛️ Enroll Exam
                          </button>
                          <button
                            className="sem-btn sem-btn-secondary sem-btn-sm"
                            onClick={() => { setSelectedStudent(s); setOptionalModal(true); }}
                            title="Set or update optional subject track"
                          >
                            🎯 Set Optional
                          </button>
                          <button
                            className="sem-btn sem-btn-secondary sem-btn-sm"
                            onClick={() => openOptionalHistory(s)}
                            title="View optional track audit history"
                          >
                            📜 Audit Log
                          </button>
                          <button
                            className="sem-btn sem-btn-primary sem-btn-sm"
                            onClick={() => openEligibleTests(s)}
                            title="View all tests accessible to this student"
                          >
                            ⚡ Eligible Tests
                          </button>
                          <button
                            className="sem-btn sem-btn-secondary sem-btn-sm"
                            onClick={() => openEditModal(s)}
                            title="Edit Student Profile"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Create Student Modal */}
      {createStudentModal && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCreateStudentModal(false); }}>
          <div className="sem-modal sem-modal-wide">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Register New Candidate</h3>
                <p className="sem-modal-sub">Create a student account and configure initial course stream and batch</p>
              </div>
              <button className="sem-modal-close" onClick={() => setCreateStudentModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field">
                <label className="sem-label">Full Name *</label>
                <input className="sem-input" value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ramesh Kumar" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Email Address *</label>
                <input className="sem-input" type="email" value={studentForm.email} onChange={e => setStudentForm(p => ({ ...p, email: e.target.value }))} placeholder="ramesh@example.com" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Student ID (Optional)</label>
                <input className="sem-input" value={studentForm.userId} onChange={e => setStudentForm(p => ({ ...p, userId: e.target.value }))} placeholder="Auto-generated from email if blank" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Mobile Number</label>
                <input className="sem-input" value={studentForm.mobile} onChange={e => setStudentForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Batch Code</label>
                <input className="sem-input" value={studentForm.batch} onChange={e => setStudentForm(p => ({ ...p, batch: e.target.value }))} placeholder="e.g. 2026-Batch-A" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Target Course Stream</label>
                <select className="sem-input" value={studentForm.course} onChange={e => setStudentForm(p => ({ ...p, course: e.target.value }))}>
                  {EXAM_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div className="sem-field">
                <label className="sem-label">Highest Qualification</label>
                <input className="sem-input" value={studentForm.qualification} onChange={e => setStudentForm(p => ({ ...p, qualification: e.target.value }))} placeholder="e.g. B.Tech / M.Sc / B.A" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Institute / Branch</label>
                <input className="sem-input" value={studentForm.organization} onChange={e => setStudentForm(p => ({ ...p, organization: e.target.value }))} placeholder="Main Institute / Hyderabad Campus" />
              </div>
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setCreateStudentModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleCreateStudent} disabled={saving}>
                {saving ? "Registering…" : "Register Candidate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Student Profile Modal */}
      {editStudentModal && selectedStudent && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditStudentModal(false); }}>
          <div className="sem-modal sem-modal-wide">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Edit Candidate Profile — {selectedStudent.name}</h3>
                <p className="sem-modal-sub">Update contact info, batch allocation, course stream, and account status</p>
              </div>
              <button className="sem-modal-close" onClick={() => setEditStudentModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field">
                <label className="sem-label">Full Name *</label>
                <input className="sem-input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="sem-field">
                <label className="sem-label">Email Address *</label>
                <input className="sem-input" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="sem-field">
                <label className="sem-label">Mobile Number</label>
                <input className="sem-input" value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
              </div>
              <div className="sem-field">
                <label className="sem-label">Batch Code</label>
                <input className="sem-input" value={editForm.batch} onChange={e => setEditForm(p => ({ ...p, batch: e.target.value }))} />
              </div>
              <div className="sem-field">
                <label className="sem-label">Course Stream</label>
                <select className="sem-input" value={editForm.course} onChange={e => setEditForm(p => ({ ...p, course: e.target.value }))}>
                  {EXAM_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div className="sem-field">
                <label className="sem-label">Account Status</label>
                <select className="sem-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
              <div className="sem-field">
                <label className="sem-label">Social / Reservation Category</label>
                <input className="sem-input" value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} placeholder="General / OBC / SC / ST / EWS" />
              </div>
              <div className="sem-field">
                <label className="sem-label">Organization / Branch</label>
                <input className="sem-input" value={editForm.organization} onChange={e => setEditForm(p => ({ ...p, organization: e.target.value }))} />
              </div>
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setEditStudentModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleUpdateStudent} disabled={saving}>
                {saving ? "Saving Changes…" : "Save Profile Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Enroll Exam Modal */}
      {enrollModal && selectedStudent && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEnrollModal(false); }}>
          <div className="sem-modal">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Enroll {selectedStudent.name} in Exam</h3>
                <p className="sem-modal-sub">Configure target exam target, examination year, and stage</p>
              </div>
              <button className="sem-modal-close" onClick={() => setEnrollModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field full">
                <label className="sem-label">Target Examination *</label>
                <select className="sem-input" value={enrollForm.examName} onChange={e => setEnrollForm(p => ({ ...p, examName: e.target.value }))}>
                  {EXAM_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div className="sem-field">
                <label className="sem-label">Exam Year *</label>
                <input className="sem-input" type="number" value={enrollForm.examYear} onChange={e => setEnrollForm(p => ({ ...p, examYear: Number(e.target.value) }))} />
              </div>
              <div className="sem-field">
                <label className="sem-label">Exam Stage *</label>
                <select className="sem-input" value={enrollForm.stage} onChange={e => setEnrollForm(p => ({ ...p, stage: e.target.value }))}>
                  <option value="Prelims">Preliminary Examination</option>
                  <option value="Mains">Mains Written Examination</option>
                  <option value="Interview">Personality Test / Interview</option>
                  <option value="Daily Practice">Daily Practice Series</option>
                </select>
              </div>
              <div className="sem-field full">
                <label className="sem-label">Optional Track Subject</label>
                <select className="sem-input" value={enrollForm.optionalSubject} onChange={e => setEnrollForm(p => ({ ...p, optionalSubject: e.target.value }))}>
                  {OPTIONAL_SUBJECTS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setEnrollModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleEnrollExam} disabled={saving}>
                {saving ? "Enrolling…" : "Confirm Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bulk Enroll Modal */}
      {bulkEnrollModal && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBulkEnrollModal(false); }}>
          <div className="sem-modal">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Bulk Enroll {selectedUserIds.length} Candidates</h3>
                <p className="sem-modal-sub">Enroll all selected students into an examination in one single action</p>
              </div>
              <button className="sem-modal-close" onClick={() => setBulkEnrollModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field full">
                <label className="sem-label">Examination *</label>
                <select className="sem-input" value={bulkEnrollForm.examName} onChange={e => setBulkEnrollForm(p => ({ ...p, examName: e.target.value }))}>
                  {EXAM_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div className="sem-field full">
                <label className="sem-label">Exam Year *</label>
                <input className="sem-input" type="number" value={bulkEnrollForm.examYear} onChange={e => setBulkEnrollForm(p => ({ ...p, examYear: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setBulkEnrollModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleBulkEnroll} disabled={saving}>
                {saving ? "Enrolling All…" : `Enroll ${selectedUserIds.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Bulk Batch Modal */}
      {bulkBatchModal && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBulkBatchModal(false); }}>
          <div className="sem-modal">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Reassign Batch for {selectedUserIds.length} Candidates</h3>
                <p className="sem-modal-sub">Move all selected students to a new or existing batch</p>
              </div>
              <button className="sem-modal-close" onClick={() => setBulkBatchModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field full">
                <label className="sem-label">Target Batch Code *</label>
                <input
                  className="sem-input"
                  placeholder="e.g. 2026-Batch-B or Super-50"
                  value={bulkBatchName}
                  onChange={e => setBulkBatchName(e.target.value)}
                />
              </div>
              {availableBatches.length > 0 && (
                <div className="sem-field full">
                  <label className="sem-label">Or Pick Existing Batch</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {availableBatches.map(b => (
                      <button
                        key={b}
                        type="button"
                        className={`sem-chip-btn ${bulkBatchName === b ? "active" : ""}`}
                        onClick={() => setBulkBatchName(b)}
                      >
                        🏷️ {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setBulkBatchModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleBulkBatch} disabled={saving || !bulkBatchName.trim()}>
                {saving ? "Reassigning…" : `Reassign ${selectedUserIds.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Set Optional Subject Modal */}
      {optionalModal && selectedStudent && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setOptionalModal(false); }}>
          <div className="sem-modal">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">Assign / Change Optional Subject</h3>
                <p className="sem-modal-sub">Configures candidate's mains optional paper track with mandatory audit log</p>
              </div>
              <button className="sem-modal-close" onClick={() => setOptionalModal(false)}>✕</button>
            </div>
            <div className="sem-form-grid">
              <div className="sem-field full">
                <label className="sem-label">Select Optional Track Subject *</label>
                <select className="sem-input" value={optionalForm.optionalSubject} onChange={e => setOptionalForm(p => ({ ...p, optionalSubject: e.target.value }))}>
                  {OPTIONAL_SUBJECTS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="sem-field full">
                <label className="sem-label">Reason for Track Assignment / Change * (Audit Log)</label>
                <textarea className="sem-input" rows={3} value={optionalForm.reason} onChange={e => setOptionalForm(p => ({ ...p, reason: e.target.value }))} placeholder="Explain why this track is being assigned or updated..." />
              </div>
            </div>
            <div className="sem-modal-footer">
              <button className="sem-btn sem-btn-secondary" onClick={() => setOptionalModal(false)}>Cancel</button>
              <button className="sem-btn sem-btn-primary" onClick={handleSaveOptional} disabled={saving}>
                {saving ? "Updating Track…" : "Save Optional Track"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Audit History Modal */}
      {historyModal && selectedStudent && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setHistoryModal(false); }}>
          <div className="sem-modal sem-modal-wide">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">📜 Optional Track Audit History — {selectedStudent.name}</h3>
                <p className="sem-modal-sub">Complete chronological record of all optional subject selections and changes</p>
              </div>
              <button className="sem-modal-close" onClick={() => setHistoryModal(false)}>✕</button>
            </div>
            <div className="sem-history-list">
              {optionalHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  No optional track modifications recorded for this student.
                </div>
              ) : (
                optionalHistory.map(h => (
                  <div key={h.id} className="sem-hist-card">
                    <div className="sem-hist-head">
                      <span>🔄 <strong>{h.previousSubject || "Initial"}</strong> → <span className="sem-highlight">{h.newSubject}</span></span>
                      <span className="sem-date">{new Date(h.changedAt).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="sem-hist-reason">Reason: {h.reason}</p>
                    <div className="sem-hist-by">Authorized by: <strong>{h.changedBy}</strong></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Eligible Tests Modal */}
      {eligibleModal && selectedStudent && eligibleTests && (
        <div className="sem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEligibleModal(false); }}>
          <div className="sem-modal sem-modal-wide">
            <div className="sem-modal-header">
              <div>
                <h3 className="sem-modal-title">⚡ Eligible Tests for {selectedStudent.name}</h3>
                <p className="sem-modal-sub">
                  Active Optional Track: <strong>{eligibleTests.selectedOptionalSubject || "Not Configured"}</strong> · Total Eligible Series: <strong>{eligibleTests.eligibleSeriesCount || 0}</strong>
                </p>
              </div>
              <button className="sem-modal-close" onClick={() => setEligibleModal(false)}>✕</button>
            </div>
            <div className="sem-eligible-list">
              {(eligibleTests.eligibleSeries || []).length === 0 ? (
                <div className="sem-empty" style={{ padding: "32px" }}>
                  <p>No test series are currently assigned or active for this student's course and optional track.</p>
                </div>
              ) : (
                (eligibleTests.eligibleSeries || []).map((es: any) => (
                  <div key={es.id} className="sem-eligible-card">
                    <div className="sem-eligible-head">
                      <div>
                        <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{es.name}</strong>
                        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                          Exam Type: {es.examType?.toUpperCase()} · Total Papers: {es.paperCount || es.eligiblePaperCount}
                        </div>
                      </div>
                      <span className="sem-tag-papers">{es.eligiblePaperCount} Accessible Papers</span>
                    </div>
                    <div className="sem-eligible-papers">
                      {(es.eligiblePapers || []).map((p: any) => (
                        <span key={p.id} className={`sem-paper-badge ${p.isOptional ? "optional-track" : "compulsory"}`}>
                          P{p.paperNumber}: {p.paperName} ({p.isOptional ? `Optional · ${p.optionalSubject}` : "Compulsory"})
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
};

export default StudentEnrollmentManager;
