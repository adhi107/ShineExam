import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserManagement from "./UserManagement";
import TestBuilder from "./TestBuilder";
import TestEditor from "./TestEditor";
import TestList from "./TestList";
import TestResults from "./TestResults";
import ExamCategoryManagement from "./ExamCategoryManagement";
import DocumentManagement from "./DocumentManagement";
import AnnouncementManagement from "./AnnouncementManagement";
import SecurityViolations from "./SecurityViolations";
import AuditLogs from "./AuditLogs";
import AdminSecurityControls from "./AdminSecurityControls";
import ShineLogo from "./ShineLogo";
import AdminVideos from "./AdminVideos";
import AppIcon from "./AppIcons";
import AdminTestSeriesDashboard from "./TestSeries/AdminTestSeriesDashboard";
import StudentEnrollmentManager from "./Enrollment/StudentEnrollmentManager";
import QuestionBankDashboard from "./QuestionBank/QuestionBankDashboard";
import CurrentAffairsHub from "./CurrentAffairs/CurrentAffairsHub";
import { apiGet, apiPost } from "../services/api";
import { useTenant } from "../context/TenantContext";
import "./AdminDashboard.css";
import "./AdminPolish.css";

type AdminView =
  | "dashboard"
  | "users"
  | "enrollment"
  | "question-bank"
  | "current-affairs"
  | "violations"
  | "audit-logs"
  | "security-controls"
  | "categories"
  | "documents"
  | "announcements"
  | "videos"
  | "tests"
  | "create-test"
  | "edit-test"
  | "results"
  | "test-series";

const paths: Record<AdminView, string> = {
  dashboard: "/admin",
  users: "/admin/users",
  enrollment: "/admin/enrollments",
  "question-bank": "/admin/question-bank",
  "current-affairs": "/admin/current-affairs",
  violations: "/admin/violations",
  "audit-logs": "/admin/audit-logs",
  "security-controls": "/admin/security-controls",
  categories: "/admin/exam-categories",
  documents: "/admin/documents",
  announcements: "/admin/announcements",
  videos: "/admin/videos",
  tests: "/admin/tests",
  "create-test": "/admin/tests/create",
  "edit-test": "/admin/tests/edit",
  results: "/admin/results",
  "test-series": "/admin/test-series",
};

const views: Record<string, AdminView> = {
  "/admin": "dashboard",
  "/admin/users": "users",
  "/admin/enrollments": "enrollment",
  "/admin/question-bank": "question-bank",
  "/admin/current-affairs": "current-affairs",
  "/admin/violations": "violations",
  "/admin/audit-logs": "audit-logs",
  "/admin/security-controls": "security-controls",
  "/admin/exam-categories": "categories",
  "/admin/documents": "documents",
  "/admin/announcements": "announcements",
  "/admin/videos": "videos",
  "/admin/tests": "tests",
  "/admin/tests/create": "create-test",
  "/admin/tests/edit": "edit-test",
  "/admin/results": "results",
  "/admin/test-series": "test-series",
};

interface RecentAttempt {
  id: string;
  userId: string;
  testName: string;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalTests: number;
  activeTests: number;
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  passRate: number;
  recentAttempts: RecentAttempt[];
}

interface Props {
  adminName: string;
  onLogout: () => void;
}

const initialStats: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  blockedUsers: 0,
  totalTests: 0,
  activeTests: 0,
  totalAttempts: 0,
  completedAttempts: 0,
  averageScore: 0,
  passRate: 0,
  recentAttempts: [],
};

