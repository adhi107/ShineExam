import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import TestInterface from "./TestInterface";
import ShineLogo from "./ShineLogo";
import StudentClasses from "./StudentClasses";
import { CandidateAnnouncements, CandidateBookmarks, CandidateDocuments, CandidateBookmark } from "./CandidateResources";
import ValueHelpField from "./ValueHelpField";
import { ParsedQuestionPreview } from "./ParsedQuestionPreview";
import "./AnswererDashboard.css";
import "./CandidateValidity.css";

type PortalView = "tests" | "report" | "classes" | "bookmarks" | "documents" | "announcements";
type TestTab = "active" | "upcoming" | "missed" | "completed";
type ReportTab = "score" | "subject" | "solution" | "questions" | "compare";

interface Props { userName: string; onLogout: () => void }
interface AssignedTest {
  id: string; name: string; duration: number; questions: number;
  status: "active" | "draft" | "completed" | "upcoming" | "expired"; totalMarks?: number;
  passingPercentage?: number; attempted?: boolean;
  availableFrom?: string; validUntil?: string;
  categoryId?: string; categoryName?: string; subcategoryId?: string; subcategoryName?: string; stage?: string;
  attemptStatus?: "not_started" | "in_progress" | "submitted";
  attemptId?: string;
  answeredCount?: number;
  totalQuestions?: number;
  timeSpentSec?: number;
  currentQuestionIndex?: number;
  currentSection?: string;
  lastSavedAt?: string;
}

interface ExamForTaking {
  id: string; testName: string; duration: number;
  passingPercentage?: number; questions: any[];
  timerMode?: "overall" | "sectional";
  sectionConfig?: Array<{ name: string; duration: number; questionCount: number; marks: number }>;
}
interface TestHistoryItem {
  attemptId: string; examId: string; testName: string; submittedAt: string;
  scoredMarks: number; totalMarks: number; percentage: number; passed: boolean; timeSpentSec: number;
}
interface ResultDetail {
  sectionWise?: Record<string, { total: number; scored: number }>;
  questionReview?: Array<{ questionId: string; question?: string; type?: string; options?: string[]; isCorrect: boolean; userAnswer: string | string[]; correctAnswer?: string | string[]; marks: number; section: string; timeSpentSec?:number;avgTimeSec?:number;topperTimeSec?:number;topperUserId?:string }>;
}
interface AccountInfo { userId: string; name?: string; email?: string; collegeEmail?: string; isActive?: boolean; lastLoginAt?: string; validUntil?: string }
interface PortalNotification { id: string; type: "test" | "result" | "document" | "announcement"; title: string; message: string; target: PortalView; createdAt: string; read: boolean }
interface ExamPage {
  groupSlug: string; examSlug: string; stageSlug: string;
  groupLabel: string; examLabel: string; stageLabel: string;
  categoryId: string; subcategoryId: string; stage: string;
}
interface CategoryData { id:string;name:string;slug:string;subcategories:Array<{id:string;name:string;slug:string;stages:string[]}> }

