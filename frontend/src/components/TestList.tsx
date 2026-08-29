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
  const [assigningTest, setAssigningTest] = useState<Test | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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

  useEffect(() => {
    loadTests();
    loadUsers();
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
              <button className="action-btn edit-btn" onClick={() => { setAssigningTest(test); setSelectedUserIds([]); setStudentSearch(""); setStatusFilter("active"); }}>Assign</button>
              <button className="action-btn delete-btn" onClick={() => deleteTest(test.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredTests.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">No Results</div>
          <h3>{tests.length === 0 ? "No tests created yet" : "No tests match the current search"}</h3>
          <p>{tests.length === 0 ? "Create your first test to get started" : "Try another value-help suggestion or clear a few filters."}</p>
          <button className="primary-btn" onClick={onCreateNew}>Create Test</button>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Test: {assigningTest.name}</h2>
              <button className="close-btn" onClick={() => setAssigningTest(null)}>x</button>
            </div>
            <div className="modal-body">
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
            </div>
            <div className="modal-footer">
              <button
                className="primary-btn"
                disabled={selectedUserIds.length === 0}
                onClick={async () => {
                  try {
                    await apiPost(`/admin/exams/${assigningTest.id}/assign`, { userIds: selectedUserIds });
                    alert("Test assigned successfully");
                    setAssigningTest(null);
                    loadTests();
                  } catch (err) {
                    console.error(err);
                    alert("Failed to assign test");
                  }
                }}
              >
                Assign Test
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
