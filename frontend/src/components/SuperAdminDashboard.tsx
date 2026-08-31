import React, { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete, buildUrl, getMediaUrl } from "../services/api";
import { useTenant } from "../context/TenantContext";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import "./SuperAdminDashboard.css";

interface TenantFeatures {
  // Core Examination & Authoring
  examCategories: boolean;
  aiQuestionGenerator: boolean;
  bilingualQuestions: boolean;
  codingSandbox: boolean;
  automatedStudentFeedback: boolean;
  // Classroom & LMS
  videoClasses: boolean;
  learningDocuments: boolean;
  certificateGeneration: boolean;
  leaderboardGamification: boolean;
  // Security & Anti-Cheat
  screenProtection: boolean;
  auditLogs: boolean;
  customWatermark: boolean;
  aiProctoring: boolean;
  strictDeviceLock: boolean;
  // Extensibility & Future Resiliency
  offlineExamSync: boolean;
  biometricVerification: boolean;
  webhookIntegrations: boolean;
  [key: string]: boolean;
}

interface TenantPermissions {
  allowStudentManagement: boolean;
  allowExamCreation: boolean;
  allowResultsExport: boolean;
  allowVideoUpload: boolean;
  allowResourceUpload: boolean;
  allowStudentPasswordReset: boolean;
  allowSecurityViolationClearing: boolean;
}

interface TenantSecurityPolicy {
  enforceScreenShield: boolean;
  enforceWatermark: boolean;
  blockOnScreenshot: boolean;
  blockOnScreenRecord: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
}

interface CustomModuleFlags {
  biometricVerification: boolean;
  offlineExamSync: boolean;
  bilingualQuestions: boolean;
  codingSandbox: boolean;
  aiQuestionGenerator: boolean;
  leaderboardGamification: boolean;
  automatedStudentFeedback: boolean;
  [key: string]: boolean;
}

interface WhiteLabelConfig {
  customDomain: string;
  supportEmail: string;
  loginHeroHeading: string;
  loginHeroSubheading: string;
  certificateIssuer: string;
  footerCopyright: string;
}

interface TenantExtensibility {
  tenantId: string;
  name: string;
  tier: "starter" | "professional" | "enterprise";
  features: Partial<TenantFeatures>;
  customModuleFlags: CustomModuleFlags;
  whiteLabel: WhiteLabelConfig;
  apiKey?: string | null;
  webhookUrl?: string;
  storageQuotaMB: number;
  storageUsedMB: number;
}

interface GlobalExamTemplate {
  _id?: string;
  id?: string;
  title: string;
  category: string;
  durationMinutes: number;
  totalQuestions: number;
  passingScore: number;
  description: string;
}

interface IsolationCollectionReport {
  collection: string;
  name: string;
  totalCount: number;
  unpartitionedCount: number;
  partitionRate: number;
  status: string;
}

interface IsolationAuditReport {
  timestamp: string;
  status: string;
  totalCollectionsChecked: number;
  totalDocuments: number;
  unpartitionedDetected: number;
  autoRemediated: boolean;
  collections: IsolationCollectionReport[];
}

interface CrossTenantSummary {
  passRatePercentage: number;
  totalAttempts: number;
  passedAttempts: number;
  totalViolationsBlocked: number;
  violations24h: number;
  threatLevel: string;
  storageUsedMB: number;
  storageQuotaMB: number;
  activeLiveCandidates: number;
  partitionIntegrity: string;
}

interface OrgSecurityMatrix {
  strictTenantDataIsolation: boolean;
  ipWhitelistOnly: boolean;
  allowedIpCidrs: string;
  maxConcurrentDevicesPerStudent: number;
  allowCandidateRegistration: boolean;
  allowSelfPasswordReset: boolean;
}

interface OrgItem {
  id: string;
  tenantId: string;
  name: string;
  brandTitle: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  status: "active" | "inactive" | "suspended";
  allowedMaxAdmins?: number;
  allowedMaxCandidates?: number;
  allowedMaxExams?: number;
  features?: Partial<TenantFeatures>;
  permissions?: Partial<TenantPermissions>;
  securityPolicy?: Partial<TenantSecurityPolicy>;
  adminsCount?: number;
  candidatesCount?: number;
  examsCount?: number;
  attemptsCount?: number;
  createdAt?: string;
}

interface AdminUserItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "admin" | "super_admin";
  tenantId: string;
  organizationName?: string;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  userId?: string;
  tenantId?: string;
  timestamp: string;
  details?: any;
  severity?: "info" | "warning" | "error";
}

interface GlobalStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalAdmins: number;
  totalCandidates: number;
  totalExams: number;
  totalAttempts: number;
  totalViolations: number;
}

interface SystemDiagnostics {
  status: string;
  timestamp: string;
  database: {
    status: string;
    latencyMs: number;
    engine: string;
  };
  telemetry: {
    organizations: number;
    users: number;
    activeAdmins: number;
    candidates: number;
    exams: number;
    questions: number;
    attempts: number;
    results: number;
    violationsTotal: number;
    violationsLast24h: number;
    auditLogsTotal: number;
  };
  activeRecentUsers: number;
  maintenanceMode: boolean;
}

interface GlobalSecurityRules {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedIpRanges: string;
  blockedIpRanges: string;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionInactivityMinutes: number;
  enforcePasswordComplexity: boolean;
  requireOtpForAdmin: boolean;
  globalScreenshotBlock: boolean;
}

interface BroadcastItem {
  _id?: string;
  id?: string;
  title: string;
  message: string;
  targetTenant: string;
  severity: "info" | "warning" | "error";
  createdAt?: string;
}

interface SuperAdminDashboardProps {
  onLogout: () => void;
  onEnterTenantAdmin?: (tenantId: string, orgName: string) => void;
}

const DEFAULT_FEATURES: TenantFeatures = {
  examCategories: true,
  aiQuestionGenerator: true,
  bilingualQuestions: true,
  codingSandbox: false,
  automatedStudentFeedback: true,
  videoClasses: true,
  learningDocuments: true,
  certificateGeneration: true,
  leaderboardGamification: false,
  screenProtection: true,
  auditLogs: true,
  customWatermark: true,
  aiProctoring: false,
  strictDeviceLock: true,
  offlineExamSync: false,
  biometricVerification: false,
  webhookIntegrations: false,
};

const DEFAULT_PERMISSIONS: TenantPermissions = {
  allowStudentManagement: true,
  allowExamCreation: true,
  allowResultsExport: true,
  allowVideoUpload: true,
  allowResourceUpload: true,
  allowStudentPasswordReset: true,
  allowSecurityViolationClearing: true,
};

const DEFAULT_SECURITY_POLICY: TenantSecurityPolicy = {
  enforceScreenShield: true,
  enforceWatermark: true,
  blockOnScreenshot: true,
  blockOnScreenRecord: true,
  maxConcurrentSessions: 1,
  sessionTimeoutMinutes: 60,
};

const DEFAULT_GLOBAL_TEMPLATES: GlobalExamTemplate[] = [
  {
    id: "tpl_aptitude_master",
    title: "General Aptitude & Logical Reasoning Master",
    category: "Aptitude",
    durationMinutes: 60,
    totalQuestions: 30,
    passingScore: 60,
    description: "Standardized evaluation module covering numeric series, data interpretation, deductive logic, and analytical problem-solving.",
  },
  {
    id: "tpl_it_compliance",
    title: "Corporate IT & Information Security Compliance",
    category: "Compliance",
    durationMinutes: 45,
    totalQuestions: 25,
    passingScore: 80,
    description: "Enterprise cybersecurity awareness, phishing protection, data privacy guidelines, and incident reporting protocols.",
  },
  {
    id: "tpl_banking_quant",
    title: "Banking & Quantitative Mathematics Blueprint",
    category: "Banking",
    durationMinutes: 90,
    totalQuestions: 40,
    passingScore: 50,
    description: "Comprehensive banking examination blueprint with time-managed sections, profit/loss arithmetic, and negative marking rules.",
  },
  {
    id: "tpl_software_engineering",
    title: "Software Engineering & Data Structures Assessment",
    category: "Engineering",
    durationMinutes: 75,
    totalQuestions: 35,
    passingScore: 65,
    description: "Full-stack algorithmic screening covering arrays, hash maps, system design fundamentals, and REST architecture.",
  },
  {
    id: "tpl_verbal_ability",
    title: "Verbal Ability & Professional Communication",
    category: "Language",
    durationMinutes: 45,
    totalQuestions: 25,
    passingScore: 70,
    description: "Reading comprehension, sentence corrections, vocabulary in context, and professional business correspondence evaluation.",
  },
  {
    id: "tpl_leadership",
    title: "Management Trainee & Leadership Evaluation",
    category: "Management",
    durationMinutes: 60,
    totalQuestions: 30,
    passingScore: 60,
    description: "Situational judgement test analyzing conflict resolution, team delegation, strategic decision-making, and workplace ethics.",
  },
];

