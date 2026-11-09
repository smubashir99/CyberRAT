/**
 * CyberRAT — Dashboard Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Analytics dashboard:
 *  - All users: personal stats, NIST radar, score trend, recent table
 *  - Admin only: risk distribution pie, sector breakdown, score trend across all
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid,
  LineChart, Line, Legend,
  PieChart, Pie, Sector,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { resultsAPI } from "../services/api";
import "./DashboardPage.css";

/* ── Constants ────────────────────────────────────────────────── */
// Color palette for risk levels, NIST domains, and sectors
const RISK_COLORS = {
  Low:      "#32eb7e",
  Medium:   "#f5c31e",
  High:     "#ff6e34",
  Critical: "#ff3737",
};
const NIST_COLORS = {
  Identify: "#58a6ff",
  Protect:  "#32eb7e",
  Detect:   "#f5c31e",
  Respond:  "#ff6e34",
  Recover:  "#bc8cff",
};
const SECTOR_PALETTE = [
  "#00d4de","#58a6ff","#32eb7e","#f5c31e","#ff6e34",
  "#bc8cff","#79c0ff","#ffa657","#ff7b72","#a5d6ff",
];

/* ── Helpers ──────────────────────────────────────────────────── */
// Format ISO date to "DD MMM YYYY" (e.g., "12 Mar 2024")
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function getRiskClass(level) {
  return `score-${(level || "critical").toLowerCase()}`;
}
function getBadgeClass(level) {
  return `badge badge-${(level || "critical").toLowerCase()}`;
}
function riskColor(level) {
  return RISK_COLORS[level] || "#8b949e";
}

/* ── Custom Pie active shape ──────────────────────────────────── */
// Custom active shape for the risk distribution pie chart
function ActivePieShape(props) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill, payload, percent, value,
  } = props;
  return (
    <g>
      <text x={cx} y={cy - 8}  textAnchor="middle" fill="#e6edf3" fontSize={14} fontWeight={600}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#8b949e" fontSize={12}>
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
              startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14}
              startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */
