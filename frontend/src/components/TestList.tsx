import React, { useEffect, useMemo, useState } from "react";
import "./TestList.css";
import { apiDelete, apiGet, apiPost } from "../services/api";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import ValueHelpField, { ValueHelpOption } from "./ValueHelpField";
import {
  filterAdminTests,
  filterAssignableStudents,
  type RelativeDateFilter,
  type TestDurationBand,
  type TestQuestionBand,
  type TestCutoffBand,
  type SectionCountBand,
  type AssignmentLoadBand,
} from "../utils/filterUtils";

interface Section {
  id: string;
  name: string;
}

interface Test {
  id: string;
  name: string;
  duration: number;
  questions: number;
  sections: Section[];
  createdAt: string;
  updatedAt?: string;
  availableFrom?: string;
  validUntil?: string;
  categoryId?: string; categoryName?: string; subcategoryId?: string; subcategoryName?: string; stage?: string;
  status: "active" | "draft" | "completed" | "upcoming" | "expired";
  passingPercentage: number;
  assignmentCount?: number;
  assignedColleges?: string[];
}

interface User {
  id: string;
  name: string;
  userId: string;
  email?: string;
  isActive?: boolean;
}

interface TestListProps {
  onCreateNew: () => void;
  onEditTest?: (testId: string) => void;
}

type TestSortBy =
  "newest" | "oldest" | "updated" | "name" | "duration-high" | "duration-low" |
  "questions-high" | "questions-low" | "cutoff-high" | "cutoff-low" |
  "assignments-high" | "assignments-low";

