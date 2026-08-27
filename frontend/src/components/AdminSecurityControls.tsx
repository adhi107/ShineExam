import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../services/api";
import "./AdminSecurityControls.css";

interface SecuritySettings {
  autoLogoutEnabled: boolean;
  autoLogoutMinutes: number;
  strictScreenshotLock: boolean;
  watermarkEnabled: boolean;
  watermarkIntervalSec: number;
  allowCandidateDocumentView: boolean;
  allowCandidateDocumentDownload: boolean;
  watermarkDocuments: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const AdminSecurityControls: React.FC = () => {
  const [settings, setSettings] = useState<SecuritySettings>({
    autoLogoutEnabled: true,
    autoLogoutMinutes: 15,
    strictScreenshotLock: true,
    watermarkEnabled: true,
    watermarkIntervalSec: 8,
    allowCandidateDocumentView: true,
    allowCandidateDocumentDownload: false,
    watermarkDocuments: true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ settings: SecuritySettings }>("/admin/security-settings");
      if (res.settings) {
        setSettings(res.settings);
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
      showToast("Security & Document permissions deployed successfully!");
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

  const presetTimes = [5, 10, 15, 30, 60];

  return (
    <div className="security-controls-container">
      {/* Top Header */}
      <header className="controls-header">
        <div>
          <span className="section-eyebrow">SYSTEM SECURITY & PROCTORING</span>
          <h1>Admin Security Controls</h1>
          <p>Configure candidate session timeouts, anti-cheat proctoring policies, document access, and download permissions.</p>
        </div>
        <div className="controls-header-badge">
          <span className="shield-pulse-dot" />
          <span>Firewall Active (MongoDB Gate)</span>
        </div>
      </header>

      {toastMessage && (
        <div className="controls-toast-banner">
          <span>✓ {toastMessage}</span>
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
                <div className="sec-icon-box timer-icon">⏳</div>
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
                <div className="sec-icon-box shield-icon">🛡️</div>
                <div className="sec-header-meta">
                  <h3>Screenshot & Recording Enforcement</h3>
                  <p>Immediate permanent lockout policy on exam capture attempts.</p>
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
                    <span className="policy-check">✓</span>
                    <span><strong>PrtScn / Alt+PrtScn:</strong> Overwrites clipboard & blacks out frame</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">✓</span>
                    <span><strong>Win+Shift+S / Snipping:</strong> Instant window blur trigger</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">✓</span>
                    <span><strong>MongoDB Action:</strong> <code>user.isActive = False</code> & terminates exam</span>
                  </div>
                  <div className="policy-item">
                    <span className="policy-check">✓</span>
                    <span><strong>Unblock Requirement:</strong> Admin Dashboard only</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Document Access & Download Permissions (NEW) */}
            <div className="sec-card card-active">
              <div className="sec-card-header">
                <div className="sec-icon-box doc-icon">📄</div>
                <div className="sec-header-meta">
                  <h3>Document Permissions & DRM</h3>
                  <p>Control candidate ability to view and download study materials.</p>
                </div>
              </div>

              <div className="sec-card-body">
                {/* View Permission Toggle */}
                <div className="permission-toggle-row">
                  <div className="perm-info">
                    <strong>Allow Candidates to View Documents</strong>
                    <p>Enable or disable candidate access to open documents and PDFs in their portal.</p>
                  </div>
                  <label className="switch-toggle">
                    <input
                      type="checkbox"
                      checked={settings.allowCandidateDocumentView}
                      onChange={(e) => setSettings({ ...settings, allowCandidateDocumentView: e.target.checked })}
                    />
                    <span className="slider round" />
                  </label>
                </div>

                {/* Download Permission Toggle */}
                <div className="permission-toggle-row">
                  <div className="perm-info">
                    <strong>Allow Candidates to Download Raw Files</strong>
                    <p>When disabled, candidates can only read documents inside the protected viewer without raw file export.</p>
                  </div>
                  <label className="switch-toggle">
                    <input
                      type="checkbox"
                      checked={settings.allowCandidateDocumentDownload}
                      onChange={(e) => setSettings({ ...settings, allowCandidateDocumentDownload: e.target.checked })}
                    />
                    <span className="slider round" />
                  </label>
                </div>

                {/* Document Watermark Toggle */}
                <div className="permission-toggle-row">
                  <div className="perm-info">
                    <strong>Burn Dynamic Watermark on Document Viewer</strong>
                    <p>Overlays Candidate ID, Date, and Session ID across viewed pages to trace leaks.</p>
                  </div>
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

            {/* Card 4: Dynamic Anti-Leak Forensic Watermarking */}
            <div className={`sec-card ${settings.watermarkEnabled ? "card-active" : "card-disabled"}`}>
              <div className="sec-card-header">
                <div className="sec-icon-box water-icon">💧</div>
                <div className="sec-header-meta">
                  <h3>Dynamic Forensic Watermarking</h3>
                  <p>Continuous canvas stamp of User ID, Session ID & timestamp.</p>
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

          </div>

          {/* Floating Save Footer */}
          <div className="controls-footer-card">
            <div className="footer-meta">
              <span className="meta-icon">🕒</span>
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
                {saving ? "Deploying Policy Changes..." : "Deploy Security Policy 🚀"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminSecurityControls;