// Stat card component for displaying key metrics
function StatCard({ icon, value, label, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value" style={color ? { color } : {}}>
        {value ?? "—"}
      </div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

function EmptyChart({ message = "No data yet" }) {
  return (
    <div style={{
      height: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#6e7681",
      fontSize: 13,
      flexDirection: "column",
      gap: 8,
    }}>
      <span style={{ fontSize: 32 }}>📭</span>
      {message}
    </div>
  );
}

/* ── NIST Radar (shared for both admin + user) ────────────────── */
// Displays a radar chart of NIST CSF domain scores
function NistRadar({ data }) {
  if (!data || data.every(d => d.score === 0)) return <EmptyChart message="No score data" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#30363d" />
        <PolarAngleAxis dataKey="domain" tick={{ fill: "#8b949e", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fill: "#6e7681", fontSize: 9 }} />
        <Radar
          dataKey="score" name="Score"
          stroke="#00d4de" fill="#00d4de" fillOpacity={0.2} strokeWidth={2}
          dot={{ r: 3, fill: "#00d4de" }}
        />
        <Tooltip
          contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
          labelStyle={{ color: "#e6edf3" }}
          itemStyle={{ color: "#00d4de" }}
          formatter={(v) => [`${v}/10`, "Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Score trend line (shared) ────────────────────────────────── */
// Displays a line chart of overall scores over time
function ScoreTrend({ data }) {
  if (!data || data.length < 2) return <EmptyChart message="Need 2+ assessments for trend" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
          labelStyle={{ color: "#e6edf3" }}
          formatter={(v, n, p) => [`${v}/10 — ${p.payload.date}`, "Overall Score"]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#8b949e" }} />
        <Line
          type="monotone" dataKey="overall" name="Overall Score"
          stroke="#00d4de" strokeWidth={2.5}
          dot={{ fill: "#00d4de", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
// DashboardPage component: main analytics dashboard for users and admins
export default function DashboardPage() {
  const { user, isAdmin }         = useAuth();
  const [allResults,  setAll]     = useState([]);
  const [adminStats,  setStats]   = useState(null);   // admin only
  const [loading,     setLoading] = useState(true);
  const [activeIdx,   setActive]  = useState(0);

  // Load all results and admin stats (if applicable) on mount
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // All users: get their own results via /api/results/all
      // Admin gets everyone's; analyst/viewer get own
      const [allRes, statsRes] = await Promise.allSettled([
        resultsAPI.getAll(),
        isAdmin ? resultsAPI.getStats() : Promise.resolve(null),
      ]);

      if (allRes.status === "fulfilled") {
        setAll(allRes.value?.data?.results || []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value) {
        setStats(statsRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  /* ── Derived data ───────────────────────────────────────────── */
  const total = allResults.length;

  /* Personal avg scores (from the user's own assessments) */
  const myAvg = total > 0 ? (() => {
    const sum = { identify:0, protect:0, detect:0, respond:0, recover:0, overall:0 };
    allResults.forEach(a => {
      sum.identify += a.score_identify ?? a.scores?.identify ?? 0;
      sum.protect  += a.score_protect  ?? a.scores?.protect  ?? 0;
      sum.detect   += a.score_detect   ?? a.scores?.detect   ?? 0;
      sum.respond  += a.score_respond  ?? a.scores?.respond  ?? 0;
      sum.recover  += a.score_recover  ?? a.scores?.recover  ?? 0;
      sum.overall  += a.overall_score  ?? a.scores?.overall  ?? 0;
    });
    return Object.fromEntries(
      Object.entries(sum).map(([k, v]) => [k, +(v / total).toFixed(2)])
    );
  })() : {};

  /* Radar data — admin uses /stats averages; user uses own avg */
  const avgForRadar = isAdmin
    ? (adminStats?.average_scores || {})
    : myAvg;

  // Radar data for NIST CSF domains, rounded to 2 decimal places
  const radarData = [
    { domain: "Identify", score: +(avgForRadar.identify ?? 0).toFixed(2) },
    { domain: "Protect",  score: +(avgForRadar.protect  ?? 0).toFixed(2) },
    { domain: "Detect",   score: +(avgForRadar.detect   ?? 0).toFixed(2) },
    { domain: "Respond",  score: +(avgForRadar.respond  ?? 0).toFixed(2) },
    { domain: "Recover",  score: +(avgForRadar.recover  ?? 0).toFixed(2) },
  ];

  /* Score trend: last 12 assessments sorted by date */
  const trendData = [...allResults]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-12)
    .map((a, i) => ({
      name:    a.company_name?.slice(0, 10) || `#${i + 1}`,
      overall: +(a.overall_score ?? a.scores?.overall ?? 0),
      date:    fmtDate(a.created_at),
    }));

  /* Personal risk counts */
  const myRiskCounts = allResults.reduce((acc, a) => {
    const r = a.risk_level ?? a.scores?.risk_level ?? "Unknown";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  /* Admin charts */
  const riskBarData = (isAdmin && adminStats?.risk_distribution)
    ? ["Low", "Medium", "High", "Critical"].map(l => ({
        level: l,
        count: adminStats.risk_distribution[l] ?? 0,
      }))
    : [];
  // Sector distribution: top 8 sectors by count, truncated names if too long
  const sectorData = (isAdmin && adminStats?.sector_distribution)
    ? Object.entries(adminStats.sector_distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([sector, count], i) => ({
          sector: sector.length > 18 ? sector.slice(0, 16) + "…" : sector,
          count,
          fill:   SECTOR_PALETTE[i % SECTOR_PALETTE.length],
        }))
    : [];
  // Pie chart data for risk distribution, filtering out zero counts and mapping to color
  const pieData = Object.entries(adminStats?.risk_distribution || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, fill: RISK_COLORS[name] || "#58a6ff" }));

  /* Latest risk for the most recent assessment */
  const latestRisk = allResults[0]?.risk_level ?? allResults[0]?.scores?.risk_level ?? null;

  /* Recent 5 assessments */
  const recentFive = allResults.slice(0, 5);

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────── */
  // Main dashboard layout with stats, charts, and recent assessments
  return (
    <div className="page">

      {/* ── Page header ── */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{user?.first_name}</strong>.
            {" "}Cybersecurity Risk Assessment Overview.
          </p>
        </div>
        <Link to="/assessment" className="btn btn-primary">
          + New Assessment
        </Link>
      </div>

      {/* ── Stat cards ── */}
       {/*  Four key metrics: total assessments, average score, low risk count, high/critical count */}
      <div className="grid-4 mb-16">
        <StatCard
          icon="📋"
          value={isAdmin ? (adminStats?.total ?? total) : total}
          label={isAdmin ? "Total Assessments" : "My Assessments"}
        />
        <StatCard
          icon="📈"
          value={total > 0 ? `${myAvg.overall}/10` : "—"}
          label={isAdmin ? "Platform Avg Score" : "My Avg Score"}
          color="#00d4de"
        />
        <StatCard
          icon="✅"
          value={isAdmin
            ? (adminStats?.risk_distribution?.Low ?? "—")
            : (myRiskCounts.Low ?? 0)}
          label="Low Risk"
          color={RISK_COLORS.Low}
        />
        <StatCard
          icon="🔴"
          value={isAdmin
            ? ((adminStats?.risk_distribution?.High ?? 0) + (adminStats?.risk_distribution?.Critical ?? 0))
            : ((myRiskCounts.High ?? 0) + (myRiskCounts.Critical ?? 0))}
          label="High / Critical"
          color={RISK_COLORS.Critical}
          sub={latestRisk ? `Latest: ${latestRisk}` : undefined}
        />
      </div>

      {/* ── User risk breakdown strip (non-admin, if has data) ── */}
      {!isAdmin && total > 0 && (
        <div className="dash-risk-strip mb-16">
          <span className="dash-risk-strip__label">My Risk Breakdown:</span>
          {["Critical", "High", "Medium", "Low"].map(r => (
            myRiskCounts[r] ? (
              <span
                key={r}
                className="dash-risk-pill"
                style={{
                  background: `${riskColor(r)}18`,
                  border: `1px solid ${riskColor(r)}44`,
                  color: riskColor(r),
                }}
              >
                {r}: <strong>{myRiskCounts[r]}</strong>
              </span>
            ) : null
          ))}
          <Link to="/history" className="dash-risk-strip__link">View all →</Link>
        </div>
      )}

      {/* ── Charts row 1: Radar + (admin: Pie | user: NIST legend) ── */}
      <div className="grid-2 mb-16">
        <div className="card">
          <h3 className="dash-section-title">
            🛡 {isAdmin ? "NIST CSF Avg Scores (All)" : "My NIST CSF Scores"}
          </h3>
          <NistRadar data={radarData} />
          {/* NIST domain score row */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px 16px", marginTop: 8, justifyContent:"center" }}>
            {radarData.map(d => (
              <div key={d.domain} style={{ display:"flex", alignItems:"center", gap: 6, fontSize: 11, color:"#8b949e" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: NIST_COLORS[d.domain] }} />
                {d.domain}: <strong style={{ color:"#e6edf3" }}>{d.score}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Admin: risk pie | User: per-domain bar */}
        {/* Admin sees a pie chart of risk level distribution; users see their NIST domain scores as a bar chart*/}
        {isAdmin ? (
          <div className="card">
            <h3 className="dash-section-title">🎯 Risk Level Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    activeIndex={activeIdx}
                    activeShape={ActivePieShape}
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    dataKey="value"
                    onMouseEnter={(_, idx) => setActive(idx)}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                    formatter={(v, n) => [v, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No assessments yet" />}
          </div>
        ) : (
          <div className="card">
            <h3 className="dash-section-title">📊 My Domain Scores</h3>
            {total > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={radarData}
                  barSize={36}
                  margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#30363d" strokeDasharray="3 3" />
                  <XAxis dataKey="domain" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                    labelStyle={{ color: "#e6edf3" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(v) => [`${v}/10`, "Avg Score"]}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}
                    label={{ position: "top", fill: "#8b949e", fontSize: 11 }}>
                    {radarData.map((entry, i) => (
                      <Cell key={i} fill={Object.values(NIST_COLORS)[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Submit an assessment first" />}
          </div>
        )}
      </div>

      {/* ── Admin: Risk bar + Sector bar ── */}
      {/* Admin-only charts: risk count by level and assessments by sector */}
      {isAdmin && adminStats && (
        <div className="grid-2 mb-16">
          <div className="card">
            <h3 className="dash-section-title">📊 Risk Count by Level</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={riskBarData} barSize={36} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#30363d" strokeDasharray="3 3" />
                <XAxis dataKey="level" tick={{ fill: "#8b949e", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                  labelStyle={{ color: "#e6edf3" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(v) => [v, "Assessments"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}
                  label={{ position: "top", fill: "#8b949e", fontSize: 11 }}>
                  {riskBarData.map((entry) => (
                    <Cell key={entry.level} fill={RISK_COLORS[entry.level] || "#58a6ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="dash-section-title">🏭 Assessments by Sector</h3>
            {sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={sectorData}
                  layout="vertical"
                  barSize={16}
                  margin={{ top: 5, right: 30, bottom: 5, left: 10 }}
                >
                  <CartesianGrid horizontal={false} stroke="#30363d" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill:"#6e7681", fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="sector" width={100} tick={{ fill:"#8b949e", fontSize:10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                    labelStyle={{ color: "#e6edf3" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(v) => [v, "Assessments"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {sectorData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No sector data" />}
          </div>
        </div>
      )}

      {/* ── Score trend (all users) ── */}
      <div className="card mb-16">
        <h3 className="dash-section-title">
          📉 {isAdmin ? `Score Trend — All (Last ${Math.min(trendData.length, 12)})` : `My Score Trend (Last ${Math.min(trendData.length, 12)})`}
        </h3>
        <ScoreTrend data={trendData} />
      </div>

      {/* ── Recent assessments table ── */}
      <div className="card mb-16">
        <div className="flex-between mb-16">
          <h3 className="dash-section-title">
            {isAdmin ? "Recent Assessments" : "My Recent Assessments"}
          </h3>
          <Link to="/history" className="btn btn-secondary btn-sm">View All →</Link>
        </div>

        {recentFive.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h3>No assessments yet</h3>
            <p style={{ marginBottom: 16 }}>Submit your first assessment to see results here.</p>
            <Link to="/assessment" className="btn btn-primary">Start Assessment</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Company</th>
                  <th>Sector</th>
                  <th>Score</th>
                  <th>Risk</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentFive.map((a) => {
                  const score   = a.overall_score  ?? a.scores?.overall;
                  const riskLvl = a.risk_level      ?? a.scores?.risk_level;
                  return (
                    <tr key={a.id}>
                      <td>
                        <span style={{
                          fontFamily: "monospace",
                          fontSize: "0.72rem",
                          color: "#00d4de",
                          background: "rgba(0,212,222,.08)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid rgba(0,212,222,.2)",
                        }}>
                          CRA-{String(a.id).padStart(4, "0")}
                        </span>
                      </td>
                      <td><strong>{a.company_name}</strong></td>
                      <td className="text-muted">{a.sector}</td>
                      <td>
                        <div className={`score-ring ${getRiskClass(riskLvl)}`}>
                          {score != null ? (+score).toFixed(1) : "—"}
                        </div>
                      </td>
                      <td>
                        <span className={getBadgeClass(riskLvl)}>{riskLvl ?? "N/A"}</span>
                      </td>
                      <td className="text-muted">{fmtDate(a.created_at)}</td>
                      <td>
                        <Link to={`/results/${a.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
       {/* Quick action cards for common tasks: new assessment, history, results, demo, admin links */}
      <div className="dash-quick-actions">
        <Link to="/assessment" className="dash-action-card">
          <span className="dash-action-icon">📋</span>
          <strong>New Assessment</strong>
          <span className="text-muted">Run a cybersecurity evaluation</span>
        </Link>
        <Link to="/history" className="dash-action-card">
          <span className="dash-action-icon">📂</span>
          <strong>Assessment History</strong>
          <span className="text-muted">Browse & filter all past runs</span>
        </Link>
        <Link to="/results" className="dash-action-card">
          <span className="dash-action-icon">📊</span>
          <strong>Latest Results</strong>
          <span className="text-muted">Scores + recommendations</span>
        </Link>
        <Link to="/crypto-demo" className="dash-action-card">
          <span className="dash-action-icon">🔐</span>
          <strong>ECDH Demo</strong>
          <span className="text-muted">Live encryption demo</span>
        </Link>
        {isAdmin && (
          <Link to="/admin/users" className="dash-action-card">
            <span className="dash-action-icon">👥</span>
            <strong>Manage Users</strong>
            <span className="text-muted">Roles and access control</span>
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin/audit" className="dash-action-card">
            <span className="dash-action-icon">📜</span>
            <strong>Audit Log</strong>
            <span className="text-muted">System activity history</span>
          </Link>
        )}
      </div>
    </div>
  );
}
