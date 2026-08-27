import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ConfirmDialog from "./ConfirmDialog";
import "./SecurityViolations.css";



interface ViolationRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  statusReason?: string;
  primaryReason: string;
  violationCount: number;
  lastIncidentAt: string;
  blockedDueTo?: string;
  attemptsCount?: number;
}

interface ViolationStats {
  totalViolations: number;
  screenshotCount: number;
  recordingCount: number;
  currentlyBlocked: number;
  totalViolatedUsers: number;
}

interface IncidentItem {
  id: string;
  action: string;
  severity: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  details: any;
}

const SecurityViolations: React.FC = () => {
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [stats, setStats] = useState<ViolationStats>({
    totalViolations: 0,
    screenshotCount: 0,
    recordingCount: 0,
    currentlyBlocked: 0,
    totalViolatedUsers: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [unblockTarget, setUnblockTarget] = useState<ViolationRecord | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "count" | "name">("recent");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Incident Modal
  const [selectedUser, setSelectedUser] = useState<ViolationRecord | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ violations: ViolationRecord[]; stats: ViolationStats }>("/admin/violations");
      setViolations(res.violations || []);
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error("Failed to load violations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUnblockClick = (v: ViolationRecord) => {
    setUnblockTarget(v);
  };

  const executeUnblock = async () => {
    if (!unblockTarget) return;
    const v = unblockTarget;
    setUnblockTarget(null);
    try {
      await apiPut(`/admin/violations/${v.id}/unblock`, {});
      await loadData();
      if (selectedUser && selectedUser.id === v.id) {
        setSelectedUser({ ...selectedUser, isActive: true });
      }
    } catch (err: any) {
      alert(err?.message || "Failed to unblock candidate.");
    }
  };

  const handleViewIncidents = async (v: ViolationRecord) => {
    setSelectedUser(v);
    setLoadingIncidents(true);
    try {
      const res = await apiGet<{ incidents: IncidentItem[] }>(`/admin/violations/${v.userId}/incidents`);
      setIncidents(res.incidents || []);
    } catch (err) {
      console.error("Failed to load incidents:", err);
      setIncidents([]);
    } finally {
      setLoadingIncidents(false);
    }
  };

  const filtered = useMemo(() => {
    const fromTime = startDate ? new Date(startDate + "T00:00:00").getTime() : 0;
    const toTime = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;

    return violations.filter((item) => {
      const text = normalizeSearchText(`${item.name} ${item.userId} ${item.email}`);
      const searchMatch = !search || text.includes(normalizeSearchText(search));

      const typeMatch =
        typeFilter === "all" ||
        (typeFilter === "screenshot" && item.primaryReason.toLowerCase().includes("screenshot")) ||
        (typeFilter === "recording" && (item.primaryReason.toLowerCase().includes("recording") || item.primaryReason.toLowerCase().includes("share"))) ||
        (typeFilter === "other" && !item.primaryReason.toLowerCase().includes("screenshot") && !item.primaryReason.toLowerCase().includes("recording"));

      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "blocked" && !item.isActive) ||
        (statusFilter === "active" && item.isActive);

      const incidentTime = new Date(item.lastIncidentAt).getTime();
      const dateMatch = (!startDate || incidentTime >= fromTime) && (!endDate || incidentTime <= toTime);

      return searchMatch && typeMatch && statusMatch && dateMatch;
    }).sort((a, b) => {
      if (sortBy === "count") return b.violationCount - a.violationCount;
      if (sortBy === "name") return (a.name || a.userId).localeCompare(b.name || b.userId);
      return new Date(b.lastIncidentAt).getTime() - new Date(a.lastIncidentAt).getTime();
    });
  }, [violations, search, typeFilter, statusFilter, startDate, endDate, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setSortBy("recent");
    setCurrentPage(1);
  };

  const formatDate = (val?: string) => {
    if (!val) return "—";
    let str = val.trim();
    if (str && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str += "Z";
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  };


  return (
    <div className="security-violations-container">
      {/* Top Header */}
      <header className="violations-header">
        <div>
          <span className="section-eyebrow">EXAM INTEGRITY & SECURITY</span>
          <h1>Security Violations</h1>
          <p>Track, investigate, and unblock candidates with screenshot and recording policy infractions.</p>
        </div>
        <div className="header-action-group">
          <button type="button" className="refresh-btn" onClick={loadData} title="Refresh records">
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="violations-stats-grid">
        <div className="v-stat-card total">
          <div className="v-stat-icon">⚠️</div>
          <div className="v-stat-content">
            <span className="v-stat-label">Total Violations</span>
            <strong className="v-stat-val">{stats.totalViolations}</strong>
            <small>Across {stats.totalViolatedUsers} students</small>
          </div>
        </div>

        <div className="v-stat-card screenshot">
          <div className="v-stat-icon">📸</div>
          <div className="v-stat-content">
            <span className="v-stat-label">Screenshot Attempts</span>
            <strong className="v-stat-val">{stats.screenshotCount}</strong>
            <small>PrtScn / Snipping tool triggers</small>
          </div>
        </div>

        <div className="v-stat-card recording">
          <div className="v-stat-icon">🎥</div>
          <div className="v-stat-content">
            <span className="v-stat-label">Recording / Sharing</span>
            <strong className="v-stat-val">{stats.recordingCount}</strong>
            <small>Screen captures detected</small>
          </div>
        </div>

        <div className="v-stat-card blocked">
          <div className="v-stat-icon">🚫</div>
          <div className="v-stat-content">
            <span className="v-stat-label">Currently Suspended</span>
            <strong className="v-stat-val">{stats.currentlyBlocked}</strong>
            <small>Requires Admin Unblock</small>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="violations-filter-panel">
        <div className="filter-group search-group">
          <label>Search Student</label>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search by student name, User ID, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
            {search && <button type="button" className="clear-search-inline" onClick={() => setSearch("")}>×</button>}
          </div>
        </div>

        <div className="filter-group">
          <label>Violation Type</label>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Violation Types</option>
            <option value="screenshot">Screenshots (PrtSc/Snipping)</option>
            <option value="recording">Screen Recording / Sharing</option>
            <option value="other">Other Security Warnings</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Account Status</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Statuses</option>
            <option value="blocked">Suspended / Blocked</option>
            <option value="active">Active (Unblocked)</option>
          </select>
        </div>

        <div className="filter-group date-group">
          <label>Incident From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="filter-date-input"
          />
        </div>

        <div className="filter-group date-group">
          <label>Incident To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="filter-date-input"
          />
        </div>

        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="recent">Most Recent Incident</option>
            <option value="count">Most Violations</option>
            <option value="name">Student Name A-Z</option>
          </select>
        </div>

        {(search || typeFilter !== "all" || statusFilter !== "all" || startDate || endDate || sortBy !== "recent") && (
          <div className="filter-group-end">
            <button type="button" className="clear-filters-action-btn" onClick={resetFilters}>
              Clear Filters ✕
            </button>
          </div>
        )}
      </div>

      {/* Table Data */}
      <div className="violations-table-card">
        {loading ? (
          <div className="violations-loading-state">
            <div className="spinner" />
            <p>Loading security violation records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="violations-empty-state">
            <span className="empty-icon">🛡️</span>
            <h3>No Security Violations Found</h3>
            <p>No candidates match your selected filter criteria, or no security violations have occurred.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="violations-data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>User ID</th>
                  <th>Email</th>
                  <th>Violation Type</th>
                  <th>Times Violated</th>
                  <th>Last Incident</th>
                  <th>Current Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((v) => {
                  const isSuspended = !v.isActive;
                  const isScreenshot = v.primaryReason.toLowerCase().includes("screenshot");
                  const isRecording = v.primaryReason.toLowerCase().includes("recording") || v.primaryReason.toLowerCase().includes("share");

                  return (
                    <tr key={v.id} className={isSuspended ? "row-suspended" : ""}>
                      <td>
                        <div className="v-student-cell">
                          <span className="v-avatar">{(v.name || v.userId).charAt(0).toUpperCase()}</span>
                          <div className="v-student-info">
                            <strong>{v.name || v.userId}</strong>
                            <small>{v.attemptsCount || 0} exams attempted</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className="v-code-tag">{v.userId}</code>
                      </td>
                      <td>{v.email || "—"}</td>
                      <td>
                        <span className={`v-reason-badge ${isScreenshot ? "badge-screenshot" : isRecording ? "badge-recording" : "badge-other"}`}>
                          {isScreenshot ? "📸 Screenshot" : isRecording ? "🎥 Recording" : v.primaryReason}
                        </span>
                      </td>
                      <td>
                        <span className={`v-count-badge ${v.violationCount > 1 ? "count-high" : "count-low"}`}>
                          {v.violationCount} {v.violationCount === 1 ? "time" : "times"}
                        </span>
                      </td>
                      <td className="v-date-cell">{formatDate(v.lastIncidentAt)}</td>
                      <td>
                        <span className={`v-status-badge ${isSuspended ? "status-suspended" : "status-active"}`}>
                          {isSuspended ? "● Suspended" : "● Active"}
                        </span>
                      </td>
                      <td>
                        <div className="v-action-group">
                          {isSuspended ? (
                            <button
                              type="button"
                              className="v-btn-unblock"
                              onClick={() => handleUnblockClick(v)}
                              title="Unblock student account"
                            >
                              Unblock
                            </button>
                          ) : (
                            <span className="v-unblocked-label">Access OK</span>
                          )}
                          <button
                            type="button"
                            className="v-btn-view"
                            onClick={() => handleViewIncidents(v)}
                            title="View incident logs timeline"
                          >
                            Details 👁
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

        {/* Pagination Controls */}
        {filtered.length > 0 && (
          <div className="table-pagination-bar">
            <div className="pagination-info">
              Showing <strong>{Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}</strong> to <strong>{Math.min(filtered.length, currentPage * pageSize)}</strong> of <strong>{filtered.length}</strong> students
            </div>

            <div className="pagination-controls">
              <label className="page-size-picker">
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
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

      {/* Incident Detail Modal */}
      {selectedUser && (
        <div className="incident-modal-backdrop" onMouseDown={() => setSelectedUser(null)}>
          <div className="incident-modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="incident-modal-header">
              <div>
                <span className="modal-eyebrow">STUDENT INCIDENT LOGS</span>
                <h2>{selectedUser.name || selectedUser.userId}</h2>
                <p>User ID: <code>{selectedUser.userId}</code> &bull; Total Incidents: {selectedUser.violationCount}</p>
              </div>
              <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
            </header>

            <div className="incident-modal-body">
              {loadingIncidents ? (
                <div className="incident-loading">Loading incident history...</div>
              ) : incidents.length === 0 ? (
                <div className="incident-empty">No detailed incident logs found for this student.</div>
              ) : (
                <div className="incident-timeline">
                  {incidents.map((inc, i) => (
                    <div key={inc.id || i} className={`timeline-item severity-${inc.severity}`}>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-top">
                          <span className="incident-action">{inc.action.replace("FRONTEND_", "").replace("ACCOUNT_PERMANENTLY_BLOCKED_", "SUSPENDED: ")}</span>
                          <span className="incident-time">{formatDate(inc.timestamp)}</span>
                        </div>
                        <div className="timeline-meta">
                          <span>IP: <code>{inc.ip}</code></span>
                          {inc.userAgent && <span title={inc.userAgent}>Device: {inc.userAgent.slice(0, 45)}...</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="incident-modal-footer">
              {!selectedUser.isActive && (
                <button
                  type="button"
                  className="modal-unblock-btn"
                  onClick={() => handleUnblockClick(selectedUser)}
                >
                  Unblock Student Account
                </button>
              )}
              <button type="button" className="modal-close-action-btn" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Screen Center Confirm Dialog for Unblock */}
      <ConfirmDialog
        isOpen={Boolean(unblockTarget)}
        title="Unblock Candidate Access"
        message={
          <>
            Are you sure you want to unblock <strong>{unblockTarget?.name || unblockTarget?.userId}</strong> (<code>{unblockTarget?.userId}</code>)?
            <br />
            This will immediately reactivate their account and restore full access to their exam portal.
          </>
        }
        confirmText="Yes, Unblock Candidate"
        cancelText="Cancel"
        variant="unblock"
        icon="🔓"
        onConfirm={executeUnblock}
        onCancel={() => setUnblockTarget(null)}
      />
    </div>
  );
};

export default SecurityViolations;
