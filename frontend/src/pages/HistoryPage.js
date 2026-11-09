/**
 * CyberRAT — Assessment History Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Shows all past assessments for the current user (or all, if admin).
 * Each row is clickable → navigates to /results/:id
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./HistoryPage.css";

/* ── helpers ──────────────────────────────────────────────── */
const RISK_META = {
  Low:      { cls: "risk-low",      label: "LOW"      },
  Medium:   { cls: "risk-medium",   label: "MEDIUM"   },
  High:     { cls: "risk-high",     label: "HIGH"     },
  Critical: { cls: "risk-critical", label: "CRITICAL" },
};
// Returns risk metadata (CSS class and label) for a given risk level, defaulting to "Unknown" if not found.
function riskMeta(level) {
  return RISK_META[level] || { cls: "risk-unknown", label: level || "—" };
}
// Formats an ISO date string into a human-readable format (e.g., "01 Jan 2024"), or returns "—" if invalid.
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
// ScoreBar component: visualizes a score (0-10) as a colored bar with percentage width and color coding based on score ranges.
function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  let cls = "bar-low";
  if (score >= 8) cls = "bar-strong";
  else if (score >= 6) cls = "bar-moderate";
  else if (score >= 4) cls = "bar-weak";
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className={`score-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`score-bar-val ${cls}`}>{score?.toFixed(1)}</span>
    </div>
  );
}

/* ── main component ───────────────────────────────────────── */
// HistoryPage component: displays a list of past assessments with filtering, sorting, and navigation to detailed results.
export default function HistoryPage() {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [filterRisk,  setFilterRisk]  = useState("All");
  const [sortField,   setSortField]   = useState("created_at");
  const [sortDir,     setSortDir]     = useState("desc");
 // Fetches all assessments from the API and updates state; handles loading and error states.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/results/all");
      setAssessments(res.data.results || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);
  // Load assessments on component mount
  useEffect(() => { load(); }, [load]);

  /* ── filter + sort ─────────────────────────────────────── */
  const filtered = assessments
    .filter(a => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.company_name?.toLowerCase().includes(q) ||
        a.sector?.toLowerCase().includes(q);
      const matchRisk =
        filterRisk === "All" || a.scores?.risk_level === filterRisk;
      return matchSearch && matchRisk;
    })
    .sort((a, b) => {
      let av, bv;
      if (sortField === "created_at") {
        av = new Date(a.created_at); bv = new Date(b.created_at);
      } else if (sortField === "score") {
        av = a.scores?.overall ?? 0; bv = b.scores?.overall ?? 0;
      } else if (sortField === "company") {
        av = a.company_name ?? ""; bv = b.company_name ?? "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  // Toggle sorting for a given field; if already sorted by that field, reverse direction; otherwise, set to descending.
  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }
  // SortIcon component: displays an arrow indicating the current sort direction for a given field, or a neutral icon 
  // if not sorted by that field.
  function SortIcon({ field }) {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  /* ── stats banner ──────────────────────────────────────── */
  const total    = assessments.length;
  const avgScore = total
    ? (assessments.reduce((s, a) => s + (a.scores?.overall ?? 0), 0) / total).toFixed(1)
    : "—";
  const riskCounts = assessments.reduce((acc, a) => {
    const r = a.scores?.risk_level || "Unknown";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  /* ── render ─────────────────────────────────────────────── */
  // Main render function: displays the history page with header, stats, filters, and assessment table or messages 
  // based on state.
  return (
    <div className="history-page">

      {/* ── page header ──────────────────────────────────── */}
      <div className="history-header">
        <div className="history-header__left">
          <h1 className="history-title">
            <span className="history-title-icon">📂</span>
            Assessment History
          </h1>
          <p className="history-subtitle">
            All your past cybersecurity risk assessments
          </p>
        </div>
        <button
          className="btn-new-assessment"
          onClick={() => navigate("/assessment")}
        >
          + New Assessment
        </button>
      </div>

      {/* ── stats strip ──────────────────────────────────── */}
      {!loading && !error && total > 0 && (
        <div className="history-stats">
          <div className="hstat">
            <span className="hstat-val">{total}</span>
            <span className="hstat-label">Total</span>
          </div>
          <div className="hstat">
            <span className="hstat-val">{avgScore}</span>
            <span className="hstat-label">Avg Score</span>
          </div>
          {["Critical","High","Medium","Low"].map(r => (
            riskCounts[r] ? (
              <div key={r} className={`hstat hstat--${r.toLowerCase()}`}>
                <span className="hstat-val">{riskCounts[r]}</span>
                <span className="hstat-label">{r}</span>
              </div>
            ) : null
          ))}
        </div>
      )}

      {/* ── filters ──────────────────────────────────────── */}
      {/* Filter section: search input and risk level buttons to filter the displayed assessments. */}
      <div className="history-filters">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search company or sector…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>
        <div className="risk-filters">
          {["All","Critical","High","Medium","Low"].map(r => (
            <button
              key={r}
              className={`risk-filter-btn risk-filter-${r.toLowerCase()} ${filterRisk === r ? "active" : ""}`}
              onClick={() => setFilterRisk(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── content ──────────────────────────────────────── */}
     {/*Content section: displays loading spinner, error message, empty state, or the assessment table based on current state.*/}
      {loading && (
        <div className="history-loading">
          <div className="spinner" />
          <span>Loading assessments…</span>
        </div>
      )}

      {error && (
        <div className="history-error">
          <span>⚠ {error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}
     {/*Empty state handling: shows different messages and actions based on whether there are no assessments or 
      no search results. */}
      {!loading && !error && filtered.length === 0 && (
        <div className="history-empty">
          {total === 0 ? (
            <>
              <div className="empty-icon">📋</div>
              <p>No assessments yet.</p>
              <button className="btn-new-assessment" onClick={() => navigate("/assessment")}>
                Start your first assessment
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">🔍</div>
              <p>No results match your search.</p>
              <button onClick={() => { setSearch(""); setFilterRisk("All"); }}>
                Clear filters
              </button>
            </>
          )}
        </div>
      )}
      
      {!loading && !error && filtered.length > 0 && (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th className="col-id">#</th>
                <th className="col-company sortable" onClick={() => toggleSort("company")}>
                  Organisation <SortIcon field="company" />
                </th>
                <th className="col-sector">Sector</th>
                <th className="col-score sortable" onClick={() => toggleSort("score")}>
                  Score <SortIcon field="score" />
                </th>
                <th className="col-risk">Risk Level</th>
                <th className="col-date sortable" onClick={() => toggleSort("created_at")}>
                  Date <SortIcon field="created_at" />
                </th>
                <th className="col-action"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const rm = riskMeta(a.scores?.risk_level);
                return (
                  <tr
                    key={a.id}
                    className="history-row"
                    onClick={() => navigate(`/results/${a.id}`)}
                  >
                    <td className="col-id">
                      <span className="row-num">CRA-{String(a.id).padStart(4,"0")}</span>
                    </td>
                    <td className="col-company">
                      <div className="company-name">{a.company_name}</div>
                      <div className="company-size">{a.company_size}</div>
                    </td>
                    <td className="col-sector">
                      <span className="sector-tag">{a.sector}</span>
                    </td>
                    <td className="col-score">
                      <ScoreBar score={a.scores?.overall} />
                    </td>
                    <td className="col-risk">
                      <span className={`risk-badge ${rm.cls}`}>{rm.label}</span>
                    </td>
                    <td className="col-date">{fmtDate(a.created_at)}</td>
                    <td className="col-action">
                      <span className="view-btn">View →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            Showing {filtered.length} of {total} assessment{total !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
