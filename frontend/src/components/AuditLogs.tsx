import React, { useEffect, useState } from "react";
import { API_BASE, apiGet } from "../services/api";
import "./AuditLogs.css";


interface AuditLogItem {
  id: string;
  action: string;
  userId: string;
  severity: "info" | "warning" | "critical";
  ip: string;
  userAgent: string;
  details: any;
  timestamp: string;
}

interface AuditStats {
  totalLogs: number;
  loginsToday: number;
  securityAlerts: number;
  criticalEvents: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalLogs: 0,
    loginsToday: 0,
    securityAlerts: 0,
    criticalEvents: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadLogs = async (page = 1, limit = pagination.limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await apiGet<{
        logs: AuditLogItem[];
        pagination: PaginationMeta;
        stats: AuditStats;
      }>(`/admin/audit-logs?${params.toString()}`);

      setLogs(res.logs || []);
      if (res.pagination) setPagination(res.pagination);
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1, pagination.limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severityFilter, categoryFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs(1, pagination.limit);
  };

  const handleExportCSV = () => {
    window.open(`${API_BASE}/admin/audit-logs/export`, "_blank");
  };

  const resetFilters = () => {
    setSearch("");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setStartDate("");
    setEndDate("");
    loadLogs(1, pagination.limit);
  };

