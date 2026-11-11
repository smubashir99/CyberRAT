/**
 * CyberRAT — Admin: Audit Log Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Admin-only: read-only view of the immutable audit trail.
 * GET /api/results/audit?action=<filter>
 */

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { resultsAPI } from "../services/api";
import "./AdminAuditPage.css";
// Action filters for the dropdown
const ACTION_FILTERS = [
  "", "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT",
  "ASSESSMENT_SUBMITTED", "ASSESSMENT_DELETED",
  "USER_CREATED", "USER_ROLE_CHANGED", "USER_STATUS_CHANGED",
  "ECDH_EXCHANGE",
];
// Action colors for the badges
const ACTION_COLORS = {
  LOGIN_SUCCESS:         "success",
  LOGOUT:                "info",
  ASSESSMENT_SUBMITTED:  "info",
  ECDH_EXCHANGE:         "info",
  LOGIN_FAILED:          "warning",
  USER_CREATED:          "info",
  USER_ROLE_CHANGED:     "warning",
  USER_STATUS_CHANGED:   "warning",
  ASSESSMENT_DELETED:    "danger",
};

export default function AdminAuditPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");
  // Load audit logs from the API, optionally filtered by action
  const loadLogs = (action = filter) => {
    setLoading(true);
    resultsAPI.getAuditLog(action ? { action } : undefined)
      .then((r) => setLogs(r.data.logs || r.data.audit_logs || []))
      .catch(() => toast.error("Failed to load audit logs."))
      .finally(() => setLoading(false));
  };
  // Load logs on mount
  useEffect(() => { loadLogs(); }, []);  // eslint-disable-line
  // Handle filter change
  const handleFilterChange = (val) => {
    setFilter(val);
    loadLogs(val);
  };
  // Render the page
  return (
    <div className="page">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">
            Immutable security event trail · {logs.length} entries shown
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => loadLogs()}>↻ Refresh</button>
      </div>

      {/* Filter row */}
      <div className="audit-filter-row">
        <label className="form-label" style={{ marginBottom: 0 }}>Filter by action:</label>
        <select
          className="form-control audit-filter-select"
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">All events</option>
          {ACTION_FILTERS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="page-loader"><div className="spinner" /> Loading audit log…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
            <h3>No audit events</h3>
            <p style={{ fontSize: 13 }}>No events match the current filter.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const colorClass = ACTION_COLORS[log.action] || "info";
                  return (
                    <tr key={log.id}>
                      <td className="text-muted audit-ts">
                        {new Date(log.timestamp || log.created_at).toLocaleString("en-IE")}
                      </td>
                      <td>
                        <span className={`audit-action-badge audit-action-badge--${colorClass}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <div>{log.user_email || <span className="text-muted">—</span>}</div>
                          {log.user_id && (
                            <code style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {log.user_id}
                            </code>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 300 }}>{log.description}</td>
                      <td>
                        <span className={`badge ${(log.status_code || log.http_status_code || 0) < 400 ? "badge-low" : "badge-critical"}`}>
                          {log.status_code || log.http_status_code || "—"}
                        </span>
                      </td>
                      <td className="text-muted audit-ip">
                        {log.ip_address || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card audit-legend">
        <p className="text-muted" style={{ fontSize: 12 }}>
          ⚠ This audit log is <strong>insert-only</strong>. No events can be modified or deleted.
          Records include login attempts, assessment submissions, user role changes, and encryption
          key exchanges.
        </p>
      </div>
    </div>
  );
}