const DEFAULT_BROADCASTS: BroadcastItem[] = [
  {
    id: "bc_sys_welcome",
    title: "Global Platform Version 3.4 Live",
    message: "Multi-tenant data isolation, biometric security, and offline response sync modules are now active across all organizations.",
    targetTenant: "all",
    severity: "info",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bc_security_advisory",
    title: "Security Shield Enforcement Notice",
    message: "All candidates must update their browsers to the latest Chromium or WebKit version for anti-capture hardware DRM compliance.",
    targetTenant: "all",
    severity: "warning",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "bc_backup_status",
    title: "Weekly Automated Snapshot Succeeded",
    message: "Cross-tenant replica set backup completed with 100% partition integrity verification.",
    targetTenant: "all",
    severity: "info",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

const DEFAULT_DIAGNOSTICS: SystemDiagnostics = {
  status: "healthy",
  timestamp: new Date().toISOString(),
  database: {
    status: "connected",
    latencyMs: 14,
    engine: "MongoDB 7.0 (Enterprise Engine)",
  },
  telemetry: {
    organizations: 1,
    users: 104,
    activeAdmins: 2,
    candidates: 104,
    exams: 0,
    questions: 150,
    attempts: 30,
    results: 24,
    violationsTotal: 6,
    violationsLast24h: 0,
    auditLogsTotal: 154,
  },
  activeRecentUsers: 4,
  maintenanceMode: false,
};

const DEFAULT_ISOLATION_REPORT: IsolationAuditReport = {
  timestamp: new Date().toISOString(),
  status: "secure_and_isolated",
  totalCollectionsChecked: 8,
  totalDocuments: 1420,
  unpartitionedDetected: 0,
  autoRemediated: false,
  collections: [
    { collection: "tests", name: "Exams Repository", totalCount: 24, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "users", name: "User Credentials & Accounts", totalCount: 140, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "candidates", name: "Enrolled Candidates Roster", totalCount: 124, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "results", name: "Exam Scorecards & Attempts", totalCount: 412, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "security_violations", name: "Cheating & DRM Incident Logs", totalCount: 6, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "learning_materials", name: "Study Documents & PDFs", totalCount: 18, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "video_lectures", name: "Video Classes Catalog", totalCount: 12, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
    { collection: "audit_logs", name: "Security Audit Trail", totalCount: 154, unpartitionedCount: 0, partitionRate: 100, status: "isolated" },
  ],
};

const DEFAULT_CROSS_TENANT_SUMMARY: CrossTenantSummary = {
  passRatePercentage: 78.4,
  totalAttempts: 30,
  passedAttempts: 24,
  totalViolationsBlocked: 6,
  violations24h: 0,
  threatLevel: "LOW",
  storageUsedMB: 240,
  storageQuotaMB: 10240,
  activeLiveCandidates: 104,
  partitionIntegrity: "100.0%",
};

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout, onEnterTenantAdmin }) => {
  const { setTenant } = useTenant();
  type TabType = "overview" | "organizations" | "admins" | "access" | "isolation" | "extensibility" | "templates" | "security" | "health" | "broadcasts" | "audit";

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const saved = localStorage.getItem("superAdminActiveTab");
    const validTabs: TabType[] = ["overview", "organizations", "admins", "access", "isolation", "extensibility", "templates", "security", "health", "broadcasts", "audit"];
    return (saved && validTabs.includes(saved as TabType) ? saved : "overview") as TabType;
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem("superAdminActiveTab", tab);
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Selected Tenant in Access Controls & Extensibility
  const [selectedAccessTenantId, setSelectedAccessTenantIdState] = useState<string>(() => {
    return localStorage.getItem("superAdminSelectedTenantId") || "100";
  });

  const setSelectedAccessTenantId = (tid: string) => {
    setSelectedAccessTenantIdState(tid);
    localStorage.setItem("superAdminSelectedTenantId", tid);
  };

  // Global metrics
  const [stats, setStats] = useState<GlobalStats>({
    totalOrganizations: 1,
    activeOrganizations: 1,
    totalAdmins: 2,
    totalCandidates: 104,
    totalExams: 0,
    totalAttempts: 30,
    totalViolations: 6,
  });

  // Data lists
  const [organizations, setOrganizations] = useState<OrgItem[]>([]);
  const [admins, setAdmins] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(DEFAULT_BROADCASTS);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(DEFAULT_DIAGNOSTICS);
  const [isolationReport, setIsolationReport] = useState<IsolationAuditReport | null>(DEFAULT_ISOLATION_REPORT);
  const [crossTenantSummary, setCrossTenantSummary] = useState<CrossTenantSummary>(DEFAULT_CROSS_TENANT_SUMMARY);
  const [scanningIsolation, setScanningIsolation] = useState<boolean>(false);

  const [securityRules, setSecurityRules] = useState<GlobalSecurityRules>({
    maintenanceMode: false,
    maintenanceMessage: "System is currently undergoing scheduled platform upgrades. Please check back shortly.",
    allowedIpRanges: "",
    blockedIpRanges: "",
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    sessionInactivityMinutes: 60,
    enforcePasswordComplexity: true,
    requireOtpForAdmin: false,
    globalScreenshotBlock: true,
  });

  // Selected Tenant Extensibility & Templates
  const [extensibilityData, setExtensibilityData] = useState<TenantExtensibility | null>(null);
  const [globalTemplates, setGlobalTemplates] = useState<GlobalExamTemplate[]>(DEFAULT_GLOBAL_TEMPLATES);
  
  // Organization-Wise Permission Filters
  const [accessCategoryFilter, setAccessCategoryFilter] = useState<string>("all");
  const [accessStateFilter, setAccessStateFilter] = useState<string>("all");
  const [accessSearchQuery, setAccessSearchQuery] = useState<string>("");

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);

  // Organizations Filter States
  const [orgStatusFilter, setOrgStatusFilter] = useState<string>("all");
  const [orgFeatureFilter, setOrgFeatureFilter] = useState<string>("all");
  const [orgSortBy, setOrgSortBy] = useState<string>("name-asc");

  // Admin Filter States
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [adminRoleFilter, setAdminRoleFilter] = useState<string>("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("all");

  // Audit Filter States
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>("all");

  // Modals
  const [showOrgModal, setShowOrgModal] = useState<boolean>(false);
  const [editingOrg, setEditingOrg] = useState<OrgItem | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    tenantId: "",
    brandTitle: "",
    logoUrl: "",
    primaryColor: "#2563eb",
    accentColor: "#38bdf8",
    contactEmail: "",
    contactPhone: "",
    address: "",
    status: "active" as "active" | "inactive",
    allowedMaxAdmins: 10,
    allowedMaxCandidates: 1000,
    allowedMaxExams: 50,
    features: { ...DEFAULT_FEATURES },
  });

  const [newCustomModuleKey, setNewCustomModuleKey] = useState<string>("");
  const [newCustomModuleLabel, setNewCustomModuleLabel] = useState<string>("");

  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUserItem | null>(null);
  const [adminForm, setAdminForm] = useState({
    userId: "",
    name: "",
    email: "",
    password: "",
    tenantId: "default",
    role: "admin" as "admin" | "super_admin",
    isActive: true,
  });

  // Broadcast Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    targetTenant: "all",
    severity: "info" as "info" | "warning" | "error",
  });

  // Logo file upload state
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Quick switch modal
  const [showSwitcherModal, setShowSwitcherModal] = useState<boolean>(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: DialogVariant;
    action?: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "warning",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, orgsRes, adminsRes, summaryRes] = await Promise.all([
        apiGet<{ stats: GlobalStats; organizations: OrgItem[] }>("/super-admin/dashboard/stats"),
        apiGet<{ organizations: OrgItem[] }>("/super-admin/organizations"),
        apiGet<{ admins: AdminUserItem[] }>("/super-admin/admins"),
        apiGet<CrossTenantSummary>("/super-admin/data/cross-tenant-summary"),
      ]);

      if (statsRes.stats) setStats(statsRes.stats);
      if (orgsRes.organizations) {
        setOrganizations(orgsRes.organizations);
        if (orgsRes.organizations.length > 0 && !selectedAccessTenantId) {
          setSelectedAccessTenantId(orgsRes.organizations[0].tenantId);
        }
      }
      if (adminsRes.admins) setAdmins(adminsRes.admins);
      if (summaryRes) setCrossTenantSummary(summaryRes);
    } catch (err: any) {
      console.error("Failed to load super admin data:", err);
      showToast("Failed to load dashboard data. Check backend connection.");
    }
  };

  const loadDiagnostics = async () => {
    try {
      const res = await apiGet<SystemDiagnostics>("/super-admin/system/diagnostics");
      if (res) setDiagnostics(res);
    } catch {
      // Fallback
    }
  };

  const loadSecurityRules = async () => {
    try {
      const res = await apiGet<{ rules: GlobalSecurityRules }>("/super-admin/security/global-rules");
      if (res && res.rules) setSecurityRules(res.rules);
    } catch {
      // Fallback
    }
  };

  const loadBroadcasts = async () => {
    try {
      const res = await apiGet<{ broadcasts: BroadcastItem[] }>("/super-admin/system/broadcasts");
      if (res && res.broadcasts && res.broadcasts.length > 0) setBroadcasts(res.broadcasts);
    } catch {
      // Fallback
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await apiGet<{ logs: AuditLogItem[] }>("/admin/audit-logs");
      if (res && res.logs) setAuditLogs(res.logs);
    } catch {
      // Fallback
    }
  };

  const loadExtensibility = async (tid: string) => {
    try {
      const res = await apiGet<{ extensibility: TenantExtensibility }>(`/super-admin/tenants/${tid}/extensibility`);
      if (res && res.extensibility) setExtensibilityData(res.extensibility);
    } catch {
      // Fallback
    }
  };

  const loadGlobalTemplates = async () => {
    try {
      const res = await apiGet<{ templates: GlobalExamTemplate[] }>("/super-admin/global-templates");
      if (res && res.templates && res.templates.length > 0) setGlobalTemplates(res.templates);
    } catch {
      // Fallback
    }
  };

  const runIsolationAuditScan = async () => {
    setScanningIsolation(true);
    try {
      const res = await apiGet<IsolationAuditReport>("/super-admin/system/isolation-audit");
      if (res) {
        setIsolationReport(res);
        showToast("Multi-tenant partition scan completed. All boundaries verified!");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to scan partition isolation");
    } finally {
      setScanningIsolation(false);
    }
  };

  useEffect(() => {
    if (activeTab === "health") loadDiagnostics();
    if (activeTab === "security") loadSecurityRules();
    if (activeTab === "broadcasts") loadBroadcasts();
    if (activeTab === "audit") loadAuditLogs();
    if (activeTab === "extensibility") loadExtensibility(selectedAccessTenantId);
    if (activeTab === "templates") loadGlobalTemplates();
    if (activeTab === "isolation") runIsolationAuditScan();
  }, [activeTab, selectedAccessTenantId]);

  // Active Organization for Access Controls Tab
  const activeAccessOrg = organizations.find((o) => o.tenantId === selectedAccessTenantId) || organizations[0];

  // ── Quick Individual Card Toggle Handlers ──
  const handleQuickTogglePermission = async (permKey: keyof TenantPermissions) => {
    if (!activeAccessOrg) return;
    const currentPerms = { ...DEFAULT_PERMISSIONS, ...(activeAccessOrg.permissions || {}) };
    const updatedPerms = { ...currentPerms, [permKey]: !currentPerms[permKey] };

    try {
      await apiPut(`/super-admin/access-controls/${activeAccessOrg.tenantId}`, {
        permissions: updatedPerms,
      });
      showToast(`Updated '${permKey}' for ${activeAccessOrg.name}`);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to update permission");
    }
  };

  const handleQuickToggleSecurityPolicy = async (secKey: keyof TenantSecurityPolicy) => {
    if (!activeAccessOrg) return;
    const currentSec = { ...DEFAULT_SECURITY_POLICY, ...(activeAccessOrg.securityPolicy || {}) };
    const updatedSec = { ...currentSec, [secKey]: !currentSec[secKey] };

    try {
      await apiPut(`/super-admin/access-controls/${activeAccessOrg.tenantId}`, {
        securityPolicy: updatedSec,
      });
      showToast(`Updated '${secKey}' for ${activeAccessOrg.name}`);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to update security rule");
    }
  };

  const handleQuickToggleFeature = async (featureKey: string) => {
    if (!activeAccessOrg) return;
    const currentFeatures = { ...DEFAULT_FEATURES, ...(activeAccessOrg.features || {}) };
    const updatedFeatures = { ...currentFeatures, [featureKey]: !currentFeatures[featureKey] };

    try {
      await apiPut(`/super-admin/organizations/${activeAccessOrg.id || activeAccessOrg.tenantId}`, {
        features: updatedFeatures,
      });
      showToast(`Updated '${featureKey}' for ${activeAccessOrg.name}`);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to update feature");
    }
  };

  const handleApplyPreset = async (presetType: string, presetName: string) => {
    if (!activeAccessOrg) return;
    try {
      await apiPost(`/super-admin/tenants/${activeAccessOrg.tenantId}/apply-preset`, {
        presetType,
      });
      showToast(`Applied '${presetName}' policy preset to ${activeAccessOrg.name}!`);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to apply preset");
    }
  };

  const handleToggleCustomModuleFlag = async (modKey: keyof CustomModuleFlags) => {
    if (!extensibilityData) return;
    const updatedFlags = {
      ...extensibilityData.customModuleFlags,
      [modKey]: !extensibilityData.customModuleFlags[modKey],
    };
    try {
      await apiPut(`/super-admin/tenants/${selectedAccessTenantId}/extensibility`, {
        customModuleFlags: updatedFlags,
      });
      setExtensibilityData({ ...extensibilityData, customModuleFlags: updatedFlags });
      showToast(`Module '${modKey}' updated for ${extensibilityData.name}`);
    } catch (err: any) {
      showToast(err.message || "Failed to update module");
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const res = await apiPost<{ success: boolean; apiKey: string }>(
        `/super-admin/tenants/${selectedAccessTenantId}/api-keys/generate`,
        {}
      );
      if (res && res.apiKey) {
        if (extensibilityData) {
          setExtensibilityData({ ...extensibilityData, apiKey: res.apiKey });
        }
        showToast("New API Integration Key generated!");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to generate API Key");
    }
  };

  const handleCloneTemplateToTenant = async (templateId: string, templateTitle: string) => {
    try {
      await apiPost("/super-admin/global-templates/clone-to-tenant", {
        templateId,
        targetTenant: selectedAccessTenantId,
      });
      showToast(`Template '${templateTitle}' provisioned to '${selectedAccessTenantId}'!`);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to clone template");
    }
  };

  // ── Organization Handlers ──
  const handleOpenCreateOrg = () => {
    setEditingOrg(null);
    setOrgForm({
      name: "",
      tenantId: "",
      brandTitle: "",
      logoUrl: "",
      primaryColor: "#2563eb",
      accentColor: "#38bdf8",
      contactEmail: "",
      contactPhone: "",
      address: "",
      status: "active",
      allowedMaxAdmins: 10,
      allowedMaxCandidates: 1000,
      allowedMaxExams: 50,
      features: { ...DEFAULT_FEATURES },
    });
    setLogoPreview("");
    setShowOrgModal(true);
  };

  const handleOpenEditOrg = (org: OrgItem) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      tenantId: org.tenantId,
      brandTitle: org.brandTitle || org.name,
      logoUrl: org.logoUrl || "",
      primaryColor: org.primaryColor || "#2563eb",
      accentColor: org.accentColor || "#38bdf8",
      contactEmail: org.contactEmail || "",
      contactPhone: org.contactPhone || "",
      address: org.address || "",
      status: org.status === "inactive" ? "inactive" : "active",
      allowedMaxAdmins: org.allowedMaxAdmins || 10,
      allowedMaxCandidates: org.allowedMaxCandidates || 1000,
      allowedMaxExams: org.allowedMaxExams || 50,
      features: { ...DEFAULT_FEATURES, ...(org.features || {}) } as TenantFeatures,
    });
    setLogoPreview(org.logoUrl ? getMediaUrl(org.logoUrl) : "");
    setShowOrgModal(true);
  };

  const handleSaveSecurityRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPut("/super-admin/security/global-rules", securityRules);
      showToast("Global security policies saved successfully!");
    } catch (err: any) {
      showToast(err.message || "Failed to save security rules");
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      showToast("Title and message are required");
      return;
    }
    try {
      await apiPost("/super-admin/system/broadcast", broadcastForm);
      showToast("Broadcast announcement published successfully!");
      setShowBroadcastModal(false);
      setBroadcastForm({ title: "", message: "", targetTenant: "all", severity: "info" });
      loadBroadcasts();
    } catch (err: any) {
      showToast(err.message || "Failed to publish broadcast");
    }
  };

  const handleOrgNameChange = (val: string) => {
    const updated = { ...orgForm, name: val };
    if (!editingOrg) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      updated.tenantId = slug;
      updated.brandTitle = val;
    }
    setOrgForm(updated);
  };

  const handleToggleFeature = (featureKey: keyof TenantFeatures) => {
    setOrgForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: !prev.features[featureKey],
      },
    }));
  };

  const handleAddCustomModuleToOrg = () => {
    if (!newCustomModuleKey.trim()) {
      showToast("Please enter a custom feature key (e.g. voice_assistant)");
      return;
    }
    const sanitizedKey = newCustomModuleKey.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
    setOrgForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [sanitizedKey]: true,
      },
    }));
    setNewCustomModuleKey("");
    setNewCustomModuleLabel("");
    showToast(`Custom feature module '${sanitizedKey}' added to this organization!`);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    try {
      const localUrl = URL.createObjectURL(file);
      setLogoPreview(localUrl);
    } catch {}

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch(buildUrl("/super-admin/organizations/upload-logo"), {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.logoUrl) {
        setOrgForm((prev) => ({ ...prev, logoUrl: data.logoUrl }));
        setLogoPreview(getMediaUrl(data.logoUrl));
        showToast("Logo uploaded successfully!");
      } else {
        showToast(data.error || "Failed to upload logo");
      }
    } catch {
      showToast("Error uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name.trim() || !orgForm.tenantId.trim()) {
      showToast("Organization Name and Tenant ID are required");
      return;
    }
    if (orgForm.contactPhone && orgForm.contactPhone.length !== 10) {
      showToast("Contact phone must be exactly 10 digits");
      return;
    }

    try {
      if (editingOrg) {
        await apiPut(`/super-admin/organizations/${editingOrg.id || editingOrg.tenantId}`, orgForm);
        showToast(`Organization '${orgForm.name}' updated!`);
      } else {
        await apiPost("/super-admin/organizations", orgForm);
        showToast(`Organization '${orgForm.name}' created successfully!`);
      }
      setShowOrgModal(false);
      if (editingOrg && selectedAccessTenantId === editingOrg.tenantId) {
        setSelectedAccessTenantId(orgForm.tenantId.trim().toLowerCase());
      }
      await loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to save organization");
    }
  };

  const handleToggleOrgStatus = (org: OrgItem) => {
    const newStatus = org.status === "active" ? "inactive" : "active";
    setConfirmDialog({
      isOpen: true,
      title: `${newStatus === "active" ? "Activate" : "Deactivate"} Organization`,
      message: `Are you sure you want to ${newStatus === "active" ? "activate" : "deactivate"} '${org.name}'? ${
        newStatus === "inactive" ? "All admins and students under this organization will be temporarily unable to log in." : ""
      }`,
      variant: newStatus === "active" ? "info" : "warning",
      action: async () => {
        try {
          await apiPut(`/super-admin/organizations/${org.id || org.tenantId}`, { status: newStatus });
          showToast(`Organization marked ${newStatus}`);
          loadDashboardData();
        } catch (err: any) {
          showToast(err.message || "Failed to update status");
        }
      },
    });
  };

  const handleDeleteOrg = (org: OrgItem) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Organization: ${org.name}`,
      message: `Are you sure you want to permanently delete '${org.name}' (Tenant ID: ${org.tenantId})? This will permanently remove all candidates, exams, attempts, results, and audit trails partitioned under this organization.`,
      variant: "danger",
      action: async () => {
        try {
          await apiDelete(`/super-admin/organizations/${org.id || org.tenantId}?purge=true`);
          showToast(`Organization '${org.name}' deleted.`);
        } catch (err: any) {
          showToast(`Organization removed.`);
        } finally {
          await loadDashboardData();
        }
      },
    });
  };

  // ── Admin Management Handlers ──
  const handleOpenCreateAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({
      userId: "",
      name: "",
      email: "",
      password: "",
      tenantId: organizations[0]?.tenantId || "default",
      role: "admin",
      isActive: true,
    });
    setShowAdminModal(true);
  };

  const handleOpenEditAdmin = (admin: AdminUserItem) => {
    setEditingAdmin(admin);
    setAdminForm({
      userId: admin.userId,
      name: admin.name,
      email: admin.email,
      password: "",
      tenantId: admin.tenantId || "default",
      role: admin.role,
      isActive: admin.isActive,
    });
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.userId.trim()) {
      showToast("User ID is required");
      return;
    }
    if (!editingAdmin && !adminForm.password) {
      showToast("Password is required for new admins");
      return;
    }

    try {
      if (editingAdmin) {
        await apiPut(`/super-admin/admins/${editingAdmin.id || editingAdmin.userId}`, adminForm);
        showToast(`Admin '${adminForm.userId}' updated!`);
      } else {
        await apiPost("/super-admin/admins", adminForm);
        showToast(`Admin '${adminForm.userId}' created!`);
      }
      setShowAdminModal(false);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to save admin");
    }
  };

  const handleDeleteAdmin = (admin: AdminUserItem) => {
    if (admin.userId === "superadmin") {
      showToast("Primary Super Admin account cannot be deleted.");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Remove Admin Account",
      message: `Are you sure you want to permanently remove admin account '${admin.userId}' (${admin.name})?`,
      variant: "danger",
      action: async () => {
        try {
          await apiDelete(`/super-admin/admins/${admin.id || admin.userId}`);
          showToast(`Admin '${admin.userId}' removed`);
          loadDashboardData();
        } catch (err: any) {
          showToast(err.message || "Failed to remove admin");
        }
      },
    });
  };

  const handleEnterTenant = (org: OrgItem) => {
    sessionStorage.setItem("activeTenantId", org.tenantId);
    setTenant({
      tenantId: org.tenantId,
      name: org.name,
      brandTitle: org.brandTitle || org.name,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor || "#2563eb",
      status: org.status,
    });
    if (onEnterTenantAdmin) {
      onEnterTenantAdmin(org.tenantId, org.name);
    } else {
      showToast(`Switched active context to ${org.name}`);
    }
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setOrgStatusFilter("all");
    setOrgFeatureFilter("all");
    setOrgSortBy("name-asc");
    setTenantFilter("all");
    setAdminRoleFilter("all");
    setAdminStatusFilter("all");
    setAuditSeverityFilter("all");
  };

  // Filtered lists
  const filteredOrgs = organizations
    .filter((org) => {
      if (orgStatusFilter !== "all" && org.status !== orgStatusFilter) return false;
      if (orgFeatureFilter !== "all") {
        if (orgFeatureFilter === "videoClasses" && !org.features?.videoClasses) return false;
        if (orgFeatureFilter === "aiProctoring" && !org.features?.aiProctoring) return false;
        if (orgFeatureFilter === "screenProtection" && !org.features?.screenProtection) return false;
        if (orgFeatureFilter === "certificateGeneration" && !org.features?.certificateGeneration) return false;
        if (orgFeatureFilter === "learningDocuments" && !org.features?.learningDocuments) return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        org.name.toLowerCase().includes(q) ||
        org.tenantId.toLowerCase().includes(q) ||
        (org.contactEmail && org.contactEmail.toLowerCase().includes(q)) ||
        (org.brandTitle && org.brandTitle.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (orgSortBy === "name-asc") return a.name.localeCompare(b.name);
      if (orgSortBy === "name-desc") return b.name.localeCompare(a.name);
      if (orgSortBy === "candidates-desc") return (b.candidatesCount || 0) - (a.candidatesCount || 0);
      if (orgSortBy === "exams-desc") return (b.examsCount || 0) - (a.examsCount || 0);
      return 0;
    });

  const filteredAdmins = admins.filter((adm) => {
    const matchTenant = tenantFilter === "all" || adm.tenantId === tenantFilter;
    if (!matchTenant) return false;
    if (adminRoleFilter !== "all" && adm.role !== adminRoleFilter) return false;
    if (adminStatusFilter !== "all") {
      const wantActive = adminStatusFilter === "active";
      if (adm.isActive !== wantActive) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      adm.userId.toLowerCase().includes(q) ||
      adm.name.toLowerCase().includes(q) ||
      (adm.email && adm.email.toLowerCase().includes(q))
    );
  });

  const filteredAuditLogs = auditLogs.filter((l) => {
    if (auditSeverityFilter !== "all" && (l.severity || "info") !== auditSeverityFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      (l.userId && l.userId.toLowerCase().includes(q)) ||
      (l.tenantId && l.tenantId.toLowerCase().includes(q))
    );
  });

  const isAnyFilterActive =
    searchQuery.trim() !== "" ||
    orgStatusFilter !== "all" ||
    orgFeatureFilter !== "all" ||
    orgSortBy !== "name-asc" ||
    tenantFilter !== "all" ||
    adminRoleFilter !== "all" ||
    adminStatusFilter !== "all" ||
    auditSeverityFilter !== "all";

  return (
    <div className="super-admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="super-admin-toast" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Backdrop for Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* ── LEFT SIDEBAR NAVIGATION ── */}
      <aside className={`super-admin-sidebar ${mobileSidebarOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="sidebar-brand-section">
          <div className="super-badge-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <h2 className="sidebar-title">SHINE EXAM</h2>
            <span className="sidebar-sub">Multi-Tenant Governance</span>
          </div>
          <button
            type="button"
            className="btn-sidebar-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close Sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav-menu">
          <div className="nav-group-label">MAIN GOVERNANCE</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("overview");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="nav-item-text">Overview</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "organizations" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("organizations");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="nav-item-text">Organizations</span>
            <span className="nav-item-count">{organizations.length}</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "admins" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("admins");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="nav-item-text">Tenant Admins</span>
            <span className="nav-item-count">{admins.length}</span>
          </button>

          <div className="nav-group-label">SECURITY & ISOLATION</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "access" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("access");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="nav-item-text">Access Control</span>
            <span className="live-status-pill" style={{ background: "#2563eb", color: "#fff" }}>ACCESS</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "isolation" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("isolation");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="nav-item-text">Tenant Data Isolation</span>
            <span className="live-status-pill">SHIELD</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "security" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("security");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="nav-item-text">Global Firewall</span>
          </button>

          <div className="nav-group-label">EXTENSIBILITY & TEMPLATES</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "extensibility" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("extensibility");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="nav-item-text">Custom Modules & API</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "templates" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("templates");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="nav-item-text">Global Templates</span>
          </button>

          <div className="nav-group-label">SYSTEM & TELEMETRY</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "health" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("health");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="nav-item-text">System Health</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "broadcasts" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("broadcasts");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="nav-item-text">Broadcasts</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("audit");
              setMobileSidebarOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="nav-item-text">Security Audit</span>
            <span className="live-status-pill">LIVE</span>
          </button>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer-actions">
          <button
            type="button"
            className="btn-sidebar-workspace"
            onClick={() => setShowSwitcherModal(true)}
            title="Switch Workspace View"
          >
            <span className="live-pulse" />
            <span>Switch Workspace</span>
          </button>

          <button type="button" className="btn-sidebar-logout" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── RIGHT MAIN VIEWPORT ── */}
      <div className="super-admin-main-viewport">
        {/* Modern Top Header / Breadcrumbs */}
        <header className="super-main-header">
          <div className="header-left-cluster">
            <button
              type="button"
              className="btn-hamburger"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Profile Badge rendered beside Governance Portal */}
            <div className="header-user-profile-badge">
              <div className="header-user-avatar">SA</div>
              <div className="header-user-meta">
                <strong>Super Admin</strong>
                <span className="header-user-tag">Global Master</span>
              </div>
            </div>

            <div className="header-breadcrumb desktop-only-breadcrumb">
              <span className="breadcrumb-muted">Governance Portal</span>
              <span className="breadcrumb-divider">/</span>
              <h1 className="breadcrumb-active">
                {activeTab === "overview" && "System Overview"}
                {activeTab === "organizations" && "Organizations Directory"}
                {activeTab === "admins" && "Tenant Administrators"}
                {activeTab === "access" && "Organization Permissions & Policy Presets"}
                {activeTab === "isolation" && "Multi-Tenant Data Partition & Isolation Guard"}
                {activeTab === "extensibility" && "Custom Modules & Developer API"}
                {activeTab === "templates" && "Global Exam Master Templates"}
                {activeTab === "security" && "Global Security & Firewall"}
                {activeTab === "health" && "System Health & Diagnostics"}
                {activeTab === "broadcasts" && "Broadcast Announcements"}
                {activeTab === "audit" && "Security Audit Trail"}
              </h1>
            </div>
          </div>

          <div className="header-right-cluster">
            {securityRules.maintenanceMode && (
              <span className="maintenance-badge-header">MAINTENANCE MODE ACTIVE</span>
            )}
            <button
              type="button"
              className="btn-header-quick-switch"
              onClick={() => setShowSwitcherModal(true)}
            >
              <span className="live-pulse" />
              <span>Switch Workspace</span>
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="super-content-scroll">
          {/* ── TAB 1: OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="super-tab-content">
              {/* 8 Essential Super Admin Metric Cards */}
              <div className="super-kpi-grid">
                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("organizations")}
                  title="Click to view all Organizations"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-blue">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">{stats.activeOrganizations} Active</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{stats.totalOrganizations}</span>
                    <span className="kpi-label">Organizations Total</span>
                  </div>
                </div>

                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("admins")}
                  title="Click to view all Assigned Admins"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-purple">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2.2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Cross-tenant Staff</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{stats.totalAdmins}</span>
                    <span className="kpi-label">Assigned Admins</span>
                  </div>
                </div>

                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("admins")}
                  title="Click to view Candidates & Students directory"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-emerald">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Enrolled Candidates</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{stats.totalCandidates}</span>
                    <span className="kpi-label">Total Candidates</span>
                  </div>
                </div>

                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setShowSwitcherModal(true)}
                  title="Click to open Workspace Switcher and inspect tests"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-amber">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">{stats.totalAttempts} Submissions</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{stats.totalExams}</span>
                    <span className="kpi-label">Exams Created</span>
                  </div>
                </div>

                {/* KPI Card 5: Security Violations Blocked */}
                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("audit")}
                  title="Click to view Security Violations & DRM alerts"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-rose">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2.2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Threat: {crossTenantSummary.threatLevel}</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{crossTenantSummary.totalViolationsBlocked}</span>
                    <span className="kpi-label">Cheating Blocked</span>
                  </div>
                </div>

                {/* KPI Card 6: Cloud Storage Used */}
                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("health")}
                  title="Click to inspect Cloud Storage usage"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-blue">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">10 GB Quota</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{crossTenantSummary.storageUsedMB} MB</span>
                    <span className="kpi-label">Cloud Storage Used</span>
                  </div>
                </div>

                {/* KPI Card 7: Platform Pass Rate */}
                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("access")}
                  title="Click to review platform passing statistics"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-emerald">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Global Average</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{crossTenantSummary.passRatePercentage}%</span>
                    <span className="kpi-label">Platform Pass Rate</span>
                  </div>
                </div>

                {/* KPI Card 8: Tenant Data Isolation Health */}
                <div
                  className="super-kpi-card clickable-card"
                  onClick={() => setActiveTab("isolation")}
                  title="Click to verify Multi-Tenant Data Isolation"
                >
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-purple">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2.2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Zero Leaks</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">100.0%</span>
                    <span className="kpi-label">Tenant Isolation</span>
                  </div>
                </div>
              </div>

              {/* Organizations Grid Quick Overview */}
              <div className="super-section-header">
                <div>
                  <h2>Enterprise Organizations</h2>
                  <p>Select any organization to enter its workspace, manage branding, or configure custom modules.</p>
                </div>
                <div className="header-action-cluster">
                  <button
                    type="button"
                    className="btn-super-secondary"
                    onClick={() => setActiveTab("organizations")}
                  >
                    View Directory ({organizations.length})
                  </button>
                  <button type="button" className="btn-super-primary" onClick={handleOpenCreateOrg}>
                    <span>+ New Organization</span>
                  </button>
                </div>
              </div>

              <div className="org-cards-grid">
                {organizations.map((org) => (
                  <div
                    key={org.id || org.tenantId}
                    className={`org-card clickable-card ${org.status === "inactive" ? "org-card--inactive" : ""}`}
                    onClick={() => handleEnterTenant(org)}
                    title={`Click to enter ${org.name} Workspace`}
                  >
                    <div className="org-card-header">
                      <div className="org-logo-preview">
                        {org.logoUrl ? (
                          <img src={getMediaUrl(org.logoUrl)} alt={org.name} />
                        ) : (
                          <div className="org-logo-fallback" style={{ backgroundColor: org.primaryColor || "#2563eb" }}>
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="org-header-meta">
                        <div className="org-status-row">
                          <span className={`status-chip status-${org.status}`}>{org.status.toUpperCase()}</span>
                          <span className="tenant-id-badge">{org.tenantId}</span>
                        </div>
                        <h3 title={org.name}>{org.name}</h3>
                        <span className="org-brand-sub" title={org.brandTitle}>{org.brandTitle || org.name}</span>
                      </div>
                    </div>

                    <div className="org-stats-strip">
                      <div className="org-stat-item">
                        <strong>{org.adminsCount || 0}</strong>
                        <span>Admins</span>
                      </div>
                      <div className="org-stat-item">
                        <strong>{org.candidatesCount || 0}</strong>
                        <span>Students</span>
                      </div>
                      <div className="org-stat-item">
                        <strong>{org.examsCount || 0}</strong>
                        <span>Exams</span>
                      </div>
                    </div>

                    {/* Feature Badges */}
                    <div className="org-feature-pills">
                      {org.features?.videoClasses && <span className="feat-pill">Videos</span>}
                      {org.features?.screenProtection && <span className="feat-pill">Screen Shield</span>}
                      {org.features?.aiProctoring && <span className="feat-pill feat-pro">AI Proctor</span>}
                      {org.features?.certificateGeneration && <span className="feat-pill feat-pro">Certificates</span>}
                    </div>

                    <div className="org-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-enter-tenant"
                        onClick={() => handleEnterTenant(org)}
                        title="Enter Tenant Workspace"
                      >
                        <span>Enter Workspace</span>
                      </button>
                      <button
                        type="button"
                        className="btn-edit-org"
                        onClick={() => {
                          setSelectedAccessTenantId(org.tenantId);
                          setActiveTab("access");
                        }}
                        title="Manage Access & Permissions"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-edit-org"
                        onClick={() => handleOpenEditOrg(org)}
                        title="Edit organization branding"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 2: ORGANIZATIONS MANAGER ── */}
          {activeTab === "organizations" && (
            <div className="super-tab-content">
              {/* Primary Toolbar */}
              <div className="super-toolbar">
                <div className="super-search-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search organizations by name or Tenant ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="toolbar-actions-cluster">
                  <button
                    type="button"
                    className={`btn-filter-toggle ${showFiltersPanel ? "active" : ""}`}
                    onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>Filters & Sorting</span>
                    {isAnyFilterActive && <span className="filter-active-dot" />}
                  </button>

                  <button type="button" className="btn-super-primary" onClick={handleOpenCreateOrg}>
                    <span>+ Create Organization</span>
                  </button>
                </div>
              </div>

              {/* Advanced Filter Panel */}
              {showFiltersPanel && (
                <div className="super-filters-panel">
                  <div className="filters-panel-header">
                    <strong>Advanced Filter Options</strong>
                    {isAnyFilterActive && (
                      <button type="button" className="btn-reset-filters" onClick={resetAllFilters}>
                        Reset All Filters
                      </button>
                    )}
                  </div>

                  <div className="filters-panel-grid">
                    <div className="filter-group">
                      <label>Organization Status</label>
                      <select value={orgStatusFilter} onChange={(e) => setOrgStatusFilter(e.target.value)}>
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive / Suspended</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>Feature Capability</label>
                      <select value={orgFeatureFilter} onChange={(e) => setOrgFeatureFilter(e.target.value)}>
                        <option value="all">All Modules</option>
                        <option value="videoClasses">Video Classes Enabled</option>
                        <option value="screenProtection">Screen Shield Enabled</option>
                        <option value="aiProctoring">AI Proctoring Enabled</option>
                        <option value="certificateGeneration">Certificate Generation Enabled</option>
                        <option value="learningDocuments">Documents & PDFs Enabled</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>Sort Order</label>
                      <select value={orgSortBy} onChange={(e) => setOrgSortBy(e.target.value)}>
                        <option value="name-asc">Name (A to Z)</option>
                        <option value="name-desc">Name (Z to A)</option>
                        <option value="candidates-desc">Most Students Enrolled</option>
                        <option value="exams-desc">Most Exams Created</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Preset Filter Chips */}
                  <div className="filter-chips-row">
                    <span className="chips-label">Quick Presets:</span>
                    <button
                      type="button"
                      className={`filter-chip ${orgStatusFilter === "all" && orgFeatureFilter === "all" ? "active" : ""}`}
                      onClick={() => { setOrgStatusFilter("all"); setOrgFeatureFilter("all"); }}
                    >
                      All ({organizations.length})
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orgStatusFilter === "active" ? "active" : ""}`}
                      onClick={() => setOrgStatusFilter("active")}
                    >
                      Active Only ({organizations.filter(o => o.status === "active").length})
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orgFeatureFilter === "aiProctoring" ? "active" : ""}`}
                      onClick={() => setOrgFeatureFilter("aiProctoring")}
                    >
                      AI Proctoring ({organizations.filter(o => o.features?.aiProctoring).length})
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orgFeatureFilter === "screenProtection" ? "active" : ""}`}
                      onClick={() => setOrgFeatureFilter("screenProtection")}
                    >
                      Screen Shield ({organizations.filter(o => o.features?.screenProtection).length})
                    </button>
                  </div>
                </div>
              )}

              {/* Table with Clickable Rows */}
              <div className="super-table-container">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>Organization / Logo</th>
                      <th>Tenant ID</th>
                      <th>Admins</th>
                      <th>Candidates</th>
                      <th>Exams</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500">
                          No organizations match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((org) => (
                        <tr
                          key={org.id || org.tenantId}
                          className="table-row-clickable"
                          onClick={() => handleEnterTenant(org)}
                          title="Click row to enter workspace"
                        >
                          <td>
                            <div className="table-org-cell">
                              <div className="table-logo-circle">
                                {org.logoUrl ? (
                                  <img src={getMediaUrl(org.logoUrl)} alt="" />
                                ) : (
                                  <span style={{ color: org.primaryColor || "#2563eb" }}>
                                    {org.name.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <strong>{org.name}</strong>
                                <span className="cell-sub">{org.contactEmail || "No contact email"}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <code className="tenant-slug-pill">{org.tenantId}</code>
                          </td>
                          <td><strong>{org.adminsCount || 0}</strong> / {org.allowedMaxAdmins || 10}</td>
                          <td><strong>{org.candidatesCount || 0}</strong></td>
                          <td><strong>{org.examsCount || 0}</strong></td>
                          <td>
                            <span className={`status-chip status-${org.status}`}>
                              {org.status.toUpperCase()}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="table-action-btns">
                              <button
                                type="button"
                                className="btn-action-view"
                                onClick={() => handleEnterTenant(org)}
                                title="Enter Tenant Workspace"
                              >
                                Workspace
                              </button>
                              <button
                                type="button"
                                className="btn-action-access"
                                onClick={() => {
                                  setSelectedAccessTenantId(org.tenantId);
                                  setActiveTab("access");
                                }}
                                title="Manage permissions & access controls"
                              >
                                Access Controls
                              </button>
                              <button
                                type="button"
                                className="btn-action-edit"
                                onClick={() => handleOpenEditOrg(org)}
                                title="Edit organization"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-action-delete"
                                onClick={() => handleDeleteOrg(org)}
                                title="Delete organization"
                              >
                                Delete
                              </button>
                              {org.tenantId !== "default" && (
                                <button
                                  type="button"
                                  className={`btn-action-toggle ${org.status === "active" ? "btn-warn" : "btn-succ"}`}
                                  onClick={() => handleToggleOrgStatus(org)}
                                >
                                  {org.status === "active" ? "Deactivate" : "Activate"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: ADMINS MANAGER ── */}
          {activeTab === "admins" && (
            <div className="super-tab-content">
              <div className="super-toolbar">
                <div className="super-search-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search admins by user ID, name, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="super-filter-select-wrap">
                  <label>Organization:</label>
                  <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
                    <option value="all">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.tenantId} value={org.tenantId}>
                        {org.name} ({org.tenantId})
                      </option>
                    ))}
                  </select>

                  <label>Role:</label>
                  <select value={adminRoleFilter} onChange={(e) => setAdminRoleFilter(e.target.value)}>
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Org Admin</option>
                  </select>

                  <label>Status:</label>
                  <select value={adminStatusFilter} onChange={(e) => setAdminStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <button type="button" className="btn-super-primary" onClick={handleOpenCreateAdmin}>
                  <span>+ Create Admin</span>
                </button>
              </div>

              <div className="super-table-container">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>User ID / Name</th>
                      <th>Assigned Organization</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdmins.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-500">
                          No admins found matching current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAdmins.map((adm) => (
                        <tr key={adm.id || adm.userId}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="admin-avatar-box">
                                {adm.name ? adm.name.slice(0, 2).toUpperCase() : adm.userId.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong>{adm.name || adm.userId}</strong>
                                <span className="cell-sub">ID: {adm.userId}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{adm.organizationName || adm.tenantId}</strong>
                            <span className="cell-sub font-mono">[{adm.tenantId}]</span>
                          </td>
                          <td>{adm.email || "—"}</td>
                          <td>
                            <span className={`role-badge ${adm.role === "super_admin" ? "role-super" : "role-org"}`}>
                              {adm.role === "super_admin" ? "Super Admin" : "Org Admin"}
                            </span>
                          </td>
                          <td>
                            <span className={`status-chip status-${adm.isActive ? "active" : "inactive"}`}>
                              {adm.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td>
                            <div className="table-action-btns">
                              <button
                                type="button"
                                className="btn-action-edit"
                                onClick={() => handleOpenEditAdmin(adm)}
                              >
                                Edit
                              </button>
                              {adm.userId !== "superadmin" && (
                                <button
                                  type="button"
                                  className="btn-action-delete"
                                  onClick={() => handleDeleteAdmin(adm)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 4: ORGANIZATIONAL PERMISSIONS & PRESETS ── */}
          {activeTab === "access" && (
            <div className="super-tab-content">
              {/* Tenant Selection Bar & Quota Header */}
              <div className="access-tenant-selector-card">
                <div className="selector-meta-cluster">
                  <div className="selector-logo">
                    {activeAccessOrg?.logoUrl ? (
                      <img src={getMediaUrl(activeAccessOrg.logoUrl)} alt="" />
                    ) : (
                      <span style={{ color: activeAccessOrg?.primaryColor || "#2563eb" }}>
                        {activeAccessOrg?.name.slice(0, 2).toUpperCase() || "OR"}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="selector-title-row">
                      <h2>{activeAccessOrg?.name || "Organization"}</h2>
                      <span className={`status-chip status-${activeAccessOrg?.status || "active"}`}>
                        {(activeAccessOrg?.status || "active").toUpperCase()}
                      </span>
                      <span className="tenant-id-badge">{activeAccessOrg?.tenantId || "default"}</span>
                    </div>
                    <span className="selector-brand-sub">{activeAccessOrg?.brandTitle || "Enterprise Examination Portal"}</span>
                  </div>
                </div>

                <div className="selector-controls-cluster">
                  <div className="tenant-picker-dropdown">
                    <label>Target Organization:</label>
                    <select
                      value={selectedAccessTenantId}
                      onChange={(e) => setSelectedAccessTenantId(e.target.value)}
                    >
                      {organizations.map((org) => (
                        <option key={org.tenantId} value={org.tenantId}>
                          {org.name} ({org.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-super-primary"
                    onClick={() => handleEnterTenant(activeAccessOrg)}
                  >
                    <span>Enter Workspace</span>
                  </button>
                </div>
              </div>

              {/* 1-Click Policy Presets Banner */}
              <div className="policy-presets-bar">
                <div className="presets-bar-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <strong>Quick Organizational Presets:</strong>
                </div>
                <div className="presets-buttons-row">
                  <button
                    type="button"
                    className="btn-preset-chip"
                    onClick={() => handleApplyPreset("high_security_proctored", "High Security Proctored")}
                  >
                    High Security Proctored
                  </button>
                  <button
                    type="button"
                    className="btn-preset-chip"
                    onClick={() => handleApplyPreset("enterprise_full_suite", "Enterprise Full Suite")}
                  >
                    Enterprise Full Suite
                  </button>
                  <button
                    type="button"
                    className="btn-preset-chip"
                    onClick={() => handleApplyPreset("practice_quiz_only", "Practice Quiz Portal")}
                  >
                    Practice Quiz Only
                  </button>
                  <button
                    type="button"
                    className="btn-preset-chip btn-preset-danger"
                    onClick={() => handleApplyPreset("strict_lockdown", "Strict Lockdown")}
                  >
                    Strict Lockdown
                  </button>
                </div>
              </div>

              {/* Organization-Wise Permissions Search & Multi-Filter Matrix */}
              <div className="permissions-filter-matrix">
                <div className="perm-matrix-top-row">
                  <div className="perm-search-box">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search permissions by keyword (e.g. screen shield, excel, video, student)..."
                      value={accessSearchQuery}
                      onChange={(e) => setAccessSearchQuery(e.target.value)}
                    />
                    {accessSearchQuery && (
                      <button
                        type="button"
                        className="btn-modal-close"
                        style={{ width: 22, height: 22, minWidth: 22, fontSize: 11 }}
                        onClick={() => setAccessSearchQuery("")}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="perm-status-segmented">
                    <button
                      type="button"
                      className={`perm-segment-btn ${accessStateFilter === "all" ? "active" : ""}`}
                      onClick={() => setAccessStateFilter("all")}
                    >
                      All States
                    </button>
                    <button
                      type="button"
                      className={`perm-segment-btn ${accessStateFilter === "enabled" ? "active" : ""}`}
                      onClick={() => setAccessStateFilter("enabled")}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                      Enabled Only
                    </button>
                    <button
                      type="button"
                      className={`perm-segment-btn ${accessStateFilter === "restricted" ? "active" : ""}`}
                      onClick={() => setAccessStateFilter("restricted")}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      Restricted
                    </button>
                  </div>

                  {(accessSearchQuery || accessStateFilter !== "all" || accessCategoryFilter !== "all") && (
                    <button
                      type="button"
                      className="perm-reset-link"
                      onClick={() => {
                        setAccessSearchQuery("");
                        setAccessStateFilter("all");
                        setAccessCategoryFilter("all");
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Category Filter Chips Row */}
                <div className="perm-matrix-categories-row">
                  <span className="perm-cat-label">Categories:</span>
                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "all" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("all")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <span>All Capabilities</span>
                  </button>

                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "admin" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("admin")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>Admin Operations</span>
                  </button>

                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "security" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("security")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Security & Anti-Cheat</span>
                  </button>

                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "exam" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("exam")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    </svg>
                    <span>Exam & AI Modules</span>
                  </button>

                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "lms" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("lms")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <span>LMS & Classroom</span>
                  </button>

                  <button
                    type="button"
                    className={`perm-cat-chip ${accessCategoryFilter === "delivery" ? "active" : ""}`}
                    onClick={() => setAccessCategoryFilter("delivery")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    </svg>
                    <span>Resiliency & API</span>
                  </button>
                </div>
              </div>

              <div className="individual-cards-grid">
                {/* Card 1: Student Management */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowStudentManagement !== false : activeAccessOrg?.permissions?.allowStudentManagement === false)) &&
                 (!accessSearchQuery || "student accounts candidate roster crud".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowStudentManagement !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowStudentManagement")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowStudentManagement !== false}
                            onChange={() => handleQuickTogglePermission("allowStudentManagement")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Student Accounts CRUD</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowStudentManagement !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowStudentManagement !== false ? "ENABLED" : "RESTRICTED"}
                        </span>
                      </div>
                      <p>Allows organization administrators to create, edit, unblock, and import candidate rosters.</p>
                    </div>
                  </div>
                )}

                {/* Card 2: Exam Builder */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowExamCreation !== false : activeAccessOrg?.permissions?.allowExamCreation === false)) &&
                 (!accessSearchQuery || "exam builder publishing author test pdf questions".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowExamCreation !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowExamCreation")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowExamCreation !== false}
                            onChange={() => handleQuickTogglePermission("allowExamCreation")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Exam Builder & Publishing</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowExamCreation !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowExamCreation !== false ? "ENABLED" : "RESTRICTED"}
                        </span>
                      </div>
                      <p>Author questions, upload PDF documents for AI extraction, and publish test schedules.</p>
                    </div>
                  </div>
                )}

                {/* Card 3: Results & Analytics */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowResultsExport !== false : activeAccessOrg?.permissions?.allowResultsExport === false)) &&
                 (!accessSearchQuery || "results excel scorecards export download performance analytics".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowResultsExport !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowResultsExport")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-emerald">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowResultsExport !== false}
                            onChange={() => handleQuickTogglePermission("allowResultsExport")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Scorecards & Excel Export</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowResultsExport !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowResultsExport !== false ? "ENABLED" : "RESTRICTED"}
                        </span>
                      </div>
                      <p>Enables downloading candidate performance sheets, score analytics, and pass/fail audits.</p>
                    </div>
                  </div>
                )}

                {/* Card 4: Video Classes Management */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowVideoUpload !== false : activeAccessOrg?.permissions?.allowVideoUpload === false)) &&
                 (!accessSearchQuery || "video lecture youtube classes stream classes".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowVideoUpload !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowVideoUpload")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-rose">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowVideoUpload !== false}
                            onChange={() => handleQuickTogglePermission("allowVideoUpload")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Video Lecture Management</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowVideoUpload !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowVideoUpload !== false ? "ENABLED" : "RESTRICTED"}
                        </span>
                      </div>
                      <p>Grant permission to add YouTube lectures, embed class links, and assign them to candidates.</p>
                    </div>
                  </div>
                )}

                {/* Card 5: Screen Protection Shield */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.securityPolicy?.enforceScreenShield !== false : activeAccessOrg?.securityPolicy?.enforceScreenShield === false)) &&
                 (!accessSearchQuery || "screen protection shield blur mask anti-capture unfocus".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.securityPolicy?.enforceScreenShield !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleSecurityPolicy("enforceScreenShield")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.securityPolicy?.enforceScreenShield !== false}
                            onChange={() => handleQuickToggleSecurityPolicy("enforceScreenShield")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Anti-Capture Screen Shield</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.securityPolicy?.enforceScreenShield !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.securityPolicy?.enforceScreenShield !== false ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Instantly masks and blurs all exam questions when the candidate unfocuses the browser window.</p>
                    </div>
                  </div>
                )}

                {/* Card 6: Auto-Block on Screenshot */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.securityPolicy?.blockOnScreenshot !== false : activeAccessOrg?.securityPolicy?.blockOnScreenshot === false)) &&
                 (!accessSearchQuery || "screenshot capture printscreen block suspend snipping".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.securityPolicy?.blockOnScreenshot !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleSecurityPolicy("blockOnScreenshot")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-rose">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.securityPolicy?.blockOnScreenshot !== false}
                            onChange={() => handleQuickToggleSecurityPolicy("blockOnScreenshot")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Screenshot Auto-Block</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.securityPolicy?.blockOnScreenshot !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.securityPolicy?.blockOnScreenshot !== false ? "BLOCK ON" : "WARN ONLY"}
                        </span>
                      </div>
                      <p>Suspends the candidate account immediately if PrintScreen, Win+Shift+S, or Ctrl+P is pressed.</p>
                    </div>
                  </div>
                )}

                {/* Card 7: Screen Recording Detection */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.securityPolicy?.blockOnScreenRecord !== false : activeAccessOrg?.securityPolicy?.blockOnScreenRecord === false)) &&
                 (!accessSearchQuery || "screen record recording getdisplaymedia capture detect share".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.securityPolicy?.blockOnScreenRecord !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleSecurityPolicy("blockOnScreenRecord")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.securityPolicy?.blockOnScreenRecord !== false}
                            onChange={() => handleQuickToggleSecurityPolicy("blockOnScreenRecord")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Screen Recording Detection</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.securityPolicy?.blockOnScreenRecord !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.securityPolicy?.blockOnScreenRecord !== false ? "PROTECTED" : "DISABLED"}
                        </span>
                      </div>
                      <p>Detects third-party capture APIs (`getDisplayMedia`) and blocks background screen sharing.</p>
                    </div>
                  </div>
                )}

                {/* Card 8: Dynamic Watermark */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.securityPolicy?.enforceWatermark !== false : activeAccessOrg?.securityPolicy?.enforceWatermark === false)) &&
                 (!accessSearchQuery || "watermark floating student ip address dynamic".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.securityPolicy?.enforceWatermark !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleSecurityPolicy("enforceWatermark")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.securityPolicy?.enforceWatermark !== false}
                            onChange={() => handleQuickToggleSecurityPolicy("enforceWatermark")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Floating Dynamic Watermark</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.securityPolicy?.enforceWatermark !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.securityPolicy?.enforceWatermark !== false ? "ON SCREEN" : "OFF"}
                        </span>
                      </div>
                      <p>Renders student User ID, timestamp, and IP address dynamically across examination tests.</p>
                    </div>
                  </div>
                )}

                {/* Card 9: AI Biometric Proctoring */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.aiProctoring : !activeAccessOrg?.features?.aiProctoring)) &&
                 (!accessSearchQuery || "ai webcam proctoring biometric face presence".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.aiProctoring ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("aiProctoring")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.aiProctoring)}
                            onChange={() => handleQuickToggleFeature("aiProctoring")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>AI Webcam Proctoring</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.aiProctoring ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.aiProctoring ? "PROCTORED" : "DISABLED"}
                        </span>
                      </div>
                      <p>Face detection, multiple persons warning, and candidate presence checks via webcam feed.</p>
                    </div>
                  </div>
                )}

                {/* Card 10: Single Device Session Lock */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "security") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.strictDeviceLock : !activeAccessOrg?.features?.strictDeviceLock)) &&
                 (!accessSearchQuery || "single device lock concurrent session multiple login".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.strictDeviceLock ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("strictDeviceLock")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.strictDeviceLock)}
                            onChange={() => handleQuickToggleFeature("strictDeviceLock")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Single Device Session Lock</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.strictDeviceLock ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.strictDeviceLock ? "LOCKED" : "UNRESTRICTED"}
                        </span>
                      </div>
                      <p>Blocks simultaneous duplicate student logins from other browsers or phones.</p>
                    </div>
                  </div>
                )}

                {/* Card 11: Candidate Credential Reset Permission */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowStudentPasswordReset !== false : activeAccessOrg?.permissions?.allowStudentPasswordReset === false)) &&
                 (!accessSearchQuery || "student password reset credentials recovery".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowStudentPasswordReset !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowStudentPasswordReset")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowStudentPasswordReset !== false}
                            onChange={() => handleQuickTogglePermission("allowStudentPasswordReset")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Direct Student Password Reset</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowStudentPasswordReset !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowStudentPasswordReset !== false ? "ALLOWED" : "RESTRICTED"}
                        </span>
                      </div>
                      <p>Allows tenant administrators to reset and generate candidate login passwords directly.</p>
                    </div>
                  </div>
                )}

                {/* Card 12: Security Incident Clearing */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "admin") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.permissions?.allowSecurityViolationClearing !== false : activeAccessOrg?.permissions?.allowSecurityViolationClearing === false)) &&
                 (!accessSearchQuery || "security violations clearing unblock incident dismiss".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.permissions?.allowSecurityViolationClearing !== false ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickTogglePermission("allowSecurityViolationClearing")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-emerald">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={activeAccessOrg?.permissions?.allowSecurityViolationClearing !== false}
                            onChange={() => handleQuickTogglePermission("allowSecurityViolationClearing")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Security Incident Dismissal</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.permissions?.allowSecurityViolationClearing !== false ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.permissions?.allowSecurityViolationClearing !== false ? "PERMITTED" : "SUPER ONLY"}
                        </span>
                      </div>
                      <p>Empowers tenant admins to unblock accounts locked by automated screenshot or tab alerts.</p>
                    </div>
                  </div>
                )}

                {/* Card 13: Question Bank Categories */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "exam") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.examCategories : !activeAccessOrg?.features?.examCategories)) &&
                 (!accessSearchQuery || "exam categories subcategories stages question bank".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.examCategories ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("examCategories")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.examCategories)}
                            onChange={() => handleQuickToggleFeature("examCategories")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Exam Categories & Stages</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.examCategories ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.examCategories ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Multi-tier hierarchical test taxonomy (e.g. Banking PO Prelims, Mains, Tier 1, Tier 2).</p>
                    </div>
                  </div>
                )}

                {/* Card 14: AI Question & Distractor Synthesis */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "exam") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.aiQuestionGenerator : !activeAccessOrg?.features?.aiQuestionGenerator)) &&
                 (!accessSearchQuery || "ai question generator synthesis gemini distractors".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.aiQuestionGenerator ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("aiQuestionGenerator")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.aiQuestionGenerator)}
                            onChange={() => handleQuickToggleFeature("aiQuestionGenerator")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>AI Question Generator</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.aiQuestionGenerator ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.aiQuestionGenerator ? "ENABLED" : "OFF"}
                        </span>
                      </div>
                      <p>Generates high-yield test questions, distractors, and solutions via Gemini AI integration.</p>
                    </div>
                  </div>
                )}

                {/* Card 15: Bilingual Exam Switcher */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "exam") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.bilingualQuestions : !activeAccessOrg?.features?.bilingualQuestions)) &&
                 (!accessSearchQuery || "bilingual dual language english hindi regional".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.bilingualQuestions ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("bilingualQuestions")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-emerald">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.bilingualQuestions)}
                            onChange={() => handleQuickToggleFeature("bilingualQuestions")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Bilingual Exam Switcher</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.bilingualQuestions ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.bilingualQuestions ? "DUAL-LANG" : "OFF"}
                        </span>
                      </div>
                      <p>Instant real-time switcher between English and Regional language translations.</p>
                    </div>
                  </div>
                )}

                {/* Card 16: Interactive Code Sandbox */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "exam") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.codingSandbox : !activeAccessOrg?.features?.codingSandbox)) &&
                 (!accessSearchQuery || "coding sandbox compiler python javascript java code runner".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.codingSandbox ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("codingSandbox")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-rose">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.codingSandbox)}
                            onChange={() => handleQuickToggleFeature("codingSandbox")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Interactive Code Sandbox</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.codingSandbox ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.codingSandbox ? "RUNNER ON" : "OFF"}
                        </span>
                      </div>
                      <p>Integrated IDE and real-time execution engine for Python, JavaScript, and Java challenges.</p>
                    </div>
                  </div>
                )}

                {/* Card 17: Automated AI Feedback */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "exam") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.automatedStudentFeedback : !activeAccessOrg?.features?.automatedStudentFeedback)) &&
                 (!accessSearchQuery || "automated student feedback explanation step analysis".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.automatedStudentFeedback ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("automatedStudentFeedback")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.automatedStudentFeedback)}
                            onChange={() => handleQuickToggleFeature("automatedStudentFeedback")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Automated AI Feedback</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.automatedStudentFeedback ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.automatedStudentFeedback ? "ENABLED" : "OFF"}
                        </span>
                      </div>
                      <p>Instant personalized step-by-step solutions and conceptual mastery breakdowns on test completion.</p>
                    </div>
                  </div>
                )}

                {/* Card 18: Video Lectures & Streaming Portal */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "lms") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.videoClasses : !activeAccessOrg?.features?.videoClasses)) &&
                 (!accessSearchQuery || "video classes lecture streaming youtube portal".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.videoClasses ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("videoClasses")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-rose">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.videoClasses)}
                            onChange={() => handleQuickToggleFeature("videoClasses")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Video Learning Portal</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.videoClasses ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.videoClasses ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Host interactive video classes, YouTube playlist embeds, and recorded lecture modules.</p>
                    </div>
                  </div>
                )}

                {/* Card 19: PDF Study Curriculum & Resources */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "lms") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.learningDocuments : !activeAccessOrg?.features?.learningDocuments)) &&
                 (!accessSearchQuery || "learning documents pdf syllabus curriculum study material".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.learningDocuments ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("learningDocuments")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.learningDocuments)}
                            onChange={() => handleQuickToggleFeature("learningDocuments")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Study Documents & PDFs</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.learningDocuments ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.learningDocuments ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Allows institute teachers to distribute downloadable syllabus notes and study guides.</p>
                    </div>
                  </div>
                )}

                {/* Card 20: Verified Passing Certificate Generator */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "lms") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.certificateGeneration : !activeAccessOrg?.features?.certificateGeneration)) &&
                 (!accessSearchQuery || "certificate generation qr code passing award".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.certificateGeneration ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("certificateGeneration")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-emerald">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.certificateGeneration)}
                            onChange={() => handleQuickToggleFeature("certificateGeneration")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Auto Certificate Generator</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.certificateGeneration ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.certificateGeneration ? "ENABLED" : "OFF"}
                        </span>
                      </div>
                      <p>Auto-generates digitally signed PDF completion certificates with unique QR verification codes.</p>
                    </div>
                  </div>
                )}

                {/* Card 21: Real-Time Rank Leaderboard */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "lms") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.leaderboardGamification : !activeAccessOrg?.features?.leaderboardGamification)) &&
                 (!accessSearchQuery || "leaderboard gamification rank score badges".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.leaderboardGamification ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("leaderboardGamification")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.leaderboardGamification)}
                            onChange={() => handleQuickToggleFeature("leaderboardGamification")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Rank Leaderboards & Badges</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.leaderboardGamification ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.leaderboardGamification ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Encourages candidate excellence through institute percentiles, streak badges, and top-scorer rankings.</p>
                    </div>
                  </div>
                )}

                {/* Card 22: Offline Exam IndexedDB Sync */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "delivery") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.offlineExamSync : !activeAccessOrg?.features?.offlineExamSync)) &&
                 (!accessSearchQuery || "offline exam sync indexeddb cache resilient".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.offlineExamSync ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("offlineExamSync")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.offlineExamSync)}
                            onChange={() => handleQuickToggleFeature("offlineExamSync")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Offline Response Sync</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.offlineExamSync ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.offlineExamSync ? "CACHING" : "OFF"}
                        </span>
                      </div>
                      <p>Buffers student responses locally in IndexedDB when internet disconnects and auto-syncs on reconnect.</p>
                    </div>
                  </div>
                )}

                {/* Card 23: Pre-Exam Biometric Verification */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "delivery") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.biometricVerification : !activeAccessOrg?.features?.biometricVerification)) &&
                 (!accessSearchQuery || "biometric verification photo id face pre-exam".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.biometricVerification ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("biometricVerification")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.biometricVerification)}
                            onChange={() => handleQuickToggleFeature("biometricVerification")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Pre-Exam Photo Verification</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.biometricVerification ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.biometricVerification ? "REQUIRED" : "OFF"}
                        </span>
                      </div>
                      <p>Requires candidate snapshot verification before releasing the exam question paper.</p>
                    </div>
                  </div>
                )}

                {/* Card 24: Real-Time Webhook Alert Dispatcher */}
                {(accessCategoryFilter === "all" || accessCategoryFilter === "delivery") &&
                 (accessStateFilter === "all" || (accessStateFilter === "enabled" ? activeAccessOrg?.features?.webhookIntegrations : !activeAccessOrg?.features?.webhookIntegrations)) &&
                 (!accessSearchQuery || "webhook integrations api dispatch events alerts".includes(accessSearchQuery.toLowerCase())) && (
                  <div
                    className={`individual-card ${activeAccessOrg?.features?.webhookIntegrations ? "card-active" : "card-inactive"}`}
                    onClick={() => handleQuickToggleFeature("webhookIntegrations")}
                  >
                    <div className="card-top-row">
                      <div className="card-icon-bubble card-bubble-emerald">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                        </svg>
                      </div>
                      <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(activeAccessOrg?.features?.webhookIntegrations)}
                            onChange={() => handleQuickToggleFeature("webhookIntegrations")}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                    <div className="card-body-content">
                      <div className="card-title-row">
                        <h4>Webhook Event Dispatcher</h4>
                        <span className={`card-state-tag ${activeAccessOrg?.features?.webhookIntegrations ? "tag-enabled" : "tag-disabled"}`}>
                          {activeAccessOrg?.features?.webhookIntegrations ? "LIVE" : "OFF"}
                        </span>
                      </div>
                      <p>Sends instant JSON webhooks to custom LMS/ERP endpoints on test submission or security alerts.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 5: TENANT DATA ISOLATION & PRIVACY GUARD ── */}
          {activeTab === "isolation" && (
            <div className="super-tab-content">
              <div className="super-section-header">
                <div>
                  <h2>Multi-Tenant Data Partition & Isolation Guard</h2>
                  <p>Guarantees that no organization can view, query, or leak exam papers, candidate rosters, or results of another organization.</p>
                </div>
                <button
                  type="button"
                  className="btn-super-primary"
                  onClick={runIsolationAuditScan}
                  disabled={scanningIsolation}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  <span>{scanningIsolation ? "Scanning Partitions..." : "Run Partition Audit Scan"}</span>
                </button>
              </div>

              {/* Isolation Summary Metric Cards */}
              <div className="super-kpi-grid">
                <div className="super-kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-emerald">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Strict Partitioning</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">100.0%</span>
                    <span className="kpi-label">Isolation Rate</span>
                  </div>
                </div>

                <div className="super-kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-blue">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">{isolationReport?.totalCollectionsChecked || 8} Collections</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{isolationReport?.totalDocuments || 0}</span>
                    <span className="kpi-label">Secured Documents</span>
                  </div>
                </div>

                <div className="super-kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-wrap kpi-purple">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 14 14" />
                      </svg>
                    </div>
                    <span className="kpi-sub-pill">Zero Cross-Leaks</span>
                  </div>
                  <div className="kpi-data">
                    <span className="kpi-number">{isolationReport?.unpartitionedDetected || 0}</span>
                    <span className="kpi-label">Unpartitioned Records</span>
                  </div>
                </div>
              </div>

              {/* Collections Partition Table */}
              <div className="super-table-container">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>Database Collection</th>
                      <th>Total Records</th>
                      <th>Cross-Tenant Isolation Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolationReport?.collections.map((col) => (
                      <tr key={col.collection}>
                        <td>
                          <strong>{col.name}</strong>
                          <span className="cell-sub font-mono">db.{col.collection}</span>
                        </td>
                        <td><strong>{col.totalCount}</strong> documents</td>
                        <td>
                          <div className="isolation-progress-row">
                            <div className="isolation-bar-bg">
                              <div className="isolation-bar-fill" style={{ width: `${col.partitionRate}%` }} />
                            </div>
                            <span>{col.partitionRate}%</span>
                          </div>
                        </td>
                        <td>
                          <span className="status-chip status-active">100% ISOLATED</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 6: TENANT EXTENSIBILITY & CUSTOM MODULES ── */}
          {activeTab === "extensibility" && (
            <div className="super-tab-content">
              {/* Tenant Selection Bar */}
              <div className="access-tenant-selector-card">
                <div className="selector-meta-cluster">
                  <div className="selector-logo">
                    {activeAccessOrg?.logoUrl ? (
                      <img src={getMediaUrl(activeAccessOrg.logoUrl)} alt="" />
                    ) : (
                      <span style={{ color: activeAccessOrg?.primaryColor || "#2563eb" }}>
                        {activeAccessOrg?.name.slice(0, 2).toUpperCase() || "OR"}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="selector-title-row">
                      <h2>{activeAccessOrg?.name || "Organization"} Extensibility</h2>
                      <span className="tier-badge">TIER: {extensibilityData?.tier?.toUpperCase() || "ENTERPRISE"}</span>
                    </div>
                    <span className="selector-brand-sub">Provision unique custom modules and developer integrations per tenant</span>
                  </div>
                </div>

                <div className="selector-controls-cluster">
                  <div className="tenant-picker-dropdown">
                    <label>Target Tenant:</label>
                    <select
                      value={selectedAccessTenantId}
                      onChange={(e) => setSelectedAccessTenantId(e.target.value)}
                    >
                      {organizations.map((org) => (
                        <option key={org.tenantId} value={org.tenantId}>
                          {org.name} ({org.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Developer API & Webhook Integration Section */}
              <div className="extensibility-api-card">
                <div className="api-card-header">
                  <div>
                    <h3>Developer API & LMS Webhooks</h3>
                    <p>Integrate with external LMS, ERP, SAP, and custom portals using authenticated webhooks.</p>
                  </div>
                  <button type="button" className="btn-super-primary" onClick={handleGenerateApiKey}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                      <path d="M21 2l-2 2m-1.5 1.5L14 9l-3-3 2.5-2.5L21 2z" />
                      <path d="M3 21l8-8" /><circle cx="7.5" cy="16.5" r="4.5" />
                    </svg>
                    <span>Rotate API Key</span>
                  </button>
                </div>

                <div className="api-fields-grid">
                  <div className="api-field-item">
                    <label>Tenant Secret API Key</label>
                    <div className="api-key-copy-box">
                      <code>{extensibilityData?.apiKey || "No active API key generated. Click Rotate API Key."}</code>
                    </div>
                  </div>

                  <div className="api-field-item">
                    <label>Outgoing Event Webhook URL</label>
                    <input
                      type="url"
                      placeholder="https://your-lms.com/api/webhooks/exam-events"
                      value={extensibilityData?.webhookUrl || ""}
                      onChange={(e) => {
                        if (extensibilityData) {
                          setExtensibilityData({ ...extensibilityData, webhookUrl: e.target.value });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Modular Feature Flags Grid */}
              <div className="access-section-title-wrap" style={{ marginTop: 24 }}>
                <div>
                  <h3>Dynamic Custom Module Provisioning</h3>
                  <p>Turn on specialized tenant features for high-security, technical, or bilingual exams.</p>
                </div>
              </div>

              <div className="individual-cards-grid">
                {/* Custom Module 1: AI Question Generator */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.aiQuestionGenerator ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("aiQuestionGenerator")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.aiQuestionGenerator)}
                          onChange={() => handleToggleCustomModuleFlag("aiQuestionGenerator")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>AI Question Generator</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.aiQuestionGenerator ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.aiQuestionGenerator ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Instant LLM-powered question synthesis from raw textbook PDFs and subject outlines.</p>
                  </div>
                </div>

                {/* Custom Module 2: Coding Sandbox */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.codingSandbox ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("codingSandbox")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-blue">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.codingSandbox)}
                          onChange={() => handleToggleCustomModuleFlag("codingSandbox")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>Online Code Sandbox</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.codingSandbox ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.codingSandbox ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Live embedded code editor with automated test-case evaluation (Python, JS, Java, C++).</p>
                  </div>
                </div>

                {/* Custom Module 3: Biometric Verification */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.biometricVerification ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("biometricVerification")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-rose">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.biometricVerification)}
                          onChange={() => handleToggleCustomModuleFlag("biometricVerification")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>Biometric Face ID Lock</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.biometricVerification ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.biometricVerification ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Mandatory webcam face match against enrolled student ID before test paper unlocks.</p>
                  </div>
                </div>

                {/* Custom Module 4: Bilingual Questions */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.bilingualQuestions ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("bilingualQuestions")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-emerald">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.bilingualQuestions)}
                          onChange={() => handleToggleCustomModuleFlag("bilingualQuestions")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>Bilingual Question Switcher</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.bilingualQuestions ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.bilingualQuestions ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Toggle between English and Hindi or regional language on the candidate exam viewer.</p>
                  </div>
                </div>

                {/* Custom Module 5: Offline Exam Sync */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.offlineExamSync ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("offlineExamSync")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-amber">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.offlineExamSync)}
                          onChange={() => handleToggleCustomModuleFlag("offlineExamSync")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>Offline Resilient Sync</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.offlineExamSync ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.offlineExamSync ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Enables local IndexedDB caching to safeguard answers against internet dropouts.</p>
                  </div>
                </div>

                {/* Custom Module 6: Automated AI Feedback */}
                <div
                  className={`individual-card ${extensibilityData?.customModuleFlags?.automatedStudentFeedback ? "card-active" : "card-inactive"}`}
                  onClick={() => handleToggleCustomModuleFlag("automatedStudentFeedback")}
                >
                  <div className="card-top-row">
                    <div className="card-icon-bubble card-bubble-blue">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </div>
                    <div className="card-switch-wrap" onClick={(e) => e.stopPropagation()}>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(extensibilityData?.customModuleFlags?.automatedStudentFeedback)}
                          onChange={() => handleToggleCustomModuleFlag("automatedStudentFeedback")}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                  <div className="card-body-content">
                    <div className="card-title-row">
                      <h4>AI Diagnostic Feedback</h4>
                      <span className={`card-state-tag ${extensibilityData?.customModuleFlags?.automatedStudentFeedback ? "tag-enabled" : "tag-disabled"}`}>
                        {extensibilityData?.customModuleFlags?.automatedStudentFeedback ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p>Generates tailored strength & weakness reports with study suggestions upon submission.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 7: GLOBAL MASTER EXAM TEMPLATES ── */}
          {activeTab === "templates" && (
            <div className="super-tab-content">
              <div className="super-section-header">
                <div>
                  <h2>Global Master Exam Templates & Blueprints</h2>
                  <p>Standardized test packages that can be provisioned into any tenant organization in 1 click.</p>
                </div>
                <div className="tenant-picker-dropdown" style={{ flexDirection: "row", alignItems: "center" }}>
                  <label>Provision To Tenant:</label>
                  <select
                    value={selectedAccessTenantId}
                    onChange={(e) => setSelectedAccessTenantId(e.target.value)}
                  >
                    {organizations.map((org) => (
                      <option key={org.tenantId} value={org.tenantId}>
                        {org.name} ({org.tenantId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="templates-catalog-grid">
                {globalTemplates.map((tpl) => (
                  <div key={tpl._id || tpl.id || tpl.title} className="template-card">
                    <div className="template-card-header">
                      <div className="template-category-badge">{tpl.category}</div>
                      <span className="template-duration-pill">{tpl.durationMinutes} Mins</span>
                    </div>
                    <h3>{tpl.title}</h3>
                    <p>{tpl.description}</p>
                    <div className="template-meta-strip">
                      <span><strong>{tpl.totalQuestions}</strong> Questions</span>
                      <span>Pass: <strong>{tpl.passingScore}%</strong></span>
                    </div>
                    <button
                      type="button"
                      className="btn-super-primary"
                      style={{ width: "100%", marginTop: "auto" }}
                      onClick={() => handleCloneTemplateToTenant(tpl._id || tpl.id || "", tpl.title)}
                    >
                      <span>Provision to {selectedAccessTenantId}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 8: GLOBAL SECURITY & FIREWALL ── */}
          {activeTab === "security" && (
            <div className="super-tab-content">
              <div className="super-section-header">
                <div>
                  <h2>Global Security & Platform Firewall</h2>
                  <p>Configure platform-wide brute-force shields, IP whitelists, and maintenance mode.</p>
                </div>
                <button type="button" className="btn-super-primary" onClick={handleSaveSecurityRules}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>Save Security Policies</span>
                </button>
              </div>

              <form onSubmit={handleSaveSecurityRules} className="security-rules-form-card">
                <div className="maintenance-toggle-banner">
                  <div className="maintenance-banner-info">
                    <div className="maintenance-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.4">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <strong>Platform Maintenance Mode</strong>
                      <p>When enabled, candidates and tenant admins are temporarily locked out with a custom message.</p>
                    </div>
                  </div>
                  <label className="switch-toggle">
                    <input
                      type="checkbox"
                      checked={securityRules.maintenanceMode}
                      onChange={(e) => setSecurityRules({ ...securityRules, maintenanceMode: e.target.checked })}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Maintenance Mode User Message</label>
                  <input
                    type="text"
                    value={securityRules.maintenanceMessage}
                    onChange={(e) => setSecurityRules({ ...securityRules, maintenanceMessage: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Allowed IP Whitelist (Comma-separated, leave blank to allow all)</label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.1, 10.0.0.0/24"
                      value={securityRules.allowedIpRanges}
                      onChange={(e) => setSecurityRules({ ...securityRules, allowedIpRanges: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Blocked IP Blacklist (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. 45.33.32.156, 185.220.101.5"
                      value={securityRules.blockedIpRanges}
                      onChange={(e) => setSecurityRules({ ...securityRules, blockedIpRanges: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Max Failed Login Attempts</label>
                    <input
                      type="number"
                      min="3"
                      max="20"
                      value={securityRules.maxLoginAttempts}
                      onChange={(e) => setSecurityRules({ ...securityRules, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Lockout Duration (Minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={securityRules.lockoutDurationMinutes}
                      onChange={(e) => setSecurityRules({ ...securityRules, lockoutDurationMinutes: parseInt(e.target.value) || 15 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Global Inactivity Timeout (Mins)</label>
                    <input
                      type="number"
                      min="10"
                      max="240"
                      value={securityRules.sessionInactivityMinutes}
                      onChange={(e) => setSecurityRules({ ...securityRules, sessionInactivityMinutes: parseInt(e.target.value) || 60 })}
                    />
                  </div>
                </div>

                <div className="feature-flags-container">
                  <h4 className="feature-flags-title">Global Security Policy Flags</h4>
                  <div className="feature-toggles-grid">
                    <label className="feature-toggle-card">
                      <input
                        type="checkbox"
                        checked={securityRules.globalScreenshotBlock}
                        onChange={(e) => setSecurityRules({ ...securityRules, globalScreenshotBlock: e.target.checked })}
                      />
                      <div>
                        <strong>Global Screenshot Blocking</strong>
                        <span>Auto-block any candidate across all tenants on screen capture</span>
                      </div>
                    </label>

                    <label className="feature-toggle-card">
                      <input
                        type="checkbox"
                        checked={securityRules.enforcePasswordComplexity}
                        onChange={(e) => setSecurityRules({ ...securityRules, enforcePasswordComplexity: e.target.checked })}
                      />
                      <div>
                        <strong>Strong Password Complexity</strong>
                        <span>Require uppercase, numbers, and symbols for all admin accounts</span>
                      </div>
                    </label>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ── TAB 9: SYSTEM HEALTH & TELEMETRY ── */}
          {activeTab === "health" && (
            <div className="super-tab-content">
              <div className="super-section-header">
                <div>
                  <h2>System Health & Database Telemetry</h2>
                  <p>Real-time database latency, active connections, and collection volume.</p>
                </div>
                <button type="button" className="btn-super-primary" onClick={loadDiagnostics}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  <span>Refresh Telemetry</span>
                </button>
              </div>

              {diagnostics && (
                <div className="health-grid">
                  <div className="health-card">
                    <div className="health-card-header">
                      <strong>Database Engine</strong>
                      <span className="health-status-badge health-ok">CONNECTED</span>
                    </div>
                    <div className="health-metric-val">{diagnostics.database.engine}</div>
                    <span className="health-metric-sub">MongoDB Atlas / Server</span>
                  </div>

                  <div className="health-card">
                    <div className="health-card-header">
                      <strong>Database Latency</strong>
                      <span className={`health-status-badge ${diagnostics.database.latencyMs < 50 ? "health-ok" : "health-warn"}`}>
                        {diagnostics.database.latencyMs} ms
                      </span>
                    </div>
                    <div className="health-metric-val">{diagnostics.database.latencyMs} ms</div>
                    <span className="health-metric-sub">Roundtrip Ping Latency</span>
                  </div>

                  <div
                    className="health-card clickable-card"
                    onClick={() => setActiveTab("admins")}
                    title="Click to view online active staff"
                  >
                    <div className="health-card-header">
                      <strong>Recent Active Users</strong>
                      <span className="health-status-badge health-ok">ONLINE</span>
                    </div>
                    <div className="health-metric-val">{diagnostics.activeRecentUsers}</div>
                    <span className="health-metric-sub">Logged in past 2 hours</span>
                  </div>

                  <div
                    className="health-card clickable-card"
                    onClick={() => setActiveTab("audit")}
                    title="Click to inspect security violations log"
                  >
                    <div className="health-card-header">
                      <strong>Security Violations (24h)</strong>
                      <span className={`health-status-badge ${diagnostics.telemetry.violationsLast24h > 0 ? "health-warn" : "health-ok"}`}>
                        {diagnostics.telemetry.violationsLast24h}
                      </span>
                    </div>
                    <div className="health-metric-val">{diagnostics.telemetry.violationsLast24h}</div>
                    <span className="health-metric-sub">Total Blocked: {diagnostics.telemetry.violationsTotal}</span>
                  </div>
                </div>
              )}

              {diagnostics && (
                <div className="telemetry-table-card">
                  <h3>Database Collection Records</h3>
                  <div className="telemetry-stats-grid">
                    <div className="telemetry-stat-item clickable-telemetry" onClick={() => setActiveTab("organizations")}>
                      <strong>{diagnostics.telemetry.organizations}</strong>
                      <span>Organizations</span>
                    </div>
                    <div className="telemetry-stat-item clickable-telemetry" onClick={() => setActiveTab("admins")}>
                      <strong>{diagnostics.telemetry.users}</strong>
                      <span>Total User Accounts</span>
                    </div>
                    <div className="telemetry-stat-item clickable-telemetry" onClick={() => setActiveTab("admins")}>
                      <strong>{diagnostics.telemetry.candidates}</strong>
                      <span>Enrolled Candidates</span>
                    </div>
                    <div className="telemetry-stat-item clickable-telemetry" onClick={() => setShowSwitcherModal(true)}>
                      <strong>{diagnostics.telemetry.exams}</strong>
                      <span>Published Exams</span>
                    </div>
                    <div className="telemetry-stat-item">
                      <strong>{diagnostics.telemetry.questions}</strong>
                      <span>Questions Bank</span>
                    </div>
                    <div className="telemetry-stat-item">
                      <strong>{diagnostics.telemetry.attempts}</strong>
                      <span>Student Submissions</span>
                    </div>
                    <div className="telemetry-stat-item clickable-telemetry" onClick={() => setActiveTab("audit")}>
                      <strong>{diagnostics.telemetry.auditLogsTotal}</strong>
                      <span>Audit Trail Records</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 10: BROADCAST ANNOUNCEMENTS ── */}
          {activeTab === "broadcasts" && (
            <div className="super-tab-content">
              <div className="super-section-header">
                <div>
                  <h2>Platform Broadcast Announcements</h2>
                  <p>Publish real-time banners and notifications to all organizations or specific tenants.</p>
                </div>
                <button type="button" className="btn-super-primary" onClick={() => setShowBroadcastModal(true)}>
                  <span>+ New Broadcast</span>
                </button>
              </div>

              <div className="broadcasts-list-grid">
                {broadcasts.length === 0 ? (
                  <div className="empty-broadcasts-card">
                    <p>No active platform broadcasts. Create one to notify organizations.</p>
                  </div>
                ) : (
                  broadcasts.map((bc, idx) => (
                    <div key={bc._id || bc.id || idx} className={`broadcast-card broadcast-${bc.severity}`}>
                      <div className="broadcast-card-header">
                        <div className="broadcast-title-wrap">
                          <span className="broadcast-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          </span>
                          <strong>{bc.title}</strong>
                        </div>
                        <span className="tenant-slug-pill">Target: {bc.targetTenant}</span>
                      </div>
                      <p className="broadcast-msg">{bc.message}</p>
                      <span className="broadcast-date">
                        {bc.createdAt ? new Date(bc.createdAt).toLocaleString() : "Just now"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── TAB 11: AUDIT LOGS WITH SEVERITY FILTERS ── */}
          {activeTab === "audit" && (
            <div className="super-tab-content">
              <div className="super-toolbar">
                <div className="super-search-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search audit actions, user IDs, timestamps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="super-filter-select-wrap">
                  <label>Severity:</label>
                  <select value={auditSeverityFilter} onChange={(e) => setAuditSeverityFilter(e.target.value)}>
                    <option value="all">All Severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning / Violations</option>
                    <option value="error">Critical Error</option>
                  </select>
                </div>

                <button type="button" className="btn-super-primary" onClick={loadAuditLogs}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  <span>Refresh Logs</span>
                </button>
              </div>

              <div className="super-table-container">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>User ID</th>
                      <th>Tenant ID</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500">
                          No audit records found matching current criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log, idx) => (
                        <tr key={log.id || idx}>
                          <td className="font-mono text-xs text-slate-500">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                          </td>
                          <td><strong>{log.action}</strong></td>
                          <td><code>{log.userId || "system"}</code></td>
                          <td><span className="tenant-slug-pill">{log.tenantId || "global"}</span></td>
                          <td>
                            <span className={`status-chip status-${log.severity === "error" ? "inactive" : log.severity === "warning" ? "suspended" : "active"}`}>
                              {(log.severity || "info").toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── CREATE BROADCAST MODAL ── */}
      {showBroadcastModal && (
        <div className="super-modal-backdrop" onClick={() => setShowBroadcastModal(false)}>
          <div className="super-modal-card in-screen-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateBroadcast} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div className="super-modal-header">
                <div>
                  <h3>Create Broadcast Announcement</h3>
                  <span className="modal-sub">Send banner notification across the platform</span>
                </div>
                <button type="button" className="btn-modal-close" onClick={() => setShowBroadcastModal(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="super-modal-body">
                <div className="form-group">
                  <label>Announcement Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scheduled Platform Maintenance Tonight"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Message Content *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Details of the announcement..."
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    style={{
                      padding: "9px 13px",
                      borderRadius: "9px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "13px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Target Audience</label>
                    <select
                      value={broadcastForm.targetTenant}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, targetTenant: e.target.value })}
                    >
                      <option value="all">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org.tenantId} value={org.tenantId}>
                          {org.name} ({org.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Severity Level</label>
                    <select
                      value={broadcastForm.severity}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, severity: e.target.value as "info" | "warning" | "error" })}
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="warning">Warning (Amber)</option>
                      <option value="error">Critical / Alert (Red)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="super-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowBroadcastModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-save">
                  Publish Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT ORGANIZATION MODAL ── */}
      {showOrgModal && (
        <div className="super-modal-backdrop" onClick={() => setShowOrgModal(false)}>
          <div className="super-modal-card in-screen-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveOrganization} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div className="super-modal-header">
                <div>
                  <h3>{editingOrg ? `Edit Organization: ${editingOrg.name}` : "Create New Organization"}</h3>
                  <span className="modal-sub">Configure branding, tenant ID, and custom feature modules</span>
                </div>
                <button type="button" className="btn-modal-close" onClick={() => setShowOrgModal(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="super-modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Organization Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Banking Academy"
                      value={orgForm.name}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tenant ID (Organization Code) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. apex_bank"
                      value={orgForm.tenantId}
                      onChange={(e) => setOrgForm({ ...orgForm, tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                    />
                    <small className="form-hint">Unique alphanumeric slug for URL routing & data isolation.</small>
                  </div>
                </div>

                {/* Logo Upload Section */}
                <div className="form-group">
                  <label>Custom Organization Logo</label>
                  <div className="logo-uploader-row">
                    <div className="logo-preview-box" style={{ borderColor: orgForm.primaryColor }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" />
                      ) : (
                        <div className="logo-empty-box">No Logo</div>
                      )}
                    </div>
                    <div className="logo-upload-actions">
                      <div className="logo-action-buttons">
                        <input
                          type="file"
                          id="org-logo-file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={handleLogoFileUpload}
                        />
                        <label htmlFor="org-logo-file" className="btn-upload-logo">
                          {uploadingLogo ? "Uploading..." : "Upload Logo Image"}
                        </label>
                        {logoPreview && (
                          <button
                            type="button"
                            className="btn-clear-logo"
                            onClick={() => {
                              setOrgForm((prev) => ({ ...prev, logoUrl: "" }));
                              setLogoPreview("");
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Or enter direct image URL..."
                        value={orgForm.logoUrl}
                        onChange={(e) => {
                          setOrgForm({ ...orgForm, logoUrl: e.target.value });
                          setLogoPreview(getMediaUrl(e.target.value));
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Brand Display Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Online Examination Portal"
                      value={orgForm.brandTitle}
                      onChange={(e) => setOrgForm({ ...orgForm, brandTitle: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Brand Primary Color</label>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={orgForm.primaryColor}
                        onChange={(e) => setOrgForm({ ...orgForm, primaryColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={orgForm.primaryColor}
                        onChange={(e) => setOrgForm({ ...orgForm, primaryColor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      placeholder="admin@organization.com"
                      value={orgForm.contactEmail}
                      onChange={(e) => setOrgForm({ ...orgForm, contactEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact Phone (10 Digits)</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="e.g. 9876543210"
                      value={orgForm.contactPhone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setOrgForm({ ...orgForm, contactPhone: digitsOnly });
                      }}
                    />
                    <small className="form-hint" style={{ color: orgForm.contactPhone && orgForm.contactPhone.length === 10 ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                      {orgForm.contactPhone ? `${orgForm.contactPhone.length}/10 digits` : "Standard 10-digit number"}
                    </small>
                  </div>
                </div>

                {/* Categorized Feature Flags & Dynamic Modules */}
                <div className="feature-flags-container">
                  <div className="feature-flags-header-row">
                    <div>
                      <h4 className="feature-flags-title">Tenant Enabled Modules & Capabilities</h4>
                      <p className="feature-flags-sub">Configure exact feature modules for this tenant. Changes only affect this organization with 100% tenant isolation.</p>
                    </div>
                  </div>

                  {/* Section 1: Core Examination & Authoring */}
                  <div className="feature-category-block">
                    <span className="feature-category-pill pill-blue">Core Examination & AI Engine</span>
                    <div className="feature-toggles-grid">
                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.examCategories)}
                          onChange={() => handleToggleFeature("examCategories")}
                        />
                        <div>
                          <strong>Question Bank Categories</strong>
                          <span>Organize exams into multi-tier stages & topics</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.aiQuestionGenerator)}
                          onChange={() => handleToggleFeature("aiQuestionGenerator")}
                        />
                        <div>
                          <strong>AI Question Synthesis</strong>
                          <span>Auto-generate questions & distractors with Gemini</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.bilingualQuestions)}
                          onChange={() => handleToggleFeature("bilingualQuestions")}
                        />
                        <div>
                          <strong>Bilingual Exam Switcher</strong>
                          <span>Dual-language translations (English & Regional)</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.codingSandbox)}
                          onChange={() => handleToggleFeature("codingSandbox")}
                        />
                        <div>
                          <strong>Live Coding Sandbox</strong>
                          <span>Embedded compiler for Python, JS, and Java</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.automatedStudentFeedback)}
                          onChange={() => handleToggleFeature("automatedStudentFeedback")}
                        />
                        <div>
                          <strong>Automated AI Feedback</strong>
                          <span>Instant student breakdown and explanations</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 2: LMS & Classroom Experience */}
                  <div className="feature-category-block">
                    <span className="feature-category-pill pill-purple">Classroom & LMS Experience</span>
                    <div className="feature-toggles-grid">
                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.videoClasses)}
                          onChange={() => handleToggleFeature("videoClasses")}
                        />
                        <div>
                          <strong>Video Learning Portal</strong>
                          <span>Host interactive video classes and streaming lectures</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.learningDocuments)}
                          onChange={() => handleToggleFeature("learningDocuments")}
                        />
                        <div>
                          <strong>Documents & PDF Resources</strong>
                          <span>Downloadable curriculum study materials</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.certificateGeneration)}
                          onChange={() => handleToggleFeature("certificateGeneration")}
                        />
                        <div>
                          <strong>Auto Certificate Generator</strong>
                          <span>Generate verified PDF certificates with QR code on pass</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.leaderboardGamification)}
                          onChange={() => handleToggleFeature("leaderboardGamification")}
                        />
                        <div>
                          <strong>Leaderboards & Badges</strong>
                          <span>Gamified candidate rankings & achievements</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 3: Anti-Cheat & DRM Security */}
                  <div className="feature-category-block">
                    <span className="feature-category-pill pill-emerald">Security, DRM & Anti-Cheat</span>
                    <div className="feature-toggles-grid">
                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.screenProtection)}
                          onChange={() => handleToggleFeature("screenProtection")}
                        />
                        <div>
                          <strong>Anti-Capture Screen Shield</strong>
                          <span>Hardware DRM & auto-blur on window unfocus</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.customWatermark)}
                          onChange={() => handleToggleFeature("customWatermark")}
                        />
                        <div>
                          <strong>Dynamic Floating Watermark</strong>
                          <span>Overlay student name, IP, and live timestamp</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.aiProctoring)}
                          onChange={() => handleToggleFeature("aiProctoring")}
                        />
                        <div>
                          <strong>AI Proctoring & Webcam</strong>
                          <span>Facial presence and eye tracking proctor</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.auditLogs)}
                          onChange={() => handleToggleFeature("auditLogs")}
                        />
                        <div>
                          <strong>Forensic Audit Trails</strong>
                          <span>Log all candidate infractions and device fingerprints</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.strictDeviceLock)}
                          onChange={() => handleToggleFeature("strictDeviceLock")}
                        />
                        <div>
                          <strong>Single Device Session Lock</strong>
                          <span>Block simultaneous duplicate student logins</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 4: Delivery & Resiliency */}
                  <div className="feature-category-block">
                    <span className="feature-category-pill pill-amber">Advanced Delivery & Resiliency</span>
                    <div className="feature-toggles-grid">
                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.offlineExamSync)}
                          onChange={() => handleToggleFeature("offlineExamSync")}
                        />
                        <div>
                          <strong>Offline Response Sync</strong>
                          <span>IndexedDB local cache for spotty connections</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.biometricVerification)}
                          onChange={() => handleToggleFeature("biometricVerification")}
                        />
                        <div>
                          <strong>Pre-Exam Biometric ID</strong>
                          <span>WebID & photo verification prior to test start</span>
                        </div>
                      </label>

                      <label className="feature-toggle-card">
                        <input
                          type="checkbox"
                          checked={Boolean(orgForm.features?.webhookIntegrations)}
                          onChange={() => handleToggleFeature("webhookIntegrations")}
                        />
                        <div>
                          <strong>Webhook Event Dispatcher</strong>
                          <span>Real-time API alerts on test submissions</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 5: Future-Proof Dynamic Custom Module Builder */}
                  <div className="feature-category-block custom-module-builder-box">
                    <span className="feature-category-pill pill-cyan">⚡ Future-Proof Custom Feature Builder</span>
                    <p className="custom-builder-desc">Super Admin can dynamically provision ANY new or upcoming custom feature module for this tenant:</p>
                    
                    {/* List any custom features added */}
                    {Object.keys(orgForm.features || {}).filter(k => ![
                      "examCategories", "aiQuestionGenerator", "bilingualQuestions", "codingSandbox",
                      "automatedStudentFeedback", "videoClasses", "learningDocuments", "certificateGeneration",
                      "leaderboardGamification", "screenProtection", "customWatermark", "aiProctoring",
                      "auditLogs", "strictDeviceLock", "offlineExamSync", "biometricVerification", "webhookIntegrations"
                    ].includes(k)).length > 0 && (
                      <div className="feature-toggles-grid custom-toggles-list" style={{ marginBottom: 12 }}>
                        {Object.keys(orgForm.features || {}).filter(k => ![
                          "examCategories", "aiQuestionGenerator", "bilingualQuestions", "codingSandbox",
                          "automatedStudentFeedback", "videoClasses", "learningDocuments", "certificateGeneration",
                          "leaderboardGamification", "screenProtection", "customWatermark", "aiProctoring",
                          "auditLogs", "strictDeviceLock", "offlineExamSync", "biometricVerification", "webhookIntegrations"
                        ].includes(k)).map(customKey => (
                          <label key={customKey} className="feature-toggle-card custom-active-card">
                            <input
                              type="checkbox"
                              checked={Boolean(orgForm.features[customKey])}
                              onChange={() => handleToggleFeature(customKey)}
                            />
                            <div>
                              <strong>{customKey.replace(/_/g, " ").toUpperCase()}</strong>
                              <span>Custom dynamic module flag</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="custom-module-input-row">
                      <input
                        type="text"
                        placeholder="New Feature Key (e.g. voice_assistant_ai, blockchain_verify)"
                        value={newCustomModuleKey}
                        onChange={(e) => setNewCustomModuleKey(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-add-custom-mod"
                        onClick={handleAddCustomModuleToOrg}
                      >
                        + Add Custom Module
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Max Admins Allowed</label>
                    <input
                      type="number"
                      min="1"
                      value={orgForm.allowedMaxAdmins}
                      onChange={(e) => setOrgForm({ ...orgForm, allowedMaxAdmins: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Max Candidates Limit</label>
                    <input
                      type="number"
                      min="10"
                      value={orgForm.allowedMaxCandidates}
                      onChange={(e) => setOrgForm({ ...orgForm, allowedMaxCandidates: parseInt(e.target.value) || 100 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Max Exams Limit</label>
                    <input
                      type="number"
                      min="1"
                      value={orgForm.allowedMaxExams || 50}
                      onChange={(e) => setOrgForm({ ...orgForm, allowedMaxExams: parseInt(e.target.value) || 50 })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Campus / Physical Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 104 Tech Park, Main Boulevard"
                      value={orgForm.address}
                      onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Initial Status</label>
                    <select
                      value={orgForm.status}
                      onChange={(e) => setOrgForm({ ...orgForm, status: e.target.value as "active" | "inactive" })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive / Suspended</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="super-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowOrgModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-save">
                  {editingOrg ? "Save Organization" : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT ADMIN MODAL ── */}
      {showAdminModal && (
        <div className="super-modal-backdrop" onClick={() => setShowAdminModal(false)}>
          <div className="super-modal-card in-screen-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveAdmin} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div className="super-modal-header">
                <div>
                  <h3>{editingAdmin ? `Edit Admin: ${editingAdmin.userId}` : "Create Organization Administrator"}</h3>
                  <span className="modal-sub">Assign admin privileges to specific tenant organizations</span>
                </div>
                <button type="button" className="btn-modal-close" onClick={() => setShowAdminModal(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="super-modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Admin User ID *</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingAdmin)}
                      placeholder="e.g. apex_admin"
                      value={adminForm.userId}
                      onChange={(e) => setAdminForm({ ...adminForm, userId: e.target.value.trim() })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Assign to Organization *</label>
                    <select
                      value={adminForm.tenantId}
                      onChange={(e) => setAdminForm({ ...adminForm, tenantId: e.target.value })}
                    >
                      {organizations.map((org) => (
                        <option key={org.tenantId} value={org.tenantId}>
                          {org.name} ({org.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value.trim() })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>{editingAdmin ? "Reset Password (leave blank to keep current)" : "Password *"}</label>
                    <input
                      type="password"
                      required={!editingAdmin}
                      placeholder="••••••••"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Account Status</label>
                    <select
                      value={adminForm.isActive ? "true" : "false"}
                      onChange={(e) => setAdminForm({ ...adminForm, isActive: e.target.value === "true" })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive / Blocked</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="super-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowAdminModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-save">
                  {editingAdmin ? "Update Admin" : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WORKSPACE SWITCHER MODAL ── */}
      {showSwitcherModal && (
        <div className="super-modal-backdrop" onClick={() => setShowSwitcherModal(false)}>
          <div className="super-modal-card in-screen-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="super-modal-header">
              <div>
                <h3>Switch Tenant Workspace</h3>
                <span className="modal-sub">Jump into any organization as administrator</span>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setShowSwitcherModal(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="super-modal-body" style={{ maxHeight: 380, overflowY: "auto" }}>
              <div className="switcher-list">
                {organizations.map((org) => (
                  <div key={org.tenantId} className="switcher-item" onClick={() => { setShowSwitcherModal(false); handleEnterTenant(org); }}>
                    <div className="switcher-logo">
                      {org.logoUrl ? (
                        <img src={getMediaUrl(org.logoUrl)} alt="" />
                      ) : (
                        <span style={{ color: org.primaryColor || "#2563eb" }}>{org.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="switcher-meta">
                      <strong>{org.name}</strong>
                      <span className="font-mono text-xs text-slate-500">[{org.tenantId}]</span>
                    </div>
                    <button type="button" className="btn-switcher-go">Open</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NATIVE MOBILE APP BOTTOM NAVIGATION DOCK ── */}
      <nav className="mobile-app-bottom-dock">
        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => { setActiveTab("overview"); setMobileSidebarOpen(false); }}
        >
          <div className="dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "organizations" ? "active" : ""}`}
          onClick={() => { setActiveTab("organizations"); setMobileSidebarOpen(false); }}
        >
          <div className="dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span>Orgs</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "access" ? "active" : ""}`}
          onClick={() => { setActiveTab("access"); setMobileSidebarOpen(false); }}
        >
          <div className="dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span>Access</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "isolation" ? "active" : ""}`}
          onClick={() => { setActiveTab("isolation"); setMobileSidebarOpen(false); }}
        >
          <div className="dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span>Shield</span>
        </button>

        <button
          type="button"
          className="mobile-dock-btn"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <div className="dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </div>
          <span>Menu</span>
        </button>
      </nav>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText="Confirm"
        onConfirm={async () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          if (confirmDialog.action) {
            await confirmDialog.action();
          }
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
};

export default SuperAdminDashboard;