  const formatTimestamp = (val?: string) => {
    if (!val) return "—";
    let str = val.trim();
    if (str && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str += "Z";
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}`;
  };


  const parseUserAgent = (ua?: string) => {
    if (!ua) return "—";
    let os = "OS";
    let icon = "💻";
    if (ua.includes("Windows")) { os = "Windows"; icon = "💻"; }
    else if (ua.includes("Mac OS")) { os = "macOS"; icon = "💻"; }
    else if (ua.includes("Android")) { os = "Android"; icon = "📱"; }
    else if (ua.includes("iPhone") || ua.includes("iPad")) { os = "iOS"; icon = "📱"; }
    else if (ua.includes("Linux")) { os = "Linux"; icon = "💻"; }

    let browser = "Browser";
    if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

    return `${icon} ${os} · ${browser}`;
  };

  const getActionBadgeClass = (action: string, severity: string) => {

    if (severity === "critical" || action.includes("BLOCKED") || action.includes("TERMINATED")) return "action-critical";
    if (severity === "warning" || action.includes("FAILED") || action.includes("WARN")) return "action-warning";
    if (action.includes("LOGIN") || action.includes("SESSION")) return "action-auth";
    if (action.includes("EXAM") || action.includes("SUBMIT")) return "action-exam";
    return "action-info";
  };

  return (
    <div className="audit-logs-container">
      {/* Header */}
      <header className="audit-header">
        <div>
          <span className="section-eyebrow">SYSTEM COMPLIANCE & MONITORING</span>
          <h1>Audit Logs</h1>
          <p>Complete historical log of logins, candidate activities, test events, and security triggers.</p>
        </div>
        <div className="header-action-group">
          <button type="button" className="csv-export-btn" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button type="button" className="refresh-btn" onClick={() => loadLogs(pagination.page, pagination.limit)}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="audit-stats-grid">
        <div className="a-stat-card total">
          <div className="a-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div className="a-stat-content">
            <span className="a-stat-label">Total Logged Events</span>
            <strong className="a-stat-val">{stats.totalLogs}</strong>
            <small>Audited actions recorded</small>
          </div>
        </div>

        <div className="a-stat-card logins">
          <div className="a-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <div className="a-stat-content">
            <span className="a-stat-label">Candidate Logins Today</span>
            <strong className="a-stat-val">{stats.loginsToday}</strong>
            <small>Active authentication events</small>
          </div>
        </div>

        <div className="a-stat-card security">
          <div className="a-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="a-stat-content">
            <span className="a-stat-label">Security Alerts</span>
            <strong className="a-stat-val">{stats.securityAlerts}</strong>
            <small>Violations and shields triggered</small>
          </div>
        </div>

        <div className="a-stat-card critical">
          <div className="a-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="a-stat-content">
            <span className="a-stat-label">Critical Incidents</span>
            <strong className="a-stat-val">{stats.criticalEvents}</strong>
            <small>Immediate account locks</small>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <form className="audit-filter-panel" onSubmit={handleSearchSubmit}>
        <div className="filter-group search-group">
          <label>Search Logs</label>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search User ID, Event Name, IP address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button type="button" className="clear-search-inline" onClick={() => { setSearch(""); loadLogs(1, pagination.limit); }}>×</button>}
          </div>
        </div>

        <div className="filter-group">
          <label>Event Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            <option value="auth">Logins & Authentication</option>
            <option value="security">Security & Violation Events</option>
            <option value="exam">Exam Attempts & Submissions</option>
            <option value="admin">Administrative Actions</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Severity</label>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="filter-group date-group">
          <label>Date From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="filter-date-input"
          />
        </div>

        <div className="filter-group date-group">
          <label>Date To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="filter-date-input"
          />
        </div>

        <div className="filter-actions-group">
          <button type="submit" className="audit-search-btn">Filter</button>
          {(search || severityFilter !== "all" || categoryFilter !== "all" || startDate || endDate) && (
            <button type="button" className="clear-filters-action-btn" onClick={resetFilters}>
              Clear ✕
            </button>
          )}
        </div>
      </form>

      {/* Table Data */}
      <div className="audit-table-card">
        {loading ? (
          <div className="audit-loading-state">
            <div className="spinner" />
            <p>Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="audit-empty-state">
            <span className="empty-icon">📋</span>
            <h3>No Audit Logs Found</h3>
            <p>No log records match your current filter criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="audit-data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Action / Event</th>
                  <th>User ID</th>
                  <th>Severity</th>
                  <th>Client IP</th>
                  <th>Device / Browser</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={`severity-row-${log.severity}`}>
                    <td className="log-time-cell">{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <span className={`log-action-badge ${getActionBadgeClass(log.action, log.severity)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <code className="log-user-tag">{log.userId || "system"}</code>
                    </td>
                    <td>
                      <span className={`log-severity-badge sev-${log.severity}`}>
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="log-ip-text">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        {log.ip || "—"}
                      </span>
                    </td>
                    <td className="log-agent-cell" title={log.userAgent}>
                      <span className="log-agent-chip">{parseUserAgent(log.userAgent)}</span>
                    </td>
                    <td className="log-action-col">
                      <button
                        type="button"
                        className="log-details-btn"
                        onClick={() => setSelectedLog(log)}
                        title="View event payload context"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5,verticalAlign:'middle'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Context
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <div className="table-pagination-bar">
            <div className="pagination-info">
              Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{" "}
              <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{" "}
              <strong>{pagination.total}</strong> events
            </div>

            <div className="pagination-controls">
              <label className="page-size-picker">
                Per page:
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    const nextLimit = Number(e.target.value);
                    loadLogs(1, nextLimit);
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <button
                type="button"
                className="page-nav-btn"
                disabled={pagination.page <= 1}
                onClick={() => loadLogs(pagination.page - 1, pagination.limit)}
              >
                ‹ Previous
              </button>

              <span className="page-current-indicator">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="page-nav-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadLogs(pagination.page + 1, pagination.limit)}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Details Modal */}
      {selectedLog && (
        <div className="log-modal-backdrop" onMouseDown={() => setSelectedLog(null)}>
          <div className="log-modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="log-modal-header">
              <div>
                <span className="modal-eyebrow">EVENT CONTEXT PAYLOAD</span>
                <h2>{selectedLog.action}</h2>
                <p>{formatTimestamp(selectedLog.timestamp)} &bull; User: <code>{selectedLog.userId}</code></p>
              </div>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>×</button>
            </header>

            <div className="log-modal-body">
              <div className="log-detail-grid">
                <div className="log-detail-item">
                  <label>Severity</label>
                  <span className={`log-severity-badge sev-${selectedLog.severity}`}>
                    {selectedLog.severity.toUpperCase()}
                  </span>
                </div>
                <div className="log-detail-item">
                  <label>IP Address</label>
                  <code>{selectedLog.ip}</code>
                </div>
                <div className="log-detail-item full-width">
                  <label>User Agent</label>
                  <p className="user-agent-string">{selectedLog.userAgent || "None recorded"}</p>
                </div>
              </div>

              <div className="log-json-viewer">
                <label>Raw Event Details</label>
                <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
              </div>
            </div>

            <footer className="log-modal-footer">
              <button type="button" className="modal-close-action-btn" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