const AdminDashboard: React.FC<Props> = ({ adminName, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = views[location.pathname] || "dashboard";
  const go = (view: AdminView) => navigate(paths[view]);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const { loadTenantBranding } = useTenant();

  useEffect(() => {
    const tid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId");
    if (tid) {
      loadTenantBranding(tid);
    }
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("shine_admin_sidebar_collapsed") === "true"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("shine_admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const closeMobileSidebar = () => { setMobileOpen(false); setShowMoreSheet(false); };
  const goMobile = (view: AdminView) => { go(view); closeMobileSidebar(); };

  useEffect(() => {
    if (currentView === "dashboard") {
      apiGet<DashboardStats>("/admin/dashboard-stats").then(setStats).catch(console.error);
    }
  }, [currentView]);

  const closePassword = () => {
    setShowPassword(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const changePassword = async () => {
    if (!oldPassword || newPassword.length < 4 || newPassword !== confirmPassword) {
      alert("Enter the current password and matching new passwords of at least 4 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      await apiPost("/auth/change-password", {
        userId: adminName,
        role: "admin",
        oldPassword,
        newPassword,
      });
      closePassword();
      alert("Password changed successfully.");
    } catch (error: any) {
      alert(error?.message || "Password could not be changed.");
    } finally {
      setSavingPassword(false);
    }
  };

  const render = () => {
    if (currentView === "users") return <UserManagement />;
    if (currentView === "enrollment") return <StudentEnrollmentManager />;
    if (currentView === "question-bank") return <QuestionBankDashboard />;
    if (currentView === "current-affairs") return <CurrentAffairsHub isAdmin={true} />;
    if (currentView === "violations") return <SecurityViolations />;
    if (currentView === "audit-logs") return <AuditLogs />;
    if (currentView === "security-controls") return <AdminSecurityControls />;
    if (currentView === "categories") return <ExamCategoryManagement />;
    if (currentView === "documents") return <DocumentManagement />;
    if (currentView === "announcements") return <AnnouncementManagement />;
    if (currentView === "create-test") return <TestBuilder onBack={() => go("tests")} />;
    if (currentView === "edit-test") {
      return editingTestId ? (
        <TestEditor testId={editingTestId} onBack={() => go("tests")} />
      ) : (
        <TestList
          onCreateNew={() => go("create-test")}
          onEditTest={(id) => {
            setEditingTestId(id);
            go("edit-test");
          }}
        />
      );
    }
    if (currentView === "tests") {
      return (
        <TestList
          onCreateNew={() => go("create-test")}
          onEditTest={(id) => {
            setEditingTestId(id);
            go("edit-test");
          }}
        />
      );
    }
    if (currentView === "videos") return <AdminVideos />;
    if (currentView === "results") return <TestResults />;
    if (currentView === "test-series") return <AdminTestSeriesDashboard />;
    return <AdminHome adminName={adminName} stats={stats} go={go} />;
  };

  const isDesktopCollapsed = sidebarCollapsed && !mobileOpen;

  return (
    <div className="shine-admin-shell">
      {/* Mobile-only topbar with hamburger */}
      <div className="admin-mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            className={`admin-hamburger-btn ${mobileOpen ? "open" : ""}`}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            <span /><span /><span />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span className="admin-mobile-title">
              {/* Show current section name on mobile */}
              {currentView === 'dashboard' ? 'Admin Console'
                : currentView === 'users' ? 'Students'
                : currentView === 'enrollment' ? 'Enrollment & Optional'
                : currentView === 'question-bank' ? 'Question Bank'
                : currentView === 'current-affairs' ? 'Current Affairs'
                : currentView === 'tests' ? 'Tests'
                : currentView === 'create-test' ? 'Create Test'
                : currentView === 'edit-test' ? 'Edit Test'
                : currentView === 'results' ? 'Analytics'
                : currentView === 'violations' ? 'Violations'
                : currentView === 'audit-logs' ? 'Audit Logs'
                : currentView === 'security-controls' ? 'Security Controls'
                : currentView === 'categories' ? 'Exam Categories'
                : currentView === 'documents' ? 'Documents'
                : currentView === 'announcements' ? 'Announcements'
                : currentView === 'videos' ? 'Classes & Videos'
                : currentView === 'test-series' ? 'Test Series'
                : 'Admin Console'}
            </span>
          </div>
        </div>
        <div className="admin-mobile-topbar-right">
          <button
            type="button"
            className="admin-mobile-pw-btn"
            onClick={() => setShowPassword(true)}
            title="Change password"
            aria-label="Change password"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1 1" />
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="m11.5 11.5 8.5-8.5" />
            </svg>
          </button>
          <button className="admin-mobile-signout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      {/* Backdrop overlay (mobile) */}
      <div
        className={`admin-mobile-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobileSidebar}
      />

      <aside className={`shine-admin-sidebar ${isDesktopCollapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="admin-brand" onClick={toggleSidebar} style={{ cursor: "pointer" }} title={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ShineLogo compact={isDesktopCollapsed} inverse={true} />
          {!isDesktopCollapsed && (
            <div className="admin-brand-text">
              <span className="admin-brand-main">ADMIN CONSOLE</span>
              {sessionStorage.getItem("activeTenantId") && sessionStorage.getItem("activeTenantId") !== "default" && (
                <span className="admin-brand-sub" style={{ fontSize: "10px", opacity: 0.75, display: "block" }}>
                  [{sessionStorage.getItem("activeTenantId")}]
                </span>
              )}
            </div>
          )}
          {mobileOpen && (
            <button
              type="button"
              className="admin-drawer-close-btn"
              onClick={closeMobileSidebar}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* If Super Admin is inspecting this tenant, show quick return button */}
        {sessionStorage.getItem("role") === "super_admin" && (
          <div style={{ padding: "6px 12px 10px" }}>
            <button
              type="button"
              onClick={() => navigate("/super-admin")}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                border: "none",
                color: "#ffffff",
                padding: "7px 10px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>← Super Admin Portal</span>
            </button>
          </div>
        )}

        <nav>
          <Nav active={currentView === "dashboard"} icon="dashboard" label="Dashboard" collapsed={isDesktopCollapsed} onClick={() => goMobile("dashboard")} />
          <Nav active={currentView === "users"} icon="users" label="Students" collapsed={isDesktopCollapsed} onClick={() => goMobile("users")} />
          <Nav active={currentView === "categories"} icon="categories" label="Exam Categories" collapsed={isDesktopCollapsed} onClick={() => goMobile("categories")} />
          <Nav active={["tests", "create-test", "edit-test"].includes(currentView)} icon="tests" label="Tests" collapsed={isDesktopCollapsed} onClick={() => goMobile("tests")} />
          <Nav active={currentView === "videos"} icon="videos" label="Videos" collapsed={isDesktopCollapsed} onClick={() => goMobile("videos")} />
          <Nav active={currentView === "documents"} icon="documents" label="Documents" collapsed={isDesktopCollapsed} onClick={() => goMobile("documents")} />
          <Nav active={currentView === "enrollment"} icon="users" label="Enrollment & Optional" collapsed={isDesktopCollapsed} onClick={() => goMobile("enrollment")} />
          <Nav active={currentView === "question-bank"} icon="documents" label="Question Bank" collapsed={isDesktopCollapsed} onClick={() => goMobile("question-bank")} />
          <Nav active={currentView === "current-affairs"} icon="documents" label="Current Affairs" collapsed={isDesktopCollapsed} onClick={() => goMobile("current-affairs")} />
          <Nav active={currentView === "test-series"} icon="results" label="Test Series" collapsed={isDesktopCollapsed} onClick={() => goMobile("test-series")} />
          <Nav active={currentView === "announcements"} icon="documents" label="Announcements" collapsed={isDesktopCollapsed} onClick={() => goMobile("announcements")} />
          <Nav active={currentView === "results"} icon="results" label="Analytics" collapsed={isDesktopCollapsed} onClick={() => goMobile("results")} />
          <Nav active={currentView === "violations"} icon="violations" label="Violations" collapsed={isDesktopCollapsed} onClick={() => goMobile("violations")} />
          <Nav active={currentView === "audit-logs"} icon="audit" label="Audit Logs" collapsed={isDesktopCollapsed} onClick={() => goMobile("audit-logs")} />
          <Nav active={currentView === "security-controls"} icon="controls" label="Access Controls" collapsed={isDesktopCollapsed} onClick={() => goMobile("security-controls")} />
        </nav>

        <div className="admin-sidebar-user">
          <div>
            <span>{(adminName || "A").charAt(0).toUpperCase()}</span>
            {!isDesktopCollapsed && (
              <p>
                <strong>{adminName || "Admin"}</strong>
                <small>{sessionStorage.getItem("role") === "super_admin" ? "Super Admin" : "Administrator"}</small>
              </p>
            )}
          </div>
          {!isDesktopCollapsed ? (
            <>
              <button onClick={() => setShowPassword(true)}>Change password</button>
              <button className="admin-signout" onClick={onLogout}>Sign out</button>
            </>
          ) : (
            <button className="admin-signout icon-only" onClick={onLogout} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          )}
        </div>
      </aside>
      <main className={`shine-admin-main ${isDesktopCollapsed ? "collapsed" : ""}`}>
        {render()}
      </main>

      {/* Admin Native Mobile Bottom Navigation Bar */}
      <nav className="admin-mobile-app-bottom-nav" aria-label="Admin Mobile Navigation">
        <button
          type="button"
          className={`admin-mobile-bottom-nav-item ${currentView === "dashboard" ? "active" : ""}`}
          onClick={() => goMobile("dashboard")}
        >
          <div className="admin-mobile-bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <span className="admin-mobile-bottom-nav-label">Home</span>
        </button>

        <button
          type="button"
          className={`admin-mobile-bottom-nav-item ${currentView === "users" ? "active" : ""}`}
          onClick={() => goMobile("users")}
        >
          <div className="admin-mobile-bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="admin-mobile-bottom-nav-label">Students</span>
        </button>

        <button
          type="button"
          className={`admin-mobile-bottom-nav-item ${["tests", "create-test", "edit-test", "test-series"].includes(currentView) ? "active" : ""}`}
          onClick={() => goMobile("tests")}
        >
          <div className="admin-mobile-bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="admin-mobile-bottom-nav-label">Tests</span>
        </button>

        <button
          type="button"
          className={`admin-mobile-bottom-nav-item ${currentView === "videos" ? "active" : ""}`}
          onClick={() => goMobile("videos")}
        >
          <div className="admin-mobile-bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <span className="admin-mobile-bottom-nav-label">Videos</span>
        </button>

        <button
          type="button"
          className={`admin-mobile-bottom-nav-item ${showMoreSheet || !["dashboard", "users", "tests", "create-test", "edit-test", "videos"].includes(currentView) ? "active" : ""}`}
          onClick={() => setShowMoreSheet(true)}
        >
          <div className="admin-mobile-bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </div>
          <span className="admin-mobile-bottom-nav-label">More</span>
        </button>
      </nav>

      {/* Admin Mobile More Action Sheet */}
      {showMoreSheet && (
        <div className="admin-more-sheet-backdrop" onMouseDown={() => setShowMoreSheet(false)}>
          <section className="admin-more-sheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-more-sheet-handle" />
            <header className="admin-more-sheet-header">
              <div>
                <span>MANAGEMENT & TOOLS</span>
                <h3>All Admin Features</h3>
              </div>
              <button className="admin-more-sheet-close" onClick={() => setShowMoreSheet(false)}>✕</button>
            </header>

            <div className="admin-more-sheet-grid">
              <button className={`admin-more-card ${currentView === "results" ? "active" : ""}`} onClick={() => goMobile("results")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(37, 99, 235, 0.12)", color: "#2563eb" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                </div>
                <span>Analytics</span>
              </button>

              <button className={`admin-more-card ${currentView === "current-affairs" ? "active" : ""}`} onClick={() => goMobile("current-affairs")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#2563eb" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                </div>
                <span>Current Affairs</span>
              </button>

              <button className={`admin-more-card ${currentView === "test-series" ? "active" : ""}`} onClick={() => goMobile("test-series")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(147, 51, 234, 0.12)", color: "#9333ea" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                </div>
                <span>Test Series</span>
              </button>

              <button className={`admin-more-card ${currentView === "question-bank" ? "active" : ""}`} onClick={() => goMobile("question-bank")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <span>Question Bank</span>
              </button>

              <button className={`admin-more-card ${currentView === "categories" ? "active" : ""}`} onClick={() => goMobile("categories")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
                <span>Exam Categories</span>
              </button>

              <button className={`admin-more-card ${currentView === "documents" ? "active" : ""}`} onClick={() => goMobile("documents")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(6, 182, 212, 0.12)", color: "#0891b2" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span>Documents</span>
              </button>

              <button className={`admin-more-card ${currentView === "enrollment" ? "active" : ""}`} onClick={() => goMobile("enrollment")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#4f46e5" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span>Enrollment</span>
              </button>

              <button className={`admin-more-card ${currentView === "announcements" ? "active" : ""}`} onClick={() => goMobile("announcements")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(249, 115, 22, 0.12)", color: "#ea580c" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <span>Announcements</span>
              </button>

              <button className={`admin-more-card ${currentView === "violations" ? "active" : ""}`} onClick={() => goMobile("violations")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(225, 29, 72, 0.12)", color: "#e11d48" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <span>Violations</span>
              </button>

              <button className={`admin-more-card ${currentView === "audit-logs" ? "active" : ""}`} onClick={() => goMobile("audit-logs")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(100, 116, 139, 0.12)", color: "#475569" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <span>Audit Logs</span>
              </button>

              <button className={`admin-more-card ${currentView === "security-controls" ? "active" : ""}`} onClick={() => goMobile("security-controls")}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(14, 165, 233, 0.12)", color: "#0284c7" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <span>Access Controls</span>
              </button>

              <button className="admin-more-card" onClick={() => { setShowPassword(true); setShowMoreSheet(false); }}>
                <div className="admin-more-icon-badge" style={{ background: "rgba(20, 184, 166, 0.12)", color: "#0d9488" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><circle cx="12" cy="16" r="1"/></svg>
                </div>
                <span>Password</span>
              </button>
            </div>

            <footer className="admin-more-sheet-footer">
              <button className="admin-more-sheet-signout" onClick={onLogout}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out of Admin Portal
              </button>
            </footer>
          </section>
        </div>
      )}
      {showPassword && (
        <div className="admin-password-backdrop" onMouseDown={closePassword}>
          <section onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>ACCOUNT SECURITY</span>
                <h2>Change password</h2>
              </div>
              <button onClick={closePassword}>×</button>
            </header>
            <label>Current password<input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} /></label>
            <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <footer>
              <button onClick={closePassword}>Cancel</button>
              <button disabled={savingPassword} onClick={changePassword}>{savingPassword ? "Updating…" : "Update password"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

const Nav=({active,icon,label,collapsed,onClick}:any)=><button className={active?"active":""} onClick={onClick} title={collapsed ? label : ""}><AppIcon name={icon}/>{!collapsed && <span>{label}</span>}</button>;
const AdminHome=({adminName="Admin",stats,go}:{adminName:string;stats:DashboardStats;go:(view:AdminView)=>void})=>{
  const { tenant } = useTenant();
  const totalUsers = Number(stats?.totalUsers || 0);
  const activeUsers = Number(stats?.activeUsers || 0);
  const blockedUsers = Number(stats?.blockedUsers || 0);
  const totalTests = Number(stats?.totalTests || 0);
  const activeTests = Number(stats?.activeTests || 0);
  const completedAttempts = Number(stats?.completedAttempts || 0);
  const totalAttempts = Number(stats?.totalAttempts || 0);
  const averageScore = Number(stats?.averageScore || 0);
  const passRate = Number(stats?.passRate || 0);
  const recentAttempts = Array.isArray(stats?.recentAttempts) ? stats.recentAttempts : [];
  const safeAdminName = adminName || "Admin";
  const tenantKicker = tenant?.name ? `${tenant.name.toUpperCase()} OPERATIONS` : "EXAM OPERATIONS";

  const cards=[
    ["Students",totalUsers,"Registered candidate accounts","users","users","theme-blue"],
    ["Active students",activeUsers,"Candidates allowed to sign in","users","users","theme-emerald"],
    ["Blocked students",blockedUsers,"Accounts requiring attention","users","users","theme-amber"],
    ["Published tests",activeTests,`${totalTests} tests in total`,"tests","tests","theme-indigo"],
    ["Completed attempts",completedAttempts,`${totalAttempts} attempts started`,"results","completed","theme-teal"],
    ["Average score",`${averageScore.toFixed(1)}%`,"Across every completed paper","results","results","theme-purple"],
    ["Overall pass rate",`${passRate.toFixed(1)}%`,"Candidate success rate","results","completed","theme-emerald"],
    ["Pending attempts",Math.max(0,totalAttempts-completedAttempts),"Tests currently in progress","results","tests","theme-sky"],
  ] as any[];
  return (
    <section className="admin-home">
      <header className="admin-home-header">
        <div>
          <span className="admin-kicker">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            {tenantKicker}
          </span>
          <h1>Good day, {safeAdminName}</h1>
          <p>Manage students, publish papers, and monitor examination performance with real-time insights.</p>
        </div>
        <div className="admin-header-actions">
          <small className="admin-date-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
          </small>
        </div>
      </header>
      
      <div className="admin-command-bar">
        <button onClick={()=>go("users")}>
          <span className="cmd-num">01</span>
          <div>
            <strong>Manage students</strong>
            <small>Edit or control candidate access</small>
          </div>
          <b className="cmd-arrow">→</b>
        </button>
        <button onClick={()=>go("tests")}>
          <span className="cmd-num">02</span>
          <div>
            <strong>Manage papers</strong>
            <small>Create, edit and assign exams</small>
          </div>
          <b className="cmd-arrow">→</b>
        </button>
        <button onClick={()=>go("categories")}>
          <span className="cmd-num">03</span>
          <div>
            <strong>Exam categories</strong>
            <small>Organize subjects & subcategories</small>
          </div>
          <b className="cmd-arrow">→</b>
        </button>
        <button onClick={()=>go("results")}>
          <span className="cmd-num">04</span>
          <div>
            <strong>Open analytics</strong>
            <small>Review scores and performance</small>
          </div>
          <b className="cmd-arrow">→</b>
        </button>
        <button onClick={()=>go("test-series")}>
          <span className="cmd-num">05</span>
          <div>
            <strong>Test Series</strong>
            <small>UPSC, Groups &amp; Daily test series</small>
          </div>
          <b className="cmd-arrow">→</b>
        </button>
      </div>

      <div className="admin-dashboard-cards">
        {cards.map(([label,value,help,target,icon,theme])=> (
          <button key={label} className={`admin-card ${theme}`} onClick={()=>go(target)}>
            <div className="admin-card-top">
              <span className="admin-card-icon-wrap"><AppIcon name={icon}/></span>
              <span className="admin-card-link">Open →</span>
            </div>
            <small className="admin-card-label">{label}</small>
            <strong className="admin-card-val">{value}</strong>
            <p className="admin-card-help">{help}</p>
          </button>
        ))}
      </div>

      <div className="admin-home-lower">
        <article className="activity-article">
          <header>
            <div>
              <h2>Recent student activity</h2>
              <p>Latest completed examination attempts.</p>
            </div>
            <button onClick={()=>go("results")}>View all analytics →</button>
          </header>
          {recentAttempts.length===0?(
            <div className="admin-no-activity">No completed attempts yet.</div>
          ):(
            <div className="recent-attempts">
              {recentAttempts.map(attempt=>(
                <button key={attempt.id} onClick={()=>go("results")}>
                  <span className="user-avatar-badge">{(attempt.userId || "U").charAt(0).toUpperCase()}</span>
                  <div className="attempt-info">
                    <strong>{attempt.userId || "Student"}</strong>
                    <small>{attempt.testName || "Exam"}</small>
                  </div>
                  <b className="attempt-score">{Number(attempt.percentage || 0).toFixed(1)}%</b>
                  <em className={`status-pill ${attempt.passed?"pass":"fail"}`}>
                    {attempt.passed ? "Passed" : "Review"}
                  </em>
                  <time className="attempt-time">
                    {attempt.submittedAt?new Date(attempt.submittedAt).toLocaleDateString("en-IN"):"—"}
                  </time>
                </button>
              ))}
            </div>
          )}
        </article>

        <aside className="readiness-aside">
          <h2>Exam readiness</h2>
          <div>
            <span>Student access</span>
            <strong>{totalUsers ? Math.round(activeUsers / totalUsers * 100) : 0}%</strong>
            <i><b style={{width:`${totalUsers ? (activeUsers / totalUsers * 100) : 0}%`}}/></i>
          </div>
          <div>
            <span>Published papers</span>
            <strong>{totalTests ? Math.round(activeTests / totalTests * 100) : 0}%</strong>
            <i><b style={{width:`${totalTests ? (activeTests / totalTests * 100) : 0}%`}}/></i>
          </div>
          <div>
            <span>Attempt completion</span>
            <strong>{totalAttempts ? Math.round(completedAttempts / totalAttempts * 100) : 0}%</strong>
            <i><b style={{width:`${totalAttempts ? (completedAttempts / totalAttempts * 100) : 0}%`}}/></i>
          </div>
        </aside>
      </div>
    </section>
  );
};
export default AdminDashboard;