const TestList: React.FC<TestListProps> = ({ onCreateNew, onEditTest }) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<{ name: string; count: number }[]>([]);
  const [assigningTest, setAssigningTest] = useState<Test | null>(null);
  const [assignMode, setAssignMode] = useState<"students" | "batches">("students");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [testSearch, setTestSearch] = useState("");
  const [testStatusFilter, setTestStatusFilter] = useState<"" | "active" | "draft" | "completed" | "upcoming" | "expired">("");
  const testDurationFilter: TestDurationBand = "all";
  const [testSectionFilter, setTestSectionFilter] = useState("all");
  const testQuestionFilter: TestQuestionBand = "all";
  const testCutoffBand: TestCutoffBand = "all";
  const testSectionCountFilter: SectionCountBand = "all";
  const testAssignmentFilter: AssignmentLoadBand = "all";
  const testCollegeFilter = "all";
  const createdRangeFilter: RelativeDateFilter = "all";
  const updatedRangeFilter: RelativeDateFilter = "all";
  const minCutoff = "";
  const maxCutoff = "";
  const minDuration = "";
  const maxDuration = "";
  const minQuestions = "";
  const maxQuestions = "";
  const minAssignments = "";
  const maxAssignments = "";
  const createdFrom = "";
  const createdTo = "";
  const [testSortBy, setTestSortBy] = useState<TestSortBy>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const loadTests = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>("/admin/exams");
      setTests(Array.isArray(res.tests) ? res.tests : []);
    } catch (e) {
      console.error(e);
      alert("Failed to load tests from backend");
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiGet<any>("/admin/users");
      if (Array.isArray(res.users)) setAllUsers(res.users);
    } catch (e) {
      console.error("Failed to load users", e);
    }
  };

  const loadBatches = async () => {
    try {
      const res = await apiGet<any>("/admin/users/batches");
      if (res && Array.isArray(res.batches)) {
        setBatches(res.batches);
      }
    } catch (e) {
      console.error("Failed to load batches", e);
    }
  };

  useEffect(() => {
    loadTests();
    loadUsers();
    loadBatches();
  }, []);

  const testSearchOptions = useMemo<ValueHelpOption[]>(() => {
    const unique = Array.from(new Set(tests.flatMap((test) => [
      test.name,
      `${test.duration} min`,
      `${test.questions} questions`,
      `${test.passingPercentage}% cutoff`,
      `${test.assignmentCount || 0} assigned`,
      test.status,
      test.categoryName,
      test.subcategoryName,
      test.stage,
      ...(test.assignedColleges || []),
      ...(test.sections || []).map((section) => typeof section === "string" ? section : section.name),
    ])));
    return unique.filter(Boolean).slice(0, 60).map((value) => ({ value: value as string, label: value as string }));
  }, [tests]);

  const studentSearchOptions = useMemo<ValueHelpOption[]>(() => {
    const unique = Array.from(new Set(allUsers.flatMap((user) => [
      user.name, user.userId, user.email,
    ]).filter(Boolean) as string[]));
    return unique.slice(0, 40).map((value) => ({ value, label: value }));
  }, [allUsers]);

  const testStatusOptions: ValueHelpOption[] = [
    { value: "", label: "All Test Status" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "completed", label: "Completed" },
    { value: "upcoming", label: "Upcoming" },
    { value: "expired", label: "Expired" },
  ];
  const sectionOptions: ValueHelpOption[] = [
    { value: "all", label: "All Sections" },
    ...Array.from(new Set(tests.flatMap((test) => (test.sections || []).map((section) => typeof section === "string" ? section : section.name))))
      .filter(Boolean)
      .sort()
      .map((value) => ({ value: value as string, label: value as string })),
  ];
  const sortOptions: ValueHelpOption[] = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "updated", label: "Recently Updated" },
    { value: "name", label: "Name (A-Z)" },
    { value: "duration-high", label: "Longest Duration" },
    { value: "duration-low", label: "Shortest Duration" },
    { value: "questions-high", label: "Most Questions" },
    { value: "questions-low", label: "Fewest Questions" },
    { value: "cutoff-high", label: "Highest Cutoff" },
    { value: "cutoff-low", label: "Lowest Cutoff" },
    { value: "assignments-high", label: "Most Assigned" },
    { value: "assignments-low", label: "Least Assigned" },
  ];

  const studentStatusOptions: ValueHelpOption[] = [
    { value: "active", label: "Active Only" },
    { value: "inactive", label: "Inactive Only" },
    { value: "all", label: "All Students" },
  ];

  const filteredTests = useMemo(() => {
    return filterAdminTests(tests, {
      search: testSearch,
      status: testStatusFilter,
      durationBand: testDurationFilter,
      section: testSectionFilter,
      questionBand: testQuestionFilter,
      cutoffBand: testCutoffBand,
      sectionCountBand: testSectionCountFilter,
      assignmentLoad: testAssignmentFilter,
      college: testCollegeFilter,
      createdRange: createdRangeFilter,
      updatedRange: updatedRangeFilter,
      minCutoff,
      maxCutoff,
      minDuration,
      maxDuration,
      minQuestions,
      maxQuestions,
      minAssignments,
      maxAssignments,
      createdFrom,
      createdTo,
      sortBy: testSortBy,
    });
  }, [
    tests, testSearch, testStatusFilter, testDurationFilter, testSectionFilter, testQuestionFilter,
    testCutoffBand, testSectionCountFilter, testAssignmentFilter, testCollegeFilter,
    createdRangeFilter, updatedRangeFilter, minCutoff, maxCutoff, minDuration, maxDuration,
    minQuestions, maxQuestions, minAssignments, maxAssignments, createdFrom, createdTo, testSortBy,
  ]);

  const filteredUsers = useMemo(() => {
    return filterAssignableStudents(allUsers, {
      search: studentSearch,
      stream: "",
      college: "",
      status: statusFilter,
    });
  }, [allUsers, studentSearch, statusFilter]);

  const filteredUserIds = useMemo(() => filteredUsers.map((user) => user.userId), [filteredUsers]);
  const allSelected = filteredUserIds.length > 0 && filteredUserIds.every((userId) => selectedUserIds.includes(userId));
  const someSelected = filteredUserIds.some((userId) => selectedUserIds.includes(userId)) && !allSelected;

  const handleSelectAll = () => {
    setSelectedUserIds((prev) => {
      if (allSelected) return prev.filter((userId) => !filteredUserIds.includes(userId));
      return Array.from(new Set([...prev, ...filteredUserIds]));
    });
  };

  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches;
    const q = batchSearch.toLowerCase();
    return batches.filter((b) => b.name.toLowerCase().includes(q));
  }, [batches, batchSearch]);

  const allBatchesSelected = filteredBatches.length > 0 && filteredBatches.every((b) => selectedBatches.includes(b.name));
  const someBatchesSelected = filteredBatches.some((b) => selectedBatches.includes(b.name)) && !allBatchesSelected;

  const handleSelectAllBatches = () => {
    const names = filteredBatches.map((b) => b.name);
    setSelectedBatches((prev) => {
      if (allBatchesSelected) return prev.filter((name) => !names.includes(name));
      return Array.from(new Set([...prev, ...names]));
    });
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    variant?: DialogVariant;
    icon?: string;
    onConfirm: () => void;
  } | null>(null);

  const deleteTest = (id: string, testName?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Assessment?",
      message: (
        <span>
          Are you sure you want to delete {testName ? <strong>"{testName}"</strong> : "this test"}? This action cannot be undone.
        </span>
      ),
      confirmText: "Yes, Delete Test",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiDelete(`/admin/exams/${id}`);
          setTests((prev) => prev.filter((t) => t.id !== id));
          if (selectedTest?.id === id) setSelectedTest(null);
        } catch (e) {
          console.error(e);
        }
      },
    });
  };

  const handleEdit = (testId: string) => {
    if (onEditTest) onEditTest(testId);
  };

  const getStatusColor = (status: string) => {
    if (status === "active") return "status-active";
    if (status === "draft") return "status-draft";
    if (status === "completed") return "status-completed";
    if (status === "upcoming") return "status-upcoming";
    if (status === "expired") return "status-expired";
    return "";
  };

  const formatValidityDate = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "No expiry";

  const activeFilterCount = [
    Boolean(testSearch.trim()),
    Boolean(testStatusFilter),
    testSectionFilter !== "all",
    testSortBy !== "newest",
  ].filter(Boolean).length;

  return (
    <div className="test-list" style={{ paddingTop: "2rem" }}>
      <div className="page-header">
        <h2>All Tests</h2>
        <div className="test-list-toolbar">
          <button className="filter-toggle-btn" onClick={() => setShowFilters((prev) => !prev)}>
            <span className="filter-toggle-icon" aria-hidden="true">{showFilters ? "−" : "+"}</span>
            <span className="filter-toggle-label">{showFilters ? "Hide Filters" : "Show Filters"}</span>
            {activeFilterCount > 0 && <span className="filter-toggle-count">{activeFilterCount}</span>}
          </button>
          <button className="primary-btn" onClick={loadTests}>Refresh</button>
          <button className="primary-btn" onClick={onCreateNew}>+ Create New Test</button>
        </div>
      </div>

      {loading && <p style={{ color: "#6a6d70" }}>Loading tests...</p>}

      {showFilters && (
        <section className="filters-panel">
          <div className="filters-panel-header">
            <div>
              <h3>Filter Tests</h3>
              <p>Refine the list only when you need it.</p>
            </div>
          </div>

          <div className="test-list-filters">
            <ValueHelpField label="Search Tests" placeholder="Search by name or section..." value={testSearch} options={testSearchOptions} onChange={setTestSearch} allowFreeText />
            <ValueHelpField label="Status" placeholder="All Test Status" value={testStatusFilter} options={testStatusOptions} onChange={(value) => setTestStatusFilter(value as "" | "active" | "draft" | "completed" | "upcoming" | "expired")} />
            <ValueHelpField label="Section" placeholder="All Sections" value={testSectionFilter} options={sectionOptions} onChange={setTestSectionFilter} />
            <ValueHelpField label="Sort By" placeholder="Newest First" value={testSortBy} options={sortOptions} onChange={(value) => setTestSortBy(value as TestSortBy)} />
          </div>
        </section>
      )}

      <div className="tests-grid">
        {filteredTests.map((test) => (
          <div key={test.id} className="test-card">
            <div className="test-card-header">
              <h3>{test.name}</h3>
              <span className={`status-badge ${getStatusColor(test.status)}`}>{test.status}</span>
            </div>
            <div className="test-card-body">
              <div className="test-info"><span className="info-label">Duration:</span><span className="info-value">{test.duration} min</span></div>
              <div className="test-info"><span className="info-label">Questions:</span><span className="info-value">{test.questions}</span></div>
              <div className="test-info"><span className="info-label">Cutoff:</span><span className="info-value">{test.passingPercentage}%</span></div>
              <div className="test-info"><span className="info-label">Assigned:</span><span className="info-value">{test.assignmentCount || 0}</span></div>
              <div className="test-info"><span className="info-label">Classification:</span><span className="info-value">{[test.categoryName,test.subcategoryName,test.stage].filter(Boolean).join(" / ") || "Unclassified"}</span></div>
              <div className="test-info"><span className="info-label">Sections:</span><span className="info-value">{Array.isArray(test.sections) ? test.sections.map((s) => typeof s === "string" ? s : s.name).join(", ") : "N/A"}</span></div>
              <div className="test-info validity-date"><span className="info-label">Start</span><span className="info-value">{formatValidityDate(test.availableFrom || test.createdAt)}</span></div>
              <div className="test-info validity-date"><span className="info-label">Valid until</span><span className="info-value">{formatValidityDate(test.validUntil)}</span></div>
            </div>
            <div className="test-card-actions">
              <button className="action-btn view-btn" onClick={() => setSelectedTest(test)}>View Details</button>
              <button className="action-btn edit-btn" onClick={() => handleEdit(test.id)}>Edit</button>
              <button
                className="action-btn edit-btn"
                onClick={() => {
                  setAssigningTest(test);
                  setAssignMode("students");
                  setSelectedUserIds([]);
                  setSelectedBatches([]);
                  setStudentSearch("");
                  setBatchSearch("");
                  setStatusFilter("active");
                  loadBatches();
                }}
              >
                Assign
              </button>
              <button className="action-btn delete-btn" onClick={() => deleteTest(test.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredTests.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon-wrap">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3>{tests.length === 0 ? "No tests created yet" : "No tests match the current search"}</h3>
          <p>{tests.length === 0 ? "Create your first test to get started" : "Try another search term or clear active filters."}</p>
          <button className="primary-btn" onClick={onCreateNew}>+ Create Test</button>
        </div>
      )}

      {selectedTest && (
        <div className="modal-overlay" onClick={() => setSelectedTest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTest.name}</h2>
              <button className="close-btn" onClick={() => setSelectedTest(null)}>x</button>
            </div>
            <div className="modal-body">
              <div className="detail-row"><span className="detail-label">Duration:</span><span>{selectedTest.duration} minutes</span></div>
              <div className="detail-row"><span className="detail-label">Total Questions:</span><span>{selectedTest.questions}</span></div>
              <div className="detail-row"><span className="detail-label">Passing Cutoff:</span><span>{selectedTest.passingPercentage}%</span></div>
              <div className="detail-row"><span className="detail-label">Assigned Students:</span><span>{selectedTest.assignmentCount || 0}</span></div>
              <div className="detail-row">
                <span className="detail-label">Sections:</span>
                <div className="section-tags">
                  {selectedTest.sections.map((section) => (
                    <span key={typeof section === "string" ? section : section.id} className="section-tag">{typeof section === "string" ? section : section.name}</span>
                  ))}
                </div>
              </div>
              <div className="detail-row"><span className="detail-label">Status:</span><span className={`status-badge ${getStatusColor(selectedTest.status)}`}>{selectedTest.status}</span></div>
              <div className="detail-row"><span className="detail-label">Created:</span><span>{new Date(selectedTest.createdAt).toLocaleString()}</span></div>
              <div className="detail-row"><span className="detail-label">Available from:</span><span>{formatValidityDate(selectedTest.availableFrom || selectedTest.createdAt)}</span></div>
              <div className="detail-row"><span className="detail-label">Valid until:</span><span>{formatValidityDate(selectedTest.validUntil)}</span></div>
              <div className="detail-row"><span className="detail-label">Updated:</span><span>{new Date(selectedTest.updatedAt || selectedTest.createdAt).toLocaleString()}</span></div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setSelectedTest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {assigningTest && (
        <div className="modal-overlay" onClick={() => setAssigningTest(null)}>
          <div className="modal-content assign-modal-content" style={{ width: "min(640px, 95vw)", maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Assessment: {assigningTest.name}</h2>
              <button className="close-btn" onClick={() => setAssigningTest(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="assign-tab-nav">
              <button
                type="button"
                className={`assign-tab-btn ${assignMode === "students" ? "active" : ""}`}
                onClick={() => setAssignMode("students")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Individual Students {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
              </button>
              <button
                type="button"
                className={`assign-tab-btn ${assignMode === "batches" ? "active" : ""}`}
                onClick={() => setAssignMode("batches")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Batch Wise {selectedBatches.length > 0 && `(${selectedBatches.length})`}
              </button>
            </div>

            <div className="modal-body">
              {assignMode === "students" ? (
                <>
                  {allUsers.length === 0 && <p style={{ color: "#6a6d70" }}>No users available</p>}
                  {allUsers.length > 0 && (
                    <div className="assign-filter-wrap">
                      <div className="assign-filter-grid">
                        <ValueHelpField label="Search Students" placeholder="Search by name, username or email" value={studentSearch} options={studentSearchOptions} onChange={setStudentSearch} allowFreeText />
                        <ValueHelpField label="Status" placeholder="Active Only" value={statusFilter} options={studentStatusOptions} onChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")} />
                      </div>
                      <div className="assign-selection-meta">
                        <span>{filteredUsers.length} students shown</span>
                      </div>
                      <label className="assign-select-all">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => { if (input) input.indeterminate = someSelected; }}
                          onChange={handleSelectAll}
                        />
                        <span className="assign-select-all-text">
                          {allSelected ? "Deselect All" : "Select All"}
                          {selectedUserIds.length > 0 && ` (${selectedUserIds.length} selected)`}
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="assign-user-list">
                    {filteredUsers.map((user) => (
                      <label key={user.userId} className="assign-user-row">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.userId)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds((prev) => [...prev, user.userId]);
                            else setSelectedUserIds((prev) => prev.filter((id) => id !== user.userId));
                          }}
                        />
                        <div className="assign-user-copy">
                          <span>{user.name} ({user.userId})</span>
                          <small>{user.email || "No email address"}</small>
                        </div>
                      </label>
                    ))}
                    {filteredUsers.length === 0 && <p className="assign-empty-state">No students match the current filters.</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="assign-filter-wrap">
                    <div style={{ marginBottom: "10px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px", textTransform: "uppercase" }}>
                        Search Batches
                      </label>
                      <input
                        type="text"
                        className="batch-assign-search-input"
                        placeholder="Search batches by name..."
                        value={batchSearch}
                        onChange={(e) => setBatchSearch(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #cbd5e1",
                          fontSize: "13.5px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div className="assign-selection-meta">
                      <span>{filteredBatches.length} batch(es) available</span>
                    </div>
                    <label className="assign-select-all">
                      <input
                        type="checkbox"
                        checked={allBatchesSelected}
                        ref={(input) => { if (input) input.indeterminate = someBatchesSelected; }}
                        onChange={handleSelectAllBatches}
                      />
                      <span className="assign-select-all-text">
                        {allBatchesSelected ? "Deselect All Batches" : "Select All Batches"}
                        {selectedBatches.length > 0 && ` (${selectedBatches.length} selected)`}
                      </span>
                    </label>
                  </div>

                  <div className="assign-user-list">
                    {filteredBatches.map((b) => (
                      <label key={b.name} className="assign-user-row">
                        <input
                          type="checkbox"
                          checked={selectedBatches.includes(b.name)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBatches((prev) => [...prev, b.name]);
                            else setSelectedBatches((prev) => prev.filter((name) => name !== b.name));
                          }}
                        />
                        <div className="assign-user-copy" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                              <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                            {b.name}
                          </span>
                          <span style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: "12px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                          }}>
                            {b.count} {b.count === 1 ? "student" : "students"}
                          </span>
                        </div>
                      </label>
                    ))}
                    {filteredBatches.length === 0 && (
                      <p className="assign-empty-state">
                        {batches.length === 0 ? "No batches created yet. Assign batches to students under Candidates first." : "No batches match search."}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="secondary-btn"
                style={{ padding: "0.6rem 1.2rem", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 600 }}
                onClick={() => setAssigningTest(null)}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                disabled={assignMode === "students" ? selectedUserIds.length === 0 : selectedBatches.length === 0}
                onClick={async () => {
                  try {
                    if (assignMode === "batches") {
                      const res = await apiPost<any>(`/admin/exams/${assigningTest.id}/assign`, { batches: selectedBatches });
                      alert(res.message || `Test assigned successfully to ${selectedBatches.length} batch(es)!`);
                    } else {
                      const res = await apiPost<any>(`/admin/exams/${assigningTest.id}/assign`, { userIds: selectedUserIds });
                      alert(res.message || `Test assigned successfully to ${selectedUserIds.length} student(s)!`);
                    }
                    setAssigningTest(null);
                    loadTests();
                  } catch (err) {
                    console.error(err);
                    alert("Failed to assign test");
                  }
                }}
              >
                {assignMode === "batches"
                  ? `Assign to ${selectedBatches.length} Batch(es)`
                  : `Assign to ${selectedUserIds.length} Student(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* In-Screen Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default TestList;