const navItems: Array<{ view: PortalView; label: string; icon: React.ReactNode }> = [
  {
    view: "tests",
    label: "My Tests",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    view: "classes",
    label: "Classes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    view: "report",
    label: "Reports",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    view: "bookmarks",
    label: "Bookmarks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    view: "documents",
    label: "Documents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    view: "announcements",
    label: "Announcements",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

const AnswererDashboard: React.FC<Props> = ({ userName, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tests, setTests] = useState<AssignedTest[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [activeExam, setActiveExam] = useState<ExamForTaking | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState("");
  const [testTab, setTestTab] = useState<TestTab>("active");
  const [reportTab, setReportTab] = useState<ReportTab>("score");
  const [gridView, setGridView] = useState(() => localStorage.getItem("shine_default_view") !== "list");
  const [search, setSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<TestHistoryItem | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportDetail, setReportDetail] = useState<ResultDetail | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["banking"]);
  const [expandedExams, setExpandedExams] = useState<string[]>([]);
  const [testsTreeOpen, setTestsTreeOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [bookmarks, setBookmarks] = useState<CandidateBookmark[]>([]);
  const [accountPanel, setAccountPanel] = useState<"profile" | "settings" | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(() => localStorage.getItem("shine_email_notifications") !== "off");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const view: PortalView = location.pathname.includes("classes") || location.pathname.includes("videos")
    ? "classes" : location.pathname.includes("history") || location.pathname.includes("report")
    ? "report" : location.pathname.includes("bookmark") ? "bookmarks"
    : location.pathname.includes("document") || location.pathname.includes("courses") ? "documents"
    : location.pathname.includes("announcement") ? "announcements" : "tests";
  const examGroups=useMemo(()=>categoryData.map(category=>({id:category.id,slug:category.slug,label:category.name,exams:category.subcategories.map(sub=>({id:sub.id,slug:sub.slug,label:sub.name,stages:sub.stages}))})),[categoryData]);
  const examPages=useMemo<ExamPage[]>(()=>examGroups.flatMap(group=>group.exams.flatMap(exam=>exam.stages.map(stage=>({groupSlug:group.slug,examSlug:exam.slug,stageSlug:stage.toLowerCase().replace(/[^a-z0-9]+/g,"-"),groupLabel:group.label,examLabel:exam.label,stageLabel:stage,categoryId:group.id,subcategoryId:exam.id,stage})))),[examGroups]);
  const selectedExamPage = examPages.find(page => location.pathname === `/dashboard/exams/${page.groupSlug}/${page.examSlug}/${page.stageSlug}`);

  const loadPortal = async () => {
    setLoading(true);
    try {
      const [testRes, historyRes] = await Promise.all([
        apiGet<{ tests: AssignedTest[] }>(`/answerer/tests?userId=${encodeURIComponent(userName)}`),
        apiGet<{ history: TestHistoryItem[] }>(`/answerer/history?userId=${encodeURIComponent(userName)}`),
      ]);
      setTests(testRes.tests || []);
      setHistory(historyRes.history || []);
      apiGet<{categories:CategoryData[]}>("/answerer/exam-categories").then(res=>setCategoryData(res.categories||[])).catch(()=>setCategoryData([]));
      apiGet<{ notifications: PortalNotification[] }>(`/answerer/notifications?userId=${encodeURIComponent(userName)}`)
        .then(res => setNotifications(res.notifications || [])).catch(() => setNotifications([]));
      apiGet<{ bookmarks: CandidateBookmark[] }>(`/answerer/bookmarks?userId=${encodeURIComponent(userName)}`)
        .then(res => setBookmarks(res.bookmarks || [])).catch(() => setBookmarks([]));
      if (!selectedReport && historyRes.history?.length) setSelectedReport(historyRes.history[0]);
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  };

  const loadBookmarks = () => apiGet<{ bookmarks: CandidateBookmark[] }>(`/answerer/bookmarks?userId=${encodeURIComponent(userName)}`)
    .then(res => setBookmarks(res.bookmarks || [])).catch(() => setBookmarks([]));
  const toggleTestBookmark = async (test: AssignedTest) => {
    await apiPost("/answerer/bookmarks/toggle", { userId: userName, type: "test", testId: test.id, title: test.name });
    await loadBookmarks();
  };
  const openBookmarkedTest = (testId: string) => {
    const test = tests.find(item => item.id === testId);
    if (test && categoryFor(test) === "active") void startExam(testId);
    else { setTestTab(test ? categoryFor(test) : "active"); goTo("tests"); }
  };

  useEffect(() => { loadPortal(); /* eslint-disable-next-line */ }, [userName]);
  useEffect(() => {
    if (!selectedReport?.attemptId) { setReportDetail(null); return; }
    apiGet<{ result: ResultDetail }>(`/answerer/results/${selectedReport.attemptId}`)
      .then(res => setReportDetail(res.result)).catch(() => setReportDetail(null));
  }, [selectedReport]);

  const goTo = (next: PortalView) => {
    const path = next === "tests" ? "/dashboard" : `/dashboard/${next}`;
    navigate(path);
    setProfileOpen(false);
  };
  const unreadNotifications = notifications.filter(item => !item.read).length;
  const markNotificationRead = async (notificationId: string) => {
    setNotifications(items => items.map(item => notificationId === "all" || item.id === notificationId ? { ...item, read: true } : item));
    try { await apiPost("/answerer/notifications/read", { userId: userName, notificationId }); } catch (error) { console.error(error); }
  };
  const clearNotifications = async (notificationId: string = "all") => {
    setNotifications(items => notificationId === "all" ? [] : items.filter(item => item.id !== notificationId));
    try { await apiPost("/answerer/notifications/clear", { userId: userName, notificationId }); } catch (error) { console.error(error); }
  };

  const openExamPage = (page: ExamPage) => {
    setTestTab("active");
    setSearch("");
    navigate(`/dashboard/exams/${page.groupSlug}/${page.examSlug}/${page.stageSlug}`);
  };
  const toggleExpanded = (value: string, values: string[], setValues: React.Dispatch<React.SetStateAction<string[]>>) =>
    setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);

  const openAccountPanel = (panel: "profile" | "settings") => {
    setAccountPanel(panel);
    setProfileOpen(false);
    setNotificationsOpen(false);
    apiGet<{ account: AccountInfo }>(`/answerer/account-security?userId=${encodeURIComponent(userName)}`)
      .then(res => setAccountInfo(res.account)).catch(() => setAccountInfo({ userId: userName, name: userName }));
  };
  const savePreferences = () => {
    localStorage.setItem("shine_default_view", gridView ? "grid" : "list");
    localStorage.setItem("shine_email_notifications", emailNotifications ? "on" : "off");
    setPasswordMessage("Preferences saved successfully.");
  };
  const changePassword = async () => {
    if (!currentPassword || newPassword.length < 4) { setPasswordMessage("Enter your current password and a new password of at least 4 characters."); return; }
    setSavingPassword(true); setPasswordMessage("");
    try {
      await apiPost("/auth/change-password", { userId: userName, oldPassword: currentPassword, newPassword, role: "answerer" });
      setCurrentPassword(""); setNewPassword(""); setPasswordMessage("Password changed successfully.");
    } catch (error: any) { setPasswordMessage(error?.message || "Password could not be changed."); }
    finally { setSavingPassword(false); }
  };

  const startExam = async (examId: string) => {
    setStartingId(examId);
    try {
      const res = await apiGet<{ test: ExamForTaking }>(`/answerer/tests/${examId}?userId=${encodeURIComponent(userName)}`);
      setActiveExam(res.test);
      navigate("/dashboard/tests");
    } catch (error) {
      console.error(error);
      alert("The test could not be started. Please check that it is active and try again.");
    } finally { setStartingId(""); }
  };

  const exitExam = () => {
    setActiveExam(null);
    navigate("/dashboard");
    loadPortal();
  };

  const categoryFor = (test: AssignedTest): TestTab => {
    if (test.attempted || test.status === "completed") return "completed";
    if (test.status === "expired") return "missed";
    if (test.status === "upcoming" || test.status === "draft") return "upcoming";
    return "active";
  };

  const visibleTests = useMemo(() => tests.filter(test => {
    const category = categoryFor(test);
    const matchesTab = category === testTab;
    const testName = test.name.toLowerCase();
    const matchesExam = !selectedExamPage || (test.categoryId===selectedExamPage.categoryId && test.subcategoryId===selectedExamPage.subcategoryId && test.stage===selectedExamPage.stage);
    return matchesTab && matchesExam && testName.includes(search.toLowerCase());
  }), [tests, testTab, search, selectedExamPage]);

  const scopedTests = (tab: TestTab) => tests.filter(test => {
    const matchesExam = !selectedExamPage || (test.categoryId===selectedExamPage.categoryId && test.subcategoryId===selectedExamPage.subcategoryId && test.stage===selectedExamPage.stage);
    return matchesExam && categoryFor(test) === tab;
  });
  const filteredHistory = history.filter(item => normalizeSearchText(`${item.testName} ${item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-IN") : ""} ${item.percentage}% ${item.passed ? "passed" : "needs improvement"}`).includes(normalizeSearchText(reportSearch)));

  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const validityDate = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "No expiry";
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const [studentSidebarCollapsed, setStudentSidebarCollapsed] = useState(() => localStorage.getItem("shine_student_sidebar_collapsed") === "true");
  const [studentMobileOpen, setStudentMobileOpen] = useState(false);
  const closeStudentMobile = () => setStudentMobileOpen(false);

  const toggleStudentSidebar = () => {
    setStudentSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("shine_student_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleGoTo = (next: PortalView) => {
    goTo(next);
    closeStudentMobile();
  };

  const handleOpenExamPage = (page: ExamPage) => {
    openExamPage(page);
    closeStudentMobile();
  };

  if (activeExam) return (
    <TestInterface userId={userName} examId={activeExam.id} testName={activeExam.testName}
      duration={activeExam.duration} passingPercentage={activeExam.passingPercentage}
      timerMode={activeExam.timerMode} sectionConfig={activeExam.sectionConfig}
      questions={activeExam.questions} onExit={exitExam} />
  );

  const currentReport = selectedReport || history[0];
  const score = currentReport?.scoredMarks || 0;
  const total = currentReport?.totalMarks || 0;
  const pct = currentReport?.percentage || 0;
  const review = reportDetail?.questionReview || [];
  const answered = (value: string | string[]) => Array.isArray(value) ? value.length > 0 : Boolean(value);
  const questionCount = review.length || total;
  const correct = review.length ? review.filter(item => item.isCorrect).length : (total ? Math.max(0, Math.round(score)) : 0);
  const incorrect = review.length ? review.filter(item => !item.isCorrect && answered(item.userAnswer)).length : (total ? Math.max(0, Math.min(total - correct, Math.round(total * .35))) : 0);
  const unanswered = Math.max(0, questionCount - correct - incorrect);

  return (
    <div className="candidate-shell">
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`candidate-mobile-overlay ${studentMobileOpen ? "visible" : ""}`}
        onClick={closeStudentMobile}
      />

      <aside className={`candidate-sidebar ${studentSidebarCollapsed ? "collapsed" : ""} ${studentMobileOpen ? "sidebar-open" : ""}`}>
        <div className="candidate-logo">
          <button 
            type="button" 
            className="sidebar-hamburger-btn" 
            onClick={toggleStudentSidebar} 
            title={studentSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <ShineLogo compact={studentSidebarCollapsed} />
        </div>

        <nav className="candidate-nav">
          <div className={`my-tests-nav ${view === "tests" ? "active" : ""}`} title={studentSidebarCollapsed ? "My Tests" : ""}>
            <button className="my-tests-main" onClick={() => handleGoTo("tests")}>
              <span className="candidate-nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="m9 15 2 2 4-4" />
                </svg>
              </span>
              {!studentSidebarCollapsed && <span>My Tests</span>}
            </button>
            {!studentSidebarCollapsed && <button className={`my-tests-collapse ${testsTreeOpen ? "open" : ""}`} onClick={() => setTestsTreeOpen(open => !open)} aria-label={testsTreeOpen ? "Collapse My Tests" : "Expand My Tests"}>⌄</button>}
          </div>
          {testsTreeOpen && !studentSidebarCollapsed && <div className="exam-categories under-tests">
            {examGroups.map(group => <div className="exam-group" key={group.slug}>
              <button className={`exam-group-button ${expandedGroups.includes(group.slug) ? "open" : ""}`} onClick={() => toggleExpanded(group.slug, expandedGroups, setExpandedGroups)}>
                <span className="dot-icon" />
                <span className="group-label">{group.label}</span>
                <svg className={`group-chevron ${expandedGroups.includes(group.slug) ? "open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {expandedGroups.includes(group.slug) && <div className="exam-group-children">{group.exams.map(exam => <div className="exam-subgroup" key={exam.slug}>
                <button className={`exam-name-button ${expandedExams.includes(exam.slug) ? "open" : ""} ${selectedExamPage?.examSlug === exam.slug ? "selected" : ""}`} onClick={() => toggleExpanded(exam.slug, expandedExams, setExpandedExams)}>
                  <svg className={`subgroup-chevron ${expandedExams.includes(exam.slug) ? "open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  <b className="exam-label">{exam.label}</b>
                </button>
                {expandedExams.includes(exam.slug) && <div className="exam-stage-links">{examPages.filter(page => page.subcategoryId === exam.id).map(page => <button key={page.stageSlug} className={selectedExamPage?.subcategoryId === page.subcategoryId && selectedExamPage.stageSlug === page.stageSlug ? "active" : ""} onClick={() => handleOpenExamPage(page)}><i className="stage-dot" />{page.stageLabel}</button>)}</div>}
              </div>)}</div>}
            </div>)}
          </div>}
          {navItems.filter(item => item.view !== "tests").map(item => <button key={item.view} className={`candidate-nav-item ${view === item.view ? "active" : ""}`} onClick={() => handleGoTo(item.view)} title={studentSidebarCollapsed ? item.label : ""}><span className="candidate-nav-icon">{item.icon}</span>{!studentSidebarCollapsed && <span>{item.label}</span>}</button>)}
        </nav>

        {!studentSidebarCollapsed && (
          <div className="candidate-sidebar-footer">
            <div className="support-card"><span>?</span><div><strong>Need help?</strong><small>Visit our support center</small></div></div>
            <small>SHINE EXAM PREP • v2.0</small>
          </div>
        )}
      </aside>

      <main className={`candidate-main ${studentSidebarCollapsed ? "collapsed" : ""}`}>
        <header className="candidate-topbar">
          <div className="topbar-left-brand">
            <button
              type="button"
              className={`candidate-hamburger-btn ${studentMobileOpen ? "open" : ""}`}
              onClick={() => setStudentMobileOpen(o => !o)}
              aria-label="Toggle student navigation menu"
            >
              <span /><span /><span />
            </button>
            <div className="topbar-title-wrap">
              <span className="mobile-brand">SHINE EXAM</span>
              <h1>{view === "tests" ? (selectedExamPage ? `${selectedExamPage.examLabel} ${selectedExamPage.stageLabel}` : "My Tests") : view === "report" ? "Performance Report" : navItems.find(n => n.view === view)?.label}</h1>
            </div>
          </div>
          <div className="candidate-top-actions">
            {view === "tests" && <div className="portal-value-help"><ValueHelpField label="Search Tests" placeholder="Search assigned tests" value={search} options={tests.map(test=>({value:test.name,label:test.name,keywords:[`${test.duration} minutes`,`${test.questions} questions`]}))} onChange={setSearch} allowFreeText compact/></div>}
            <div className="notification-wrap">
              <button className="icon-button" aria-label="Notifications" onClick={() => { setNotificationsOpen(v => !v); setProfileOpen(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadNotifications > 0 && <i />}
              </button>
              {notificationsOpen && <div className="notification-menu">
                <div className="notification-menu-head">
                  <strong>Notifications ({unreadNotifications})</strong>
                  <div className="notification-head-actions">
                    <button onClick={() => markNotificationRead("all")}>Mark all read</button>
                    <span className="dot-sep">•</span>
                    <button className="clear-all-btn" onClick={() => void clearNotifications("all")}>Clear all</button>
                  </div>
                </div>
                {notifications.length === 0 ? <div className="notification-empty">You are all caught up.</div> : notifications.map(item => (
                  <div className={`notification-item-row ${item.read ? "read" : "unread"}`} key={item.id}>
                    <button className="notification-item-main" onClick={() => { void markNotificationRead(item.id); setNotificationsOpen(false); goTo(item.target); }}>
                      <span>{item.type === "test" ? "NEW" : item.type === "document" ? "DOC" : item.type === "announcement" ? "NEWS" : "✓"}</span>
                      <div><strong>{item.title}</strong><small>{item.message}</small></div>
                    </button>
                    <button className="notification-dismiss-btn" onClick={(e) => { e.stopPropagation(); void clearNotifications(item.id); }} title="Clear notification" aria-label="Clear notification">✕</button>
                  </div>
                ))}
              </div>}
            </div>
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => { setProfileOpen(v => !v); setNotificationsOpen(false); }}>
                <span>{userName.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{userName}</strong>
                  <small>Candidate</small>
                </div>
                <svg className={`profile-chevron ${profileOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {profileOpen && <div className="profile-menu"><div className="profile-menu-user"><span>{userName.charAt(0).toUpperCase()}</span><div><strong>{userName}</strong><small>Candidate account</small></div></div><button onClick={() => openAccountPanel("profile")}>My profile</button><button onClick={() => openAccountPanel("settings")}>Settings & password</button><button className="signout" onClick={onLogout}>Sign out</button></div>}
            </div>
          </div>
        </header>

        {view === "tests" && <section className="portal-page tests-page">
          <div className="test-tabs">
            {(["active", "upcoming", "missed", "completed"] as TestTab[]).map(tab => <button key={tab} className={testTab === tab ? "active" : ""} onClick={() => setTestTab(tab)}><span>{tab === "active" ? "◉" : tab === "upcoming" ? "◷" : tab === "missed" ? "⊘" : "✓"}</span>{tab[0].toUpperCase()+tab.slice(1)}<i>{selectedExamPage ? scopedTests(tab).length : tab === "completed" ? history.length : tests.filter(t => categoryFor(t) === tab).length}</i></button>)}
          </div>
          <div className="page-toolbar">
            <div>
              <div className="exam-breadcrumb">
                <button onClick={() => goTo("tests")}>My Tests</button>
                {selectedExamPage && <><span>›</span><span>{selectedExamPage.groupLabel}</span><span>›</span><span>{selectedExamPage.examLabel}</span><span>›</span><b>{selectedExamPage.stageLabel}</b></>}
              </div>
              <h2>{selectedExamPage ? `${selectedExamPage.examLabel} ${selectedExamPage.stageLabel}` : `${testTab[0].toUpperCase()+testTab.slice(1)} Tests`}</h2>
              <p>{testTab === "completed" ? "Review your completed assessments and reports" : "Assessments available for your account"}</p>
            </div>
            <div className="view-toggle">
              <button className={gridView ? "active" : ""} onClick={() => setGridView(true)} title="Grid View">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button className={!gridView ? "active" : ""} onClick={() => setGridView(false)} title="List View">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
          </div>
          {loading ? <div className="portal-empty"><span className="loader" />Loading your assessments…</div> : visibleTests.length === 0 ? <div className="portal-empty"><span>◇</span><h3>No {testTab} tests</h3><p>There are no assessments in this section right now.</p></div> :
          <div className={`portal-test-list ${gridView ? "grid" : "list"}`}>{visibleTests.map((test, index) => (
            <article className={`portal-test-card ${test.attemptStatus === "in_progress" ? "is-in-progress" : ""}`} key={test.id}>
              <div className={`test-accent accent-${index % 4}`} />
              <button className={`test-bookmark-button ${bookmarks.some(item=>item.type==="test"&&item.testId===test.id)?"saved":""}`} onClick={()=>void toggleTestBookmark(test)} aria-label="Bookmark test" title="Bookmark test">{bookmarks.some(item=>item.type==="test"&&item.testId===test.id)?"★":"☆"}</button>
              <div className="test-card-heading">
                <div className="test-heading-top">
                  <span>{index % 2 ? "QUANTITATIVE" : "GENERAL"}</span>
                  {test.attemptStatus === "in_progress" && (
                    <span className="in-progress-badge">⚡ IN PROGRESS</span>
                  )}
                </div>
                <h3>{test.name}</h3>
              </div>
              <div className="test-validity-box"><div><small>Start</small><strong>{validityDate(test.availableFrom)}</strong></div><div><small>End</small><strong>{validityDate(test.validUntil)}</strong></div><div><small>Questions</small><strong>{test.questions}</strong></div><div><small>Duration</small><strong>{test.duration} minutes</strong></div></div>
              {test.attemptStatus === "in_progress" && (
                <div className="test-resume-progress">
                  <div className="test-resume-info">
                    <span>Stopped at Q{(test.currentQuestionIndex || 0) + 1}</span>
                    <strong>{test.answeredCount || 0} / {test.totalQuestions || test.questions} Answered</strong>
                  </div>
                  <div className="test-resume-bar">
                    <div className="test-resume-fill" style={{ width: `${Math.min(100, Math.round(((test.answeredCount || 0) / (test.totalQuestions || test.questions || 1)) * 100))}%` }} />
                  </div>
                </div>
              )}
              {testTab === "completed" ? (
                <button className="shine-primary" onClick={() => { const r=history.find(h => h.examId === test.id) || history[0]; setSelectedReport(r || null); setReportTab("score"); goTo("report"); }}>View report <span>→</span></button>
              ) : testTab === "upcoming" ? (
                <button className="shine-primary" disabled>Opens {validityDate(test.availableFrom)}</button>
              ) : testTab === "missed" ? (
                <button className="shine-primary" disabled>Expired</button>
              ) : test.attemptStatus === "in_progress" ? (
                <button className="shine-primary resume-btn" disabled={!!startingId} onClick={() => startExam(test.id)}>
                  {startingId === test.id ? "Resuming…" : `Resume test (Q${(test.currentQuestionIndex || 0) + 1})`} <span>→</span>
                </button>
              ) : (
                <button className="shine-primary" disabled={!!startingId} onClick={() => startExam(test.id)}>
                  {startingId === test.id ? "Starting…" : "Start test"} <span>→</span>
                </button>
              )}
            </article>
          ))}</div>}

        </section>}

        {view === "report" && <section className="portal-page report-page">
          <div className="report-selector-card">
            <div className="report-selector-left">
              <span className="report-badge">REPORT FOR</span>
              <div className="report-search-wrap">
                <ValueHelpField label="Search Reports" placeholder="Search test, date or result" value={reportSearch} options={history.map(item=>({value:item.testName,label:item.testName,keywords:[formatDate(item.submittedAt),item.passed?"Passed":"Needs improvement"]}))} onChange={(val) => { setReportSearch(val); const match = history.find(h => h.testName === val || h.testName.toLowerCase().includes(val.toLowerCase())); if (match) setSelectedReport(match); }} allowFreeText compact/>
              </div>
              <select className="report-select-box" value={currentReport?.attemptId || ""} onChange={e => setSelectedReport(history.find(h => h.attemptId === e.target.value) || null)}>
                {filteredHistory.length ? filteredHistory.map(h => <option key={h.attemptId} value={h.attemptId}>{h.testName} — {formatDate(h.submittedAt)}</option>) : <option value="">No matching reports</option>}
              </select>
            </div>
            {currentReport && <span className={`result-pill ${currentReport.passed ? "pass" : "fail"}`}>{currentReport.passed ? "Passed" : "Needs improvement"}</span>}
          </div>
          <div className="report-tabs">{([['score','Score Card'],['subject','Subject Report'],['solution','Solution Report'],['questions','Question Report'],['compare','Compare Yourself']] as [ReportTab,string][]).map(([id,label]) => <button className={reportTab === id ? "active" : ""} onClick={() => setReportTab(id)} key={id}>{label}</button>)}</div>
          {!currentReport ? <div className="portal-empty"><span>▤</span><h3>No report available</h3><p>Complete a test and your detailed analytics will appear here.</p></div> : <>
            <div className="report-kpis"><div><span>Total Questions</span><strong>{questionCount}</strong></div><div><span>Total Marks</span><strong>{fmt(total)}</strong></div><div><span>Time Spent</span><strong>{formatTime(currentReport.timeSpentSec)}</strong></div><div><span>Percentile</span><strong>{Math.min(99, Math.round(60 + pct * .35))}<small>th</small></strong></div></div>
            {reportTab === "score" && <ScoreReport score={score} total={total} pct={pct} correct={correct} incorrect={incorrect} unanswered={unanswered} />}
            {reportTab === "subject" && <SubjectReport score={score} total={total} pct={pct} questionCount={questionCount} time={formatTime(currentReport.timeSpentSec)} review={review} />}
            {reportTab === "solution" && <SolutionReport testName={currentReport.testName} userName={userName} review={review} onClose={() => setReportTab("score")} />}
            {reportTab === "questions" && <QuestionReport total={questionCount} correct={correct} review={review} />}
            {reportTab === "compare" && <CompareReport score={score} total={total} pct={pct} />}
          </>}
        </section>}

        {view === "classes" && <StudentClasses userId={userName} />}
        {view === "bookmarks" && <CandidateBookmarks userId={userName} bookmarks={bookmarks} onChanged={loadBookmarks} onOpenTest={openBookmarkedTest} />}
        {view === "documents" && <CandidateDocuments userId={userName} />}
        {view === "announcements" && <CandidateAnnouncements userId={userName} />}
      </main>
      {accountPanel && <div className="account-modal-backdrop" onMouseDown={() => setAccountPanel(null)}><section className="account-modal" onMouseDown={event => event.stopPropagation()}>
        <header><div><span>{accountPanel === "profile" ? "CANDIDATE ACCOUNT" : "ACCOUNT SETTINGS"}</span><h2>{accountPanel === "profile" ? "My Profile" : "Settings & Password"}</h2></div><button onClick={() => setAccountPanel(null)}>×</button></header>
        {accountPanel === "profile" ? <div className="profile-details"><div className="large-avatar">{userName.charAt(0).toUpperCase()}</div><h3>{accountInfo?.name || userName}</h3><p>Shine Candidate</p><dl><div><dt>User ID</dt><dd>{accountInfo?.userId || userName}</dd></div><div><dt>Email</dt><dd>{accountInfo?.email || "Not provided"}</dd></div><div><dt>College email</dt><dd>{accountInfo?.collegeEmail || "Not provided"}</dd></div><div><dt>Account status</dt><dd className="active-account">● {accountInfo?.isActive === false ? "Inactive" : "Active"}</dd></div></dl></div> : <div className="settings-content">
          <div className="settings-section"><h3>Preferences</h3><label className="setting-row"><div><strong>Email notifications</strong><small>Receive assessment and report updates.</small></div><input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)} /></label><label className="setting-row"><div><strong>Default grid view</strong><small>Show tests as cards instead of a list.</small></div><input type="checkbox" checked={gridView} onChange={e => setGridView(e.target.checked)} /></label><button className="settings-save" onClick={savePreferences}>Save preferences</button></div>
          <div className="settings-section"><h3>Change password</h3><label>Current password<input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label><label>New password<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button className="settings-save" disabled={savingPassword} onClick={changePassword}>{savingPassword ? "Updating…" : "Update password"}</button>{passwordMessage && <p className="settings-message">{passwordMessage}</p>}</div>
        </div>}
      </section></div>}
    </div>
  );
};

const fmt = (val: any) => {
  const n = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
  if (isNaN(n)) return '0';
  return Number.isInteger(n) ? n.toString() : Number(n.toFixed(1)).toString();
};

const Metric=({label,value,max,color}:any)=><div className="metric-row"><div><span>{label}</span><b>{fmt(value)}/{fmt(max)}</b></div><div className="metric-track"><i style={{width:`${max ? (parseFloat(value)/parseFloat(max))*100 : 0}%`,background:color}} /></div></div>;
const ScoreReport = ({score,total,pct,correct,incorrect,unanswered}:any) => <div className="report-grid"><article className="report-card score-summary"><h3>Performance Summary</h3><div className="score-ring" style={{'--score': `${pct * 3.6}deg`} as React.CSSProperties}><div><strong>{fmt(score)}</strong><span>out of {fmt(total)}</span></div></div><h2>{pct >= 70 ? "Excellent work!" : pct >= 40 ? "Good progress" : "Keep practicing"}</h2><p>You scored <b>{pct.toFixed(1)}%</b> in this assessment.</p><div className="score-legend"><span className="correct"><i />Correct <b>{correct}</b></span><span className="wrong"><i />Incorrect <b>{incorrect}</b></span><span><i />Unattempted <b>{unanswered}</b></span></div></article><article className="report-card"><h3>Score Breakdown</h3><div className="horizontal-metrics"><Metric label="Correct answers" value={correct} max={fmt(total)} color="#27b487"/><Metric label="Incorrect answers" value={incorrect} max={fmt(total)} color="#ef6a78"/><Metric label="Unattempted" value={unanswered} max={fmt(total)} color="#a7b0c0"/></div><div className="rank-strip"><div><small>Your rank</small><strong>#{Math.max(1,Math.round(400-pct*3))}</strong></div><div><small>Accuracy</small><strong>{pct.toFixed(1)}%</strong></div><div><small>Average score</small><strong>{fmt(total*.52)}</strong></div></div></article></div>;
const SubjectReport = ({ score, total, pct, time, questionCount, review }: any) => {
  const sectionStats = useMemo(() => {
    if (!review || !Array.isArray(review) || review.length === 0) {
      return [{
        name: 'General Aptitude',
        totalQuestions: questionCount || 0,
        scoredMarks: score || 0,
        maxMarks: total || 0,
        accuracy: pct || 0,
        timeSpent: time || '—'
      }];
    }

    const groups: Record<string, { totalQuestions: number; correct: number; attempted: number; scoredMarks: number; maxMarks: number }> = {};

    review.forEach((item: any) => {
      const secName = item.section || 'General';
      if (!groups[secName]) {
        groups[secName] = { totalQuestions: 0, correct: 0, attempted: 0, scoredMarks: 0, maxMarks: 0 };
      }
      groups[secName].totalQuestions += 1;
      const qMarks = Number(item.marks || 1);
      groups[secName].maxMarks += qMarks;

      const isAns = Array.isArray(item.userAnswer) ? item.userAnswer.length > 0 : (item.userAnswer !== undefined && item.userAnswer !== null && item.userAnswer !== '');
      if (isAns) {
        groups[secName].attempted += 1;
      }
      if (item.isCorrect) {
        groups[secName].correct += 1;
        groups[secName].scoredMarks += qMarks;
      }
    });

    return Object.entries(groups).map(([secName, data]) => {
      const acc = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;
      return {
        name: secName,
        totalQuestions: data.totalQuestions,
        scoredMarks: data.scoredMarks,
        maxMarks: data.maxMarks,
        accuracy: acc,
        timeSpent: time || '—'
      };
    });
  }, [review, questionCount, score, total, pct, time]);

  return (
    <div className="report-card table-card">
      <h3>Subject Performance & Section Breakdown</h3>
      <div className="report-table subject-table">
        <div className="table-head">
          <span>Subject / Section Name</span>
          <span>Questions</span>
          <span>Score</span>
          <span>Accuracy</span>
          <span>Time spent</span>
        </div>
        {sectionStats.map((sec, idx) => (
          <div className="table-row" key={sec.name || idx}>
            <strong>{sec.name}</strong>
            <span>{sec.totalQuestions}</span>
            <span>{fmt(sec.scoredMarks)} / {fmt(sec.maxMarks)}</span>
            <span>{sec.accuracy.toFixed(1)}%</span>
            <span>{sec.timeSpent}</span>
          </div>
        ))}
      </div>
      <div className="subject-analysis">
        <div>
          <span>Overall Test score</span>
          <strong>{fmt(score)}<small>/{fmt(total)}</small></strong>
          <Metric label="Mastery" value={pct} max={100} color="#2f6fed" />
        </div>
        <div className="mini-pie" style={{ '--score': `${pct * 3.6}deg` } as React.CSSProperties} />
      </div>
    </div>
  );
};

const reviewStatus=(item:any,index:number,correct:number,incorrect:number)=>item ? (item.isCorrect?'correct':(Array.isArray(item.userAnswer)?item.userAnswer.length>0:Boolean(item.userAnswer))?'wrong':'empty') : index<correct?'correct':index<correct+incorrect?'wrong':'empty';
const SolutionReport = ({ testName, userName, review, onClose }: any) => {
  const sections = Array.from(new Set((review || []).map((item: any) => item.section).filter(Boolean))) as string[];
  const [activeSection, setActiveSection] = useState<string>(sections[0] || (review[0]?.section ?? ''));
  const [sectionIndex, setSectionIndex] = useState<number>(0);

  const sectionQuestions = (review || []).filter((item: any) => item.section === activeSection);
  const activeQuestions = sectionQuestions.length > 0 ? sectionQuestions : review;
  const safeIndex = Math.min(sectionIndex, Math.max(0, activeQuestions.length - 1));
  const current = activeQuestions[safeIndex] || review[0];

  const answered = (value: any) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";
  const status = (item: any) => !answered(item?.userAnswer) ? "empty" : item?.isCorrect ? "correct" : "wrong";

  const matches = (value: any, option: string, index: number, optionsList?: string[]) => {
    const rawValues = (Array.isArray(value) ? value : [value]).map(v => String(v ?? "").trim().toLowerCase()).filter(Boolean);
    if (rawValues.length === 0) return false;
    const targetOpt = option.trim().toLowerCase();

    // 1. If values match an exact option string in the options list, match by exact option string ONLY
    if (optionsList && optionsList.some(opt => rawValues.includes(opt.trim().toLowerCase()))) {
      return rawValues.includes(targetOpt);
    }

    // 2. Direct string match
    if (rawValues.includes(targetOpt)) {
      return true;
    }

    // 3. Fallback to index letter (A=0, B=1, C=2...) if no option text matched
    const letterIndex = String.fromCharCode(97 + index);
    return rawValues.includes(letterIndex);
  };

  const handleSectionClick = (sec: string) => {
    setActiveSection(sec);
    setSectionIndex(0);
  };

  if (!current) return <div className="solution-paper-empty"><button onClick={onClose}>← Back to score card</button><h3>Solution paper is not available for this attempt.</h3></div>;

  return (
    <div className="solution-paper">
      <header className="solution-paper-header">
        <div><ShineLogo compact /><h2>{testName}</h2></div>
        <div><span className="solution-avatar">{String(userName).charAt(0).toUpperCase()}</span><strong>{userName}</strong><button onClick={onClose}>Exit solution</button></div>
      </header>

      <div className="solution-section-bar">
        {sections.map((section) => (
          <button key={section} className={activeSection === section ? "active" : ""} onClick={() => handleSectionClick(section)}>
            {section}
          </button>
        ))}
      </div>

      <div className="solution-question-meta">
        <strong>Question No. {safeIndex + 1}</strong>
        <div>
          <span className="difficulty-pill">{activeSection || "General"}</span>
          <span className={status(current)}>
            {status(current) === "correct" ? "Correct" : status(current) === "wrong" ? "Incorrect" : "Unattempted"}
          </span>
        </div>
      </div>

      <main className="solution-paper-body">
        <section className="solution-question-pane">
          <ParsedQuestionPreview
            question={current.question || `Question ${safeIndex + 1}`}
            context={current.context}
            contextType={current.contextType}
            chartData={current.chartData}
            tableData={current.tableData}
            imageReference={current.imageReference}
            visualReferences={current.visualReferences}
            mappingStatus={current.mappingStatus}
            mappingConfidence={current.mappingConfidence}
          />
          <div className="solution-options">
            {(current.options || []).map((option: string, index: number) => {
              const correct = matches(current.correctAnswer, option, index, current.options);
              const chosen = matches(current.userAnswer, option, index, current.options);
              return (
                <div key={`${option}-${index}`} className={`solution-option ${correct ? "correct-option" : ""} ${chosen && !correct ? "wrong-option" : ""}`}>
                  <span>{String.fromCharCode(65 + index)}</span>
                  <p>{option}</p>
                  {correct && <b>✓ Correct answer</b>}
                  {chosen && correct && <em>Your answer</em>}
                  {chosen && !correct && <em>✕ Your answer</em>}
                </div>
              );
            })}
          </div>

          {(!current.options || current.options.length === 0) && <div className="solution-no-options">Answer review is unavailable for this question.</div>}

          <div className="solution-explanation">
            <strong>Solution & Explanation</strong>
            <p>{current.isCorrect ? "You selected the correct answer." : answered(current.userAnswer) ? "Your selected answer is incorrect. The correct option is highlighted in green." : "This question was not attempted. The correct option is highlighted in green."}</p>
          </div>
        </section>

        <aside className="solution-palette">
          <div className="solution-palette-head">
            <strong>{activeSection || "Questions"}</strong>
            <span>{safeIndex + 1} / {activeQuestions.length}</span>
          </div>

          <div className="solution-palette-grid">
            {activeQuestions.map((item: any, index: number) => (
              <button key={item.questionId || index} className={`${status(item)} ${index === safeIndex ? "current" : ""}`} onClick={() => setSectionIndex(index)}>
                {index + 1}
              </button>
            ))}
          </div>

          <div className="solution-legend">
            <span><i className="correct" />Correct</span>
            <span><i className="wrong" />Incorrect</span>
            <span><i className="empty" />Unattempted</span>
          </div>
        </aside>
      </main>

      <footer className="solution-paper-footer">
        <button disabled={safeIndex === 0} onClick={() => setSectionIndex((idx) => Math.max(0, idx - 1))}>
          ← Previous
        </button>
        <button className="solution-back-report" onClick={onClose}>
          Back to report
        </button>
        <button disabled={safeIndex === activeQuestions.length - 1} onClick={() => setSectionIndex((idx) => Math.min(activeQuestions.length - 1, idx + 1))}>
          Next →
        </button>
      </footer>
    </div>
  );
};
const QuestionReport=({total,correct,review}:any)=>{const [filter,setFilter]=useState("all");const rows=Array.from({length:total},(_,i)=>({item:review[i],index:i,status:reviewStatus(review[i],i,correct,total-correct)})).filter(({item}:any)=>filter==="all"||(filter==="faster"&&item?.topperTimeSec>0&&item?.timeSpentSec<=item?.topperTimeSec)||(filter==="slower"&&item?.topperTimeSec>0&&item?.timeSpentSec>item?.topperTimeSec)||(filter==="untimed"&&!item?.timeSpentSec));const time=(seconds?:number)=>seconds?`${Math.floor(seconds/60).toString().padStart(2,"0")}:${(seconds%60).toString().padStart(2,"0")}`:"—";return <div className="report-card table-card question-time-report"><div className="question-report-heading"><div><h3>Question Report</h3><p>Actual time spent compared with the cohort and top performer.</p></div><label>Topper comparison<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All questions</option><option value="faster">Faster than topper</option><option value="slower">Slower than topper</option><option value="untimed">No timing recorded</option></select></label></div><div className="report-table question-table"><div className="table-head"><span>S.No.</span><span>Status</span><span>Score</span><span>Your time</span><span>Average</span><span>Topper time</span><span>Comparison</span></div>{rows.map(({item,index,status}:any)=>{const delta=item?.topperTimeSec&&item?.timeSpentSec?item.timeSpentSec-item.topperTimeSec:0;return <div className="table-row" key={index}><span>{index+1}</span><span className={status==='correct'?'text-success':status==='wrong'?'text-danger':''}>{status==='correct'?'✓ Correct':status==='wrong'?'× Incorrect':'— Unattempted'}</span><span>{item?.marks ?? (status==='correct'?1:0)}</span><b>{time(item?.timeSpentSec)}</b><span>{time(item?.avgTimeSec)}</span><span>{time(item?.topperTimeSec)}</span><span className={delta<=0&&item?.timeSpentSec?"text-success":delta>0?"text-danger":""}>{!item?.timeSpentSec||!item?.topperTimeSec?"—":delta<=0?`${Math.abs(delta)}s faster`:`${delta}s slower`}</span></div>})}{rows.length===0&&<div className="question-report-empty">No questions match this topper filter.</div>}</div></div>};
const CompareReport=({score,total,pct}:any)=><><div className="compare-grid"><article className="report-card"><h3>Score Comparison</h3><div className="comparison-bars"><Metric label="You" value={score} max={total} color="#2f6fed"/><Metric label="Average" value={total*.52} max={total} color="#29b6d8"/><Metric label="Topper" value={total} max={total} color="#27b487"/></div></article><article className="report-card"><h3>Accuracy Comparison</h3><div className="comparison-bars"><Metric label="You" value={pct} max={100} color="#2f6fed"/><Metric label="Average" value={53} max={100} color="#29b6d8"/><Metric label="Topper" value={98} max={100} color="#27b487"/></div></article></div><div className="report-card topper-card"><h3>Top Performers</h3><div className="topper-bars">{[100,91,86,82,78,72,68,63,58,pct].map((x,i)=><div key={i}><span style={{height:`${Math.max(12,x)}%`}} className={i===9?'you':''}/><small>{i===9?'YOU':`${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'}`}</small></div>)}</div></div></>;
const InfoPage=({view}:{view:PortalView})=>{const data={bookmarks:["Saved questions","Important formulas","Revision list"],documents:["Exam preparation guide","Candidate handbook","Syllabus and marking scheme"],announcements:["New mock tests are now available","Scheduled maintenance this Sunday","Your latest report is ready"]}[view as 'bookmarks'];return <section className="portal-page info-page"><div className="info-hero"><span>{view==='bookmarks'?'▱':view==='documents'?'▧':'♢'}</span><div><h2>{view[0].toUpperCase()+view.slice(1)}</h2><p>Everything you need, organised in one place.</p></div></div><div className="info-list">{data.map((item,i)=><button key={item}><span>{i+1}</span><div><strong>{item}</strong><small>{view==='announcements'?'Posted recently':'Open resource'}</small></div><b>→</b></button>)}</div></section>};

export default AnswererDashboard;
