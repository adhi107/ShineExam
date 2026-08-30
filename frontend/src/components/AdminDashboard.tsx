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
import { apiGet, apiPost } from "../services/api";
import "./AdminDashboard.css";
import "./AdminPolish.css";

type AdminView =
  | "dashboard"
  | "users"
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
  | "results";

const paths: Record<AdminView, string> = {
  dashboard: "/admin",
  users: "/admin/users",
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
};

const views: Record<string, AdminView> = {
  "/admin": "dashboard",
  "/admin/users": "users",
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
  const closeMobileSidebar = () => setMobileOpen(false);
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
    return <AdminHome adminName={adminName} stats={stats} go={go} />;
  };

  const isDesktopCollapsed = sidebarCollapsed && !mobileOpen;

  return (
    <div className="shine-admin-shell">
      {/* Mobile-only topbar with hamburger */}
      <div className="admin-mobile-topbar">
        <button
          className={`admin-hamburger-btn ${mobileOpen ? "open" : ""}`}
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>
        <span className="admin-mobile-title">Admin Console</span>
        <div className="admin-mobile-topbar-right">
          <button
            type="button"
            className="admin-mobile-pw-btn"
            onClick={() => setShowPassword(true)}
            title="Change password"
          >
            Password
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
          {!isDesktopCollapsed && <span>ADMIN CONSOLE</span>}
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
        <nav>
          <Nav active={currentView === "dashboard"} icon="dashboard" label="Dashboard" collapsed={isDesktopCollapsed} onClick={() => goMobile("dashboard")} />
          <Nav active={currentView === "users"} icon="users" label="Students" collapsed={isDesktopCollapsed} onClick={() => goMobile("users")} />
          <Nav active={currentView === "categories"} icon="categories" label="Exam Categories" collapsed={isDesktopCollapsed} onClick={() => goMobile("categories")} />
          <Nav active={["tests", "create-test", "edit-test"].includes(currentView)} icon="tests" label="Tests" collapsed={isDesktopCollapsed} onClick={() => goMobile("tests")} />
          <Nav active={currentView === "videos"} icon="videos" label="Videos" collapsed={isDesktopCollapsed} onClick={() => goMobile("videos")} />
          <Nav active={currentView === "documents"} icon="documents" label="Documents" collapsed={isDesktopCollapsed} onClick={() => goMobile("documents")} />
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
              <p><strong>{adminName || "Admin"}</strong><small>Administrator</small></p>
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
            SHINE EXAM OPERATIONS
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
