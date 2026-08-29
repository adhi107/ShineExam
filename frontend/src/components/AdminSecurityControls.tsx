import React, { useEffect, useState } from "react";
import { apiGet, apiPut, apiPost } from "../services/api";
import "./AdminSecurityControls.css";

interface RetentionPolicy {
  autoPurgeEnabled: boolean;
  auditLogsRetentionDays: number;
  violationsRetentionDays: number;
  examResultsRetentionDays: number;
  sessionsRetentionHours: number;
  tempDocumentsRetentionDays: number;
  lastPurgeAt?: string | null;
  lastPurgeStats?: Record<string, number> | null;
}

interface SecuritySettings {
  autoLogoutEnabled: boolean;
  autoLogoutMinutes: number;
  strictScreenshotLock: boolean;
  screenshotAllowedAttempts: number;
  screenshotProtectedModules: string[];
  watermarkEnabled: boolean;
  watermarkIntervalSec: number;
  allowCandidateDocumentView: boolean;
  allowCandidateDocumentDownload: boolean;
  watermarkDocuments: boolean;
  retentionPolicy: RetentionPolicy;
  updatedAt?: string;
  updatedBy?: string;
}

const availableModules = [
  {
    id: "exam",
    label: "Active Exam Interface",
    badge: "High Risk",
    badgeType: "critical",
    description: "Protects question papers, options, and countdown clock from snipping or screenshots.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    ),
  },
  {
    id: "results",
    label: "Exam Results & Analytics",
    badge: "Score Protection",
    badgeType: "info",
    description: "Prevents screen captures on candidate scorecards, answer keys, and performance breakdown.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: "documents",
    label: "Study Materials & DRM",
    badge: "IP Protection",
    badgeType: "warning",
    description: "Applies screen block to assigned study notes, PDFs, guides, and reference documents.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    id: "classes",
    label: "Video Classes & Lectures",
    badge: "Video DRM",
    badgeType: "critical",
    description: "Enforces anti-capture screen lock and anti-recording guards across in-screen video player and lectures.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Student Portal & Dashboard",
    badge: "General Portal",
    badgeType: "neutral",
    description: "Enforces anti-capture screen lock across candidate overview, notifications, and menus.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
];

const AdminSecurityControls: React.FC = () => {
  const [settings, setSettings] = useState<SecuritySettings>({
    autoLogoutEnabled: true,
    autoLogoutMinutes: 15,
    strictScreenshotLock: true,
    screenshotAllowedAttempts: 1,
    screenshotProtectedModules: ["exam", "results", "documents", "classes"],
    watermarkEnabled: true,
    watermarkIntervalSec: 8,
    allowCandidateDocumentView: true,
    allowCandidateDocumentDownload: false,
    watermarkDocuments: true,
    retentionPolicy: {
      autoPurgeEnabled: false,
      auditLogsRetentionDays: 30,
      violationsRetentionDays: 60,
      examResultsRetentionDays: 180,
      sessionsRetentionHours: 48,
      tempDocumentsRetentionDays: 30,
      lastPurgeAt: null,
      lastPurgeStats: null,
    },
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  // Wipeout Execution State
  const [showWipeoutModal, setShowWipeoutModal] = useState<boolean>(false);
  const [wiping, setWiping] = useState<boolean>(false);
  const [selectedWipeModules, setSelectedWipeModules] = useState<string[]>([
    "audit_logs",
    "violations",
    "sessions",
    "temp_docs",
  ]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ settings: SecuritySettings }>("/admin/security-settings");
      if (res.settings) {
        setSettings({
          ...res.settings,
          screenshotProtectedModules: res.settings.screenshotProtectedModules || ["exam", "results", "documents", "classes"],
          retentionPolicy: {
            autoPurgeEnabled: Boolean(res.settings.retentionPolicy?.autoPurgeEnabled),
            auditLogsRetentionDays: res.settings.retentionPolicy?.auditLogsRetentionDays ?? 30,
            violationsRetentionDays: res.settings.retentionPolicy?.violationsRetentionDays ?? 60,
            examResultsRetentionDays: res.settings.retentionPolicy?.examResultsRetentionDays ?? 180,
            sessionsRetentionHours: res.settings.retentionPolicy?.sessionsRetentionHours ?? 48,
            tempDocumentsRetentionDays: res.settings.retentionPolicy?.tempDocumentsRetentionDays ?? 30,
            lastPurgeAt: res.settings.retentionPolicy?.lastPurgeAt || null,
            lastPurgeStats: res.settings.retentionPolicy?.lastPurgeStats || null,
          },
        });
      }
    } catch (err) {
      console.error("Failed to load security settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPut<{ message: string; settings: SecuritySettings }>("/admin/security-settings", settings);
      if (res.settings) setSettings(res.settings);
      showToast("Security, Module & Data Retention policies deployed successfully.");
    } catch (err: any) {
      alert(err?.message || "Failed to save security settings.");
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const toggleModule = (moduleId: string) => {
    setSettings((prev) => {
      const current = prev.screenshotProtectedModules || ["exam", "results", "documents", "classes"];
      const exists = current.includes(moduleId);
      let updated: string[];
      if (exists) {
        if (current.length === 1) return prev;
        updated = current.filter((id) => id !== moduleId);
      } else {
        updated = [...current, moduleId];
      }
      return { ...prev, screenshotProtectedModules: updated };
    });
  };

  const toggleWipeModuleSelection = (key: string) => {
    setSelectedWipeModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const executeWipeout = async () => {
    if (selectedWipeModules.length === 0) {
      alert("Please select at least one data module to wipe.");
      return;
    }
    setWiping(true);
    try {
      const res = await apiPost<{ message: string; stats: Record<string, number>; totalPurged: number; timestamp: string }>(
        "/admin/security-settings/wipeout",
        { modules: selectedWipeModules }
      );
      setShowWipeoutModal(false);
      showToast(`Data wipeout complete: ${res.totalPurged} expired records purged.`);
      loadSettings();
    } catch (err: any) {
      alert(err?.message || "Failed to execute data wipeout.");
    } finally {
      setWiping(false);
    }
  };

  const presetTimes = [5, 10, 15, 30, 60];
  const attemptOptions = [
    { value: 1, label: "1 Attempt", sub: "Instant permanent block" },
    { value: 2, label: "2 Attempts", sub: "1 warning, then block" },
    { value: 3, label: "3 Attempts", sub: "2 warnings, then block" },
    { value: 5, label: "5 Attempts", sub: "4 warnings, then block" },
    { value: 10, label: "10 Attempts", sub: "9 warnings, then block" },
  ];

  const protectedModules = settings.screenshotProtectedModules || ["exam", "results", "documents"];
  const retention = settings.retentionPolicy;

  return (
    <div className="security-controls-container">
      {/* Top Header */}
      <header className="controls-header">
        <div>
          <span className="section-eyebrow">SYSTEM SECURITY &amp; PROCTORING</span>
          <h1>Admin Security Controls</h1>
          <p>Configure candidate session timeouts, anti-cheat proctoring policies, document access, and module-wise data wipeout timelines.</p>
        </div>
        <div className="controls-header-badge">
          <span className="shield-pulse-dot" />
          <span>Firewall Active (MongoDB Gate)</span>
        </div>
      </header>

      {toastMessage && (
        <div className="controls-toast-banner">
          <span>&#10003; {toastMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="controls-loading-state">
          <div className="spinner" />
          <p>Loading security configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="controls-form-layout">
          <div className="controls-grid-2col">

            {/* Card 1: Session Inactivity Auto-Logout */}
            <div className={`sec-card ${settings.autoLogoutEnabled ? "card-active" : "card-disabled"}`}>
              <div className="sec-card-header">
                <div className="sec-icon-box timer-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="sec-header-meta">
                  <h3>Session Inactivity Auto-Logout</h3>
                  <p>Terminate candidate portal sessions upon extended idle period.</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoLogoutEnabled}
                    onChange={(e) => setSettings({ ...settings, autoLogoutEnabled: e.target.checked })}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="sec-card-body">
                <div className="sec-status-row">
                  <span className="sec-status-pill enabled">
                    {settings.autoLogoutEnabled ? "● Inactivity Tracker Enabled" : "○ Auto-Logout Inactive"}
                  </span>
                  <span className="sec-status-detail">
                    {settings.autoLogoutEnabled
                      ? `Logs out after ${settings.autoLogoutMinutes} mins idle`
                      : "Sessions stay active indefinitely"}
                  </span>
                </div>

                {settings.autoLogoutEnabled && (
                  <div className="sec-config-section">
                    <label className="sec-field-label">Choose Inactivity Duration</label>
                    <div className="preset-pills-row">
                      {presetTimes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`preset-pill-btn ${settings.autoLogoutMinutes === m ? "selected" : ""}`}
                          onClick={() => setSettings({ ...settings, autoLogoutMinutes: m })}
                        >
                          {m} mins
                          {m === 15 && <span className="rec-tag">Rec</span>}
                        </button>
                      ))}
                    </div>
                    <p className="sec-info-text">
                      Candidate keyboard, mouse movement, touch, and scroll events are monitored. If no activity is detected for <strong>{settings.autoLogoutMinutes} minutes</strong>, the session expires automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Screenshot & Anti-Capture Policy */}
            <div className={`sec-card ${settings.strictScreenshotLock ? "card-active" : "card-disabled"}`}>
              <div className="sec-card-header">
                <div className="sec-icon-box shield-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="sec-header-meta">
                  <h3>Screenshot &amp; Recording Enforcement</h3>
                  <p>Anti-capture lockout policy triggered on candidate capture attempts.</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={settings.strictScreenshotLock}
                    onChange={(e) => setSettings({ ...settings, strictScreenshotLock: e.target.checked })}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="sec-card-body">
                <div className="sec-status-row">
                  <span className={`sec-status-pill ${settings.strictScreenshotLock ? "danger" : "warning"}`}>
                    {settings.strictScreenshotLock ? "● Strict Lock Mode Active" : "○ Warning Mode"}
                  </span>
                </div>

                <div className="policy-highlights">
                  <div className="policy-item">
                    <span className="policy-check">&#10003;</span>
                    <span><strong>PrtScn / Alt+PrtScn:</strong> Overwrites clipboard &amp; blacks out frame</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">&#10003;</span>
                    <span><strong>Win+Shift+S / Snipping:</strong> Instant window blur trigger</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">&#10003;</span>
                    <span><strong>MongoDB Action:</strong> <code>user.isActive = False</code> &amp; terminates exam</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">&#10003;</span>
                    <span><strong>Unblock Requirement:</strong> Admin Dashboard only</span>
                  </div>
                </div>

                {/* Screenshot Attempt Threshold */}
                {settings.strictScreenshotLock && (
                  <div className="sec-config-section sec-attempt-threshold">
                    <label className="sec-field-label">Screenshot Attempt Threshold Before Account Block</label>
                    <p className="sec-info-text" style={{ marginBottom: "12px" }}>
                      Configure how many capture attempts a candidate is allowed before their account is permanently blocked.
                      Set to <strong>1 Attempt</strong> for instant blocking (strictest) or allow a grace period.
                    </p>
                    <div className="attempt-threshold-grid">
                      {attemptOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`attempt-threshold-btn ${settings.screenshotAllowedAttempts === opt.value ? "selected" : ""}`}
                          onClick={() => setSettings({ ...settings, screenshotAllowedAttempts: opt.value })}
                        >
                          <strong>{opt.label}</strong>
                          <span>{opt.sub}</span>
                          {opt.value === 1 && <span className="rec-tag">Strictest</span>}
                        </button>
                      ))}
                    </div>
                    <div className="attempt-threshold-summary">
                      {settings.screenshotAllowedAttempts === 1 ? (
                        <span className="threshold-status-strict">
                          <strong>Instant Block:</strong> Any screenshot attempt permanently blocks the account immediately.
                        </span>
                      ) : (
                        <span className="threshold-status-warning">
                          <strong>Grace Mode:</strong> Candidates receive {settings.screenshotAllowedAttempts - 1} warning(s) before permanent block on attempt {settings.screenshotAllowedAttempts}.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Protected Modules Selection Feature */}
                <div className="sec-config-section sec-modules-section">
                  <div className="sec-modules-header">
                    <div>
                      <label className="sec-field-label">Select Protected Application Modules</label>
                      <p className="sec-info-text">
                        Choose exactly which student portal modules enforce screenshot blocking and anti-recording guards.
                      </p>
                    </div>
                    <span className="sec-module-count-badge">
                      {protectedModules.length} of {availableModules.length} Active
                    </span>
                  </div>

                  <div className="modules-selection-compact-list">
                    {availableModules.map((mod) => {
                      const isSelected = protectedModules.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          className={`mod-compact-card ${isSelected ? "mod-selected" : "mod-unselected"}`}
                          onClick={() => toggleModule(mod.id)}
                        >
                          <div className="mod-compact-left">
                            <div className="mod-compact-icon">
                              {mod.icon}
                            </div>
                            <div className="mod-compact-text">
                              <div className="mod-compact-title-line">
                                <strong>{mod.label}</strong>
                                <span className={`mod-compact-badge badge-${mod.badgeType}`}>
                                  {mod.badge}
                                </span>
                              </div>
                              <p>{mod.description}</p>
                            </div>
                          </div>

                          <div className="mod-compact-right">
                            <span className={`mod-compact-status ${isSelected ? "status-active" : "status-off"}`}>
                              {isSelected ? "Protected" : "Bypassed"}
                            </span>
                            <div className={`mod-compact-checkbox ${isSelected ? "checked" : ""}`}>
                              {isSelected && <span>&#10003;</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Card 3: Document Access & Download Permissions */}
            <div className="sec-card card-active doc-drm-card">
              {/* Card Header */}
              <div className="sec-card-header">
                <div className="sec-icon-box doc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="sec-header-meta">
                  <h3>Document Permissions &amp; DRM</h3>
                  <p>Control candidate access to study materials, downloads, and viewer protection.</p>
                </div>
                {/* Live summary badges */}
                <div className="drm-header-badges">
                  <span className={`drm-badge ${settings.allowCandidateDocumentView ? "badge-on" : "badge-off"}`}>
                    {settings.allowCandidateDocumentView ? "View: ON" : "View: OFF"}
                  </span>
                  <span className={`drm-badge ${settings.allowCandidateDocumentDownload ? "badge-warn" : "badge-off"}`}>
                    {settings.allowCandidateDocumentDownload ? "DL: ON" : "DL: OFF"}
                  </span>
                </div>
              </div>

              <div className="sec-card-body">

                {/* Permission Summary Strip */}
                <div className="drm-summary-strip">
                  <div className={`drm-summary-item ${settings.allowCandidateDocumentView ? "active" : "inactive"}`}>
                    <div className="drm-summary-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </div>
                    <div className="drm-summary-text">
                      <strong>Viewing</strong>
                      <span>{settings.allowCandidateDocumentView ? "Allowed" : "Blocked"}</span>
                    </div>
                  </div>
                  <div className="drm-summary-divider" />
                  <div className={`drm-summary-item ${settings.allowCandidateDocumentDownload ? "warn" : "inactive"}`}>
                    <div className="drm-summary-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </div>
                    <div className="drm-summary-text">
                      <strong>Downloads</strong>
                      <span>{settings.allowCandidateDocumentDownload ? "Allowed" : "Restricted"}</span>
                    </div>
                  </div>
                  <div className="drm-summary-divider" />
                  <div className={`drm-summary-item ${settings.watermarkDocuments ? "active" : "inactive"}`}>
                    <div className="drm-summary-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <div className="drm-summary-text">
                      <strong>Watermark</strong>
                      <span>{settings.watermarkDocuments ? "Burning" : "Off"}</span>
                    </div>
                  </div>
                </div>

                {/* Permission Toggle Rows */}
                <div className="drm-permission-list">

                  {/* Row 1: View Documents */}
                  <div className={`drm-perm-row ${settings.allowCandidateDocumentView ? "perm-enabled" : "perm-disabled"}`}>
                    <div className="drm-perm-left">
                      <div className={`drm-perm-indicator ${settings.allowCandidateDocumentView ? "ind-green" : "ind-red"}`} />
                      <div className="drm-perm-text">
                        <strong>Allow Candidates to View Documents</strong>
                        <p>Enable or disable candidate access to open documents and PDFs in their portal.</p>
                      </div>
                    </div>
                    <div className="drm-perm-right">
                      <span className={`drm-perm-status-chip ${settings.allowCandidateDocumentView ? "chip-enabled" : "chip-disabled"}`}>
                        {settings.allowCandidateDocumentView ? "Enabled" : "Disabled"}
                      </span>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={settings.allowCandidateDocumentView}
                          onChange={(e) => setSettings({ ...settings, allowCandidateDocumentView: e.target.checked })}
                        />
                        <span className="slider round" />
                      </label>
                    </div>
                  </div>

                  {/* Row 2: Download Raw Files */}
                  <div className={`drm-perm-row ${settings.allowCandidateDocumentDownload ? "perm-warn" : "perm-disabled"}`}>
                    <div className="drm-perm-left">
                      <div className={`drm-perm-indicator ${settings.allowCandidateDocumentDownload ? "ind-amber" : "ind-red"}`} />
                      <div className="drm-perm-text">
                        <strong>Allow Candidates to Download Raw Files</strong>
                        <p>When disabled, candidates can only read documents inside the protected viewer without raw file export.</p>
                      </div>
                    </div>
                    <div className="drm-perm-right">
                      <span className={`drm-perm-status-chip ${settings.allowCandidateDocumentDownload ? "chip-warn" : "chip-disabled"}`}>
                        {settings.allowCandidateDocumentDownload ? "Permitted" : "Restricted"}
                      </span>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={settings.allowCandidateDocumentDownload}
                          onChange={(e) => setSettings({ ...settings, allowCandidateDocumentDownload: e.target.checked })}
                        />
                        <span className="slider round" />
                      </label>
                    </div>
                  </div>

                  {/* Row 3: Watermark */}
                  <div className={`drm-perm-row ${settings.watermarkDocuments ? "perm-enabled" : "perm-disabled"}`} style={{ borderBottom: "none" }}>
                    <div className="drm-perm-left">
                      <div className={`drm-perm-indicator ${settings.watermarkDocuments ? "ind-green" : "ind-red"}`} />
                      <div className="drm-perm-text">
                        <strong>Burn Dynamic Watermark on Document Viewer</strong>
                        <p>Overlays Candidate ID, Date, and Session ID across viewed pages to trace leaks.</p>
                      </div>
                    </div>
                    <div className="drm-perm-right">
                      <span className={`drm-perm-status-chip ${settings.watermarkDocuments ? "chip-enabled" : "chip-disabled"}`}>
                        {settings.watermarkDocuments ? "Active" : "Off"}
                      </span>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={settings.watermarkDocuments}
                          onChange={(e) => setSettings({ ...settings, watermarkDocuments: e.target.checked })}
                        />
                        <span className="slider round" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* DRM Info Note */}
                <div className="drm-info-note">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>
                    {!settings.allowCandidateDocumentView
                      ? "All document access is currently blocked. Candidates cannot view any PDFs or study materials."
                      : settings.allowCandidateDocumentDownload
                        ? "Downloads are currently permitted. Consider restricting to viewer-only for maximum DRM protection."
                        : settings.watermarkDocuments
                          ? "Optimal DRM policy active: view-only access with forensic watermark burning enabled."
                          : "Documents are viewable without watermark protection. Enable watermark for full DRM coverage."}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Dynamic Anti-Leak Forensic Watermarking */}
            <div className={`sec-card ${settings.watermarkEnabled ? "card-active" : "card-disabled"}`}>
              <div className="sec-card-header">
                <div className="sec-icon-box water-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                  </svg>
                </div>
                <div className="sec-header-meta">
                  <h3>Dynamic Forensic Watermarking</h3>
                  <p>Continuous canvas stamp of User ID, Session ID &amp; timestamp.</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={settings.watermarkEnabled}
                    onChange={(e) => setSettings({ ...settings, watermarkEnabled: e.target.checked })}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="sec-card-body">
                <div className="sec-status-row">
                  <span className="sec-status-pill enabled">
                    {settings.watermarkEnabled ? "● Top Canvas Layer (z-index 2147483645)" : "○ Disabled"}
                  </span>
                </div>

                {settings.watermarkEnabled && (
                  <div className="sec-config-section">
                    <label className="sec-field-label">Position Jitter Interval</label>
                    <div className="preset-pills-row">
                      {[5, 8, 15, 30].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`preset-pill-btn ${settings.watermarkIntervalSec === s ? "selected" : ""}`}
                          onClick={() => setSettings({ ...settings, watermarkIntervalSec: s })}
                        >
                          Every {s}s
                          {s === 8 && <span className="rec-tag">Default</span>}
                        </button>
                      ))}
                    </div>
                    <div className="watermark-mini-preview">
                      <span className="preview-label">Live Watermark Pattern Sample:</span>
                      <div className="preview-stamp">
                        SHINE EXAM &bull; User: candidate &bull; {new Date().toLocaleDateString("en-IN")} &bull; Session: ACTIVE
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 5: Module-Wise Data Wipeout & Retention Policy (Full Width / Spanning Grid) */}
            <div className="sec-card card-active data-retention-card" style={{ gridColumn: "1 / -1" }}>
              <div className="sec-card-header">
                <div className="sec-icon-box purge-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </div>
                <div className="sec-header-meta">
                  <h3>Module-Wise Data Wipeout &amp; Retention Policy</h3>
                  <p>Select automatic purge timelines per module to comply with GDPR, ISO 27001, and disk storage optimization.</p>
                </div>
                <div className="retention-header-actions">
                  <button
                    type="button"
                    className="btn-trigger-wipeout"
                    onClick={() => setShowWipeoutModal(true)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                    </svg>
                    Execute Wipeout Now...
                  </button>
                </div>
              </div>

              <div className="sec-card-body">

                {/* Auto-purge status strip */}
                <div className="retention-status-strip">
                  <div className="retention-status-left">
                    <span className="retention-status-badge">
                      {retention.autoPurgeEnabled ? "● Scheduled Auto-Purge Active" : "○ Manual Trigger Mode"}
                    </span>
                    {retention.lastPurgeAt && (
                      <span className="retention-last-purge">
                        Last wiped on <strong>{new Date(retention.lastPurgeAt).toLocaleString("en-IN")}</strong>
                      </span>
                    )}
                  </div>
                  <label className="switch-toggle">
                    <input
                      type="checkbox"
                      checked={retention.autoPurgeEnabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          retentionPolicy: { ...retention, autoPurgeEnabled: e.target.checked },
                        })
                      }
                    />
                    <span className="slider round" />
                  </label>
                </div>

                {/* Module Timelines Row List (Clean, Sleek Enterprise UI) */}
                <div className="retention-row-list">

                  {/* Module 1: Audit Logs */}
                  <div className="retention-row-item">
                    <div className="retention-row-left">
                      <div className="retention-row-icon log-color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="retention-row-info">
                        <strong>Audit Logs &amp; Activity History</strong>
                        <small>Authentication, admin actions, login and security events</small>
                      </div>
                    </div>
                    <div className="retention-row-right">
                      <span className={`retention-status-chip ${retention.auditLogsRetentionDays === -1 ? "chip-permanent" : "chip-active"}`}>
                        {retention.auditLogsRetentionDays === -1 ? "Permanent" : `Purge > ${retention.auditLogsRetentionDays} Days`}
                      </span>
                      <select
                        className="retention-custom-select"
                        value={retention.auditLogsRetentionDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            retentionPolicy: { ...retention, auditLogsRetentionDays: Number(e.target.value) },
                          })
                        }
                      >
                        <option value={7}>7 Days (Strict compliance / fast cleanup)</option>
                        <option value={15}>15 Days (Bi-weekly cycle)</option>
                        <option value={30}>30 Days (Standard monthly purge - Recommended)</option>
                        <option value={60}>60 Days (2 Months retention)</option>
                        <option value={90}>90 Days (Quarterly compliance)</option>
                        <option value={180}>180 Days (Half-yearly archive)</option>
                        <option value={365}>1 Year (Annual retention)</option>
                        <option value={-1}>Never (Keep data indefinitely)</option>
                      </select>
                    </div>
                  </div>

                  {/* Module 2: Security Violations */}
                  <div className="retention-row-item">
                    <div className="retention-row-left">
                      <div className="retention-row-icon violation-color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      <div className="retention-row-info">
                        <strong>Security Violations &amp; Proctoring Incidents</strong>
                        <small>Screenshot attempts, window blur triggers, block records</small>
                      </div>
                    </div>
                    <div className="retention-row-right">
                      <span className={`retention-status-chip ${retention.violationsRetentionDays === -1 ? "chip-permanent" : "chip-active"}`}>
                        {retention.violationsRetentionDays === -1 ? "Permanent" : `Purge > ${retention.violationsRetentionDays} Days`}
                      </span>
                      <select
                        className="retention-custom-select"
                        value={retention.violationsRetentionDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            retentionPolicy: { ...retention, violationsRetentionDays: Number(e.target.value) },
                          })
                        }
                      >
                        <option value={15}>15 Days (Quick review cycle)</option>
                        <option value={30}>30 Days (Monthly reset)</option>
                        <option value={60}>60 Days (2 Months - Recommended)</option>
                        <option value={90}>90 Days (Quarterly semester)</option>
                        <option value={180}>180 Days (Half-yearly)</option>
                        <option value={365}>1 Year (Academic year)</option>
                        <option value={-1}>Never (Keep permanent audit trail)</option>
                      </select>
                    </div>
                  </div>

                  {/* Module 3: Exam Results */}
                  <div className="retention-row-item">
                    <div className="retention-row-left">
                      <div className="retention-row-icon exam-color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                      </div>
                      <div className="retention-row-info">
                        <strong>Exam Results &amp; Student Submissions</strong>
                        <small>Completed attempt answers, scorecards, performance analytics</small>
                      </div>
                    </div>
                    <div className="retention-row-right">
                      <span className={`retention-status-chip ${retention.examResultsRetentionDays === -1 ? "chip-permanent" : "chip-active"}`}>
                        {retention.examResultsRetentionDays === -1 ? "Permanent Transcript" : `Purge > ${retention.examResultsRetentionDays} Days`}
                      </span>
                      <select
                        className="retention-custom-select"
                        value={retention.examResultsRetentionDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            retentionPolicy: { ...retention, examResultsRetentionDays: Number(e.target.value) },
                          })
                        }
                      >
                        <option value={30}>30 Days (Mock tests only)</option>
                        <option value={90}>90 Days (Quarterly purge)</option>
                        <option value={180}>180 Days (Semester retention - Recommended)</option>
                        <option value={365}>1 Year (Academic year archive)</option>
                        <option value={730}>2 Years (Accreditation standard)</option>
                        <option value={-1}>Never (Permanent student transcript)</option>
                      </select>
                    </div>
                  </div>

                  {/* Module 4: Candidate Sessions */}
                  <div className="retention-row-item">
                    <div className="retention-row-left">
                      <div className="retention-row-icon session-color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div className="retention-row-info">
                        <strong>Expired Candidate Security Sessions</strong>
                        <small>Temporary session tokens, inactive watermark traces</small>
                      </div>
                    </div>
                    <div className="retention-row-right">
                      <span className="retention-status-chip chip-active">
                        {`Purge > ${retention.sessionsRetentionHours} Hours`}
                      </span>
                      <select
                        className="retention-custom-select"
                        value={retention.sessionsRetentionHours}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            retentionPolicy: { ...retention, sessionsRetentionHours: Number(e.target.value) },
                          })
                        }
                      >
                        <option value={24}>24 Hours (Daily session flush)</option>
                        <option value={48}>48 Hours (Standard 2 days - Recommended)</option>
                        <option value={72}>72 Hours (3 Days)</option>
                        <option value={168}>7 Days (Weekly cleanup)</option>
                        <option value={720}>30 Days (Monthly cleanup)</option>
                      </select>
                    </div>
                  </div>

                  {/* Module 5: Temporary Documents */}
                  <div className="retention-row-item" style={{ borderBottom: "none" }}>
                    <div className="retention-row-left">
                      <div className="retention-row-icon doc-color">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                      </div>
                      <div className="retention-row-info">
                        <strong>Temporary Document Drafts &amp; Cache</strong>
                        <small>Unassigned PDF drafts, temp preview cache files</small>
                      </div>
                    </div>
                    <div className="retention-row-right">
                      <span className={`retention-status-chip ${retention.tempDocumentsRetentionDays === -1 ? "chip-permanent" : "chip-active"}`}>
                        {retention.tempDocumentsRetentionDays === -1 ? "Permanent" : `Purge > ${retention.tempDocumentsRetentionDays} Days`}
                      </span>
                      <select
                        className="retention-custom-select"
                        value={retention.tempDocumentsRetentionDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            retentionPolicy: { ...retention, tempDocumentsRetentionDays: Number(e.target.value) },
                          })
                        }
                      >
                        <option value={7}>7 Days (Fast draft cleanup)</option>
                        <option value={15}>15 Days (Bi-weekly)</option>
                        <option value={30}>30 Days (Monthly standard - Recommended)</option>
                        <option value={60}>60 Days (2 Months)</option>
                        <option value={90}>90 Days (Quarterly)</option>
                        <option value={-1}>Never (Do not auto-purge drafts)</option>
                      </select>
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>

          {/* Floating Save Footer */}
          <div className="controls-footer-card">
            <div className="footer-meta">
              <div className="footer-meta-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <strong>Security Config Status</strong>
                <p>
                  {settings.updatedAt ? (
                    <>Last updated on {new Date(settings.updatedAt).toLocaleString("en-IN")} by <strong>{settings.updatedBy || "Admin"}</strong></>
                  ) : (
                    "Using default portal security configuration"
                  )}
                </p>
              </div>
            </div>

            <div className="footer-actions">
              <button type="button" className="btn-secondary-reload" onClick={loadSettings}>
                Reset to Current
              </button>
              <button type="submit" className="btn-primary-deploy" disabled={saving}>
                {saving ? "Deploying Policy Changes..." : "Deploy Security Policy"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Manual Data Wipeout Confirmation Modal */}
      {showWipeoutModal && (
        <div className="wipeout-modal-backdrop" onClick={() => setShowWipeoutModal(false)}>
          <div className="wipeout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wipeout-modal-head">
              <div className="wipeout-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <div>
                <h2>Execute Module-Wise Data Wipeout</h2>
                <p>Select which modules to purge right now according to the configured retention timelines.</p>
              </div>
              <button className="wipeout-modal-close" onClick={() => setShowWipeoutModal(false)}>×</button>
            </div>

            <div className="wipeout-modal-body">
              <div className="wipeout-warning-alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>
                  <strong>Warning:</strong> Purged records will be permanently removed from MongoDB and cannot be restored.
                </span>
              </div>

              <div className="wipeout-module-checkboxes">
                {[
                  { key: "audit_logs", title: "Audit Logs & Activity Records", days: retention.auditLogsRetentionDays, unit: "days" },
                  { key: "violations", title: "Security Violations & Incidents", days: retention.violationsRetentionDays, unit: "days" },
                  { key: "sessions", title: "Expired Security Sessions", days: retention.sessionsRetentionHours, unit: "hours" },
                  { key: "results", title: "Exam Results & Submissions", days: retention.examResultsRetentionDays, unit: "days" },
                  { key: "temp_docs", title: "Temporary Files & Draft Uploads", days: retention.tempDocumentsRetentionDays, unit: "days" },
                ].map((item) => {
                  const isChecked = selectedWipeModules.includes(item.key);
                  const isNever = item.days === -1;
                  return (
                    <label key={item.key} className={`wipeout-check-item ${isChecked ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleWipeModuleSelection(item.key)}
                      />
                      <div className="wipeout-check-info">
                        <strong>{item.title}</strong>
                        <small>
                          {isNever
                            ? "Policy is set to Never — will not wipe unless configured"
                            : `Purges records older than ${item.days} ${item.unit}`}
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="wipeout-modal-foot">
              <button
                type="button"
                className="btn-wipeout-cancel"
                onClick={() => setShowWipeoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-wipeout-confirm"
                disabled={wiping || selectedWipeModules.length === 0}
                onClick={executeWipeout}
              >
                {wiping ? "Purging Records..." : `Purge Selected (${selectedWipeModules.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSecurityControls;
