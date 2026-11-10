/**
 * CyberRAT — Comparative Benchmark Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Shows user's latest assessment score vs:
 *   - Irish SME all-sector average (4.4)
 *   - User's own sector average (from MTU/NCSC 2025)
 *   - All sector averages side-by-side
 *   - Percentile ranking among Irish SMEs
 *   - Control-level comparison: user vs Irish average adoption
 *
 * Data source: MTU/NCSC Ireland SME Survey 2025 (n=894)
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, LabelList,
  ResponsiveContainer, Tooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line,
} from "recharts";
import { resultsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./BenchmarkPage.css";

/* ── MTU/NCSC 2025 sector data (n=894) ───────────────────────── */
// Source: MTU/NCSC Ireland SME Cybersecurity Survey 2025
const SECTOR_DATA = [
  { sector: "Finance & Banking",     avg: 7.1, risk: "medium",   n: 72  },
  { sector: "Government",            avg: 6.8, risk: "medium",   n: 48  },
  { sector: "Technology",            avg: 6.2, risk: "medium",   n: 134 },
  { sector: "Healthcare",            avg: 5.8, risk: "high",     n: 89  },
  { sector: "Professional Services", avg: 5.5, risk: "high",     n: 112 },
  { sector: "Education",             avg: 5.1, risk: "high",     n: 67  },
  { sector: "Manufacturing",         avg: 4.9, risk: "high",     n: 98  },
  { sector: "Logistics & Transport", avg: 4.7, risk: "high",     n: 83  },
  { sector: "Retail & E-Commerce",   avg: 4.4, risk: "high",     n: 147 },
  { sector: "Other",                 avg: 4.4, risk: "high",     n: 44  },
];

const IRISH_SME_AVG = 4.4; // All-sector weighted average

/* ── Control adoption data (MTU/NCSC 2025) ───────────────────── */
// Each control has a weight (W) in the NIST CSF framework, and adoption % among Irish SMEs.
const CONTROL_DATA = [
  { name: "Cyber Policy",       key: "c7",  adoption: 12, domain: "IDENTIFY", weight: 9  },
  { name: "Incident Response",  key: "c3",  adoption: 22, domain: "RESPOND",  weight: 10 },
  { name: "VPN / Remote",       key: "c10", adoption: 24, domain: "PROTECT",  weight: 7  },
  { name: "Data Backup",        key: "c1",  adoption: 26, domain: "RECOVER",  weight: 10 },
  { name: "Security Training",  key: "c4",  adoption: 26, domain: "PROTECT",  weight: 9  },
  { name: "Network Security",   key: "c8",  adoption: 30, domain: "PROTECT",  weight: 9  },
  { name: "Business Continuity",key: "c5",  adoption: 35, domain: "RECOVER",  weight: 9  },
  { name: "Password Policy",    key: "c6",  adoption: 38, domain: "PROTECT",  weight: 8  },
  { name: "Software Updates",   key: "c9",  adoption: 39, domain: "PROTECT",  weight: 8  },
  { name: "MFA",                key: "c2",  adoption: 39, domain: "PROTECT",  weight: 10 },
];

const DOMAIN_COLORS = {
  IDENTIFY: "#58a6ff",
  PROTECT:  "#3fb950",
  DETECT:   "#d29922",
  RESPOND:  "#f0883e",
  RECOVER:  "#bc8cff",
};

/* ── Helpers ──────────────────────────────────────────────────── */
// Map score to color (green → yellow → orange → red)
function riskColor(score) {
  if (score >= 8) return "#3fb950";
  if (score >= 6) return "#d29922";
  if (score >= 4) return "#f0883e";
  return "#f85149";
}
// Map score to risk label
function riskLabel(score) {
  if (score >= 8) return "Low";
  if (score >= 6) return "Medium";
  if (score >= 4) return "High";
  return "Critical";
}

/** Estimate percentile among Irish SMEs based on score distribution */
// The percentile estimates are derived from the MTU/NCSC 2025 survey distribution:
function estimatePercentile(score) {
  // Derived from MTU/NCSC 2025 distribution:
  // ~12% score ≥8, ~28% score 6-7.9, ~40% score 4-5.9, ~20% score <4
  // This is a rough estimate and may not be precise.
  if (score >= 9.5) return 99;
  if (score >= 9.0) return 97;
  if (score >= 8.5) return 95;
  if (score >= 8.0) return 88;
  if (score >= 7.5) return 82;
  if (score >= 7.0) return 76;
  if (score >= 6.5) return 66;
  if (score >= 6.0) return 58;
  if (score >= 5.5) return 50;
  if (score >= 5.0) return 42;
  if (score >= 4.5) return 34;
  if (score >= 4.0) return 26;
  if (score >= 3.5) return 18;
  if (score >= 3.0) return 12;
  if (score >= 2.0) return 7;
  return 3;
}

/* ── Score gauge ──────────────────────────────────────────────── */
// Displays a circular gauge for a score (0-10) with color coding and label
function ScoreGauge({ score, label, sub, highlight }) {
  const pct   = (score / 10) * 100;
  const color = riskColor(score);
  // The gauge is a circular SVG with a stroke-dasharray to represent the percentage
  return (
    <div className={`bm-gauge ${highlight ? "bm-gauge--highlight" : ""}`}>
      <div className="bm-gauge__ring" style={{ "--pct": pct, "--color": color }}>
        <svg viewBox="0 0 80 80" className="bm-gauge__svg">
          <circle cx="40" cy="40" r="34" className="bm-gauge__track" />
          <circle
            cx="40" cy="40" r="34"
            className="bm-gauge__fill"
            style={{
              stroke: color,
              strokeDasharray: `${(pct / 100) * 213.6} 213.6`,
            }}
          />
        </svg>
        <span className="bm-gauge__val" style={{ color }}>{score}</span>
      </div>
      <div className="bm-gauge__label">{label}</div>
      {sub && <div className="bm-gauge__sub">{sub}</div>}
    </div>
  );
}

/* ── Custom bar label ─────────────────────────────────────────── */
// Only show label for user's sector bar
const CustomBarLabel = ({ x, y, width, value, isUser }) => {
  if (!isUser) return null;
  return (
    <text x={x + width / 2} y={y - 6} fill="#00d4de" textAnchor="middle" fontSize={11} fontWeight={700}>
      ▼ You
    </text>
  );
};

/* ── Main page ────────────────────────────────────────────────── */
// BenchmarkPage component
export default function BenchmarkPage() {
  const { user }                     = useAuth();
  const [results,      setResults]   = useState([]);
  const [loading,      setLoading]   = useState(true);
  const [error,        setError]     = useState("");
  const [activeTab,    setActiveTab] = useState("overview"); // overview | controls | history
  const [selectedId,   setSelectedId] = useState(null);     // selected assessment id
  
  // Fetch all results on mount
  useEffect(() => {
    resultsAPI.getAll()
      .then((r) => {
        const data = r.data.results || r.data.assessments || [];
        setResults(data);
        // Default to the latest assessment
        if (data.length > 0) {
          const latest = data.reduce((a, b) =>
            new Date(a.created_at) > new Date(b.created_at) ? a : b
          );
          setSelectedId(latest.id);
        }
      })
      .catch(() => setError("Failed to load assessment data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bm-page">
      <div className="bm-loading"><div className="spinner" /> Loading benchmark data…</div>
    </div>
  );
  
  if (error) return (
    <div className="bm-page">
      <div className="bm-error">{error}</div>
    </div>
  );

  if (results.length === 0) return (
    <div className="bm-page">
      <div className="bm-empty">
        <div className="bm-empty__icon">📊</div>
        <h3>No Assessments Yet</h3>
        <p>Complete an assessment to see how you compare to Irish SMEs.</p>
        <Link to="/assessment" className="btn btn-primary">Start Assessment</Link>
      </div>
    </div>
  );

  // Selected result (or latest as fallback)
  
  const sortedResults = [...results].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const latest = selectedId
    ? results.find((r) => r.id === selectedId) || sortedResults[0]
    : sortedResults[0];

  const score     = parseFloat(latest.overall_score ?? latest.scores?.overall ?? 0);
  const sector    = latest.sector || "Other";
  const sectorRow = SECTOR_DATA.find(
    (s) => s.sector.toLowerCase() === sector.toLowerCase()
  ) || SECTOR_DATA[SECTOR_DATA.length - 1];
  const percentile = estimatePercentile(score);
  const vsSMEAvg   = +(score - IRISH_SME_AVG).toFixed(2);
  const vsSector   = +(score - sectorRow.avg).toFixed(2);

  /* ── Sector bar chart data: inject user score ── */
  const sectorBarData = SECTOR_DATA.map((s) => ({
    ...s,
    isUser: s.sector.toLowerCase() === sector.toLowerCase(),
    userScore: s.sector.toLowerCase() === sector.toLowerCase() ? score : null,
  })).sort((a, b) => b.avg - a.avg);

  /* ── Radar: user domain scores vs sector ── */
  const domainKeys = ["identify", "protect", "detect", "respond", "recover"];
  const scores     = latest.scores || {};
  const domainScores = scores.domain_scores || scores;

  const radarData = domainKeys.map((k) => ({
    domain:  k.charAt(0).toUpperCase() + k.slice(1),
    user:    parseFloat(domainScores[k] ?? 0),
    sector:  parseFloat((sectorRow.avg * 0.9).toFixed(1)), // estimated sector domain avg
    smeAvg:  parseFloat((IRISH_SME_AVG * 0.9).toFixed(1)),
  }));

  /* ── Score trend with benchmarks ── */
  const trendData = [...results]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-12)
    .map((r, i) => ({
      name:      `A${String(r.id).padStart(3, "0")}`,
      score:     parseFloat(r.overall_score ?? r.scores?.overall ?? 0),
      smeAvg:    IRISH_SME_AVG,
      sector:    sectorRow.avg,
      isLatest:  r.id === latest.id,
    }));

  function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-IE", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }
  // Render the benchmark page
  return (
    <div className="bm-page">
      {/* ── Header ── */}
      <div className="bm-header">
        <div>
          <h1 className="bm-title">📊 Comparative Benchmark</h1>
          <p className="bm-subtitle">
            Your cybersecurity score vs Irish SME sector averages ·{" "}
            <span className="bm-source">MTU/NCSC Ireland 2025, n=894</span>
          </p>
        </div>
        <Link to={`/results/${latest.id}`} className="btn btn-secondary btn-sm">
          View Full Report →
        </Link>
      </div>

      {/* ── Assessment Selector ── */}
      {sortedResults.length > 1 && (
        <div className="bm-selector">
          <div className="bm-selector__label">Select assessment to benchmark:</div>
          <div className="bm-selector__cards">
            {sortedResults.map((r) => {
              {/* Determine score, risk level, and selection state */}
              const s = parseFloat(r.overall_score ?? r.scores?.overall ?? 0);
              const rl = r.risk_level ?? r.scores?.risk_level ?? riskLabel(s);
              const isSelected = r.id === latest.id;
              return (
                <button
                  key={r.id}
                  className={`bm-sel-card ${isSelected ? "bm-sel-card--active" : ""}`}
                  style={isSelected ? { borderColor: riskColor(s) } : {}}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div className="bm-sel-card__score" style={{ color: riskColor(s) }}>
                    {s.toFixed(2)}/10
                  </div>
                  <div className="bm-sel-card__company">{r.company_name}</div>
                  <div className="bm-sel-card__meta">
                    <span className="bm-sel-card__sector">{r.sector}</span>
                    <span className="bm-sel-card__risk" style={{ color: riskColor(s) }}>
                      {rl} Risk
                    </span>
                  </div>
                  <div className="bm-sel-card__date">{fmtDate(r.created_at)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hero KPIs ── */}
      <div className="bm-kpi-row">
        <ScoreGauge
          score={score}
          label="Your Score"
          sub={`${riskLabel(score)} Risk · ${latest.company_name}`}
          highlight
        />
        <ScoreGauge
          score={IRISH_SME_AVG}
          label="Irish SME Average"
          sub="All sectors (n=894)"
        />
        <ScoreGauge
          score={sectorRow.avg}
          label={`${sector} Average`}
          sub={`Sector benchmark (n≈${sectorRow.n})`}
        />

        <div className="bm-delta-cards">
          <div className={`bm-delta ${vsSMEAvg >= 0 ? "bm-delta--above" : "bm-delta--below"}`}>
            <span className="bm-delta__arrow">{vsSMEAvg >= 0 ? "▲" : "▼"}</span>
            <span className="bm-delta__val">{Math.abs(vsSMEAvg).toFixed(2)}</span>
            <span className="bm-delta__label">vs Irish SME avg</span>
          </div>
          <div className={`bm-delta ${vsSector >= 0 ? "bm-delta--above" : "bm-delta--below"}`}>
            <span className="bm-delta__arrow">{vsSector >= 0 ? "▲" : "▼"}</span>
            <span className="bm-delta__val">{Math.abs(vsSector).toFixed(2)}</span>
            <span className="bm-delta__label">vs {sector}</span>
          </div>
          <div className="bm-delta bm-delta--percentile">
            <span className="bm-delta__arrow">%</span>
            <span className="bm-delta__val">{percentile}</span>
            <span className="bm-delta__label">Percentile rank</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bm-tabs">
        {[
          { key: "overview",  label: "📊 Sector Overview"   },
          { key: "controls",  label: "🔧 Control Comparison" },
          { key: "history",   label: "📈 Score Trend"        },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`bm-tab ${activeTab === key ? "bm-tab--active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Sector Overview ── */}
      {activeTab === "overview" && (
        <div className="bm-panel">
          <div className="bm-panel__title">
            All-Sector Score Comparison — Irish SMEs
            <span className="bm-panel__badge">MTU/NCSC 2025</span>
          </div>
          <p className="bm-panel__desc">
            Your score (cyan line) placed against each sector's average.
            Your sector ({sector}) is highlighted.
          </p>

          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart
              data={sectorBarData}
              layout="vertical"
              barSize={20}
              margin={{ left: 10, right: 60, top: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 10]}
                tick={{ fill: "#6e7681", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}/10`}
              />
              <YAxis
                type="category"
                dataKey="sector"
                width={160}
                tick={({ x, y, payload }) => {
                  const isUser = sectorBarData.find(
                    (s) => s.sector === payload.value
                  )?.isUser;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={4}
                      textAnchor="end"
                      fill={isUser ? "#00d4de" : "#8b949e"}
                      fontSize={11}
                      fontWeight={isUser ? 700 : 400}
                    >
                      {isUser ? `▶ ${payload.value}` : payload.value}
                    </text>
                  );
                }}
              />
              <Tooltip
                contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                formatter={(v, name) => [
                  `${v}/10`,
                  name === "avg" ? "Sector Average" : "Your Score",
                ]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <ReferenceLine x={IRISH_SME_AVG} stroke="#484f58" strokeDasharray="4 2"
                label={{ value: `Irish avg ${IRISH_SME_AVG}`, fill: "#484f58", fontSize: 10, position: "insideTopRight" }}
              />
              {/* Your score reference line */}
              {score !== IRISH_SME_AVG && (
                <ReferenceLine x={score} stroke="#00d4de" strokeDasharray="4 2"
                  label={{ value: `You ${score}`, fill: "#00d4de", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {sectorBarData.map((entry) => (
                  <Cell
                    key={entry.sector}
                    fill={entry.isUser ? "rgba(0,212,222,0.25)" : "rgba(88,166,255,0.15)"}
                    stroke={entry.isUser ? "#00d4de" : "#30363d"}
                    strokeWidth={entry.isUser ? 1.5 : 0}
                  />
                ))}
                <LabelList
                  dataKey="avg"
                  position="right"
                  formatter={(v) => `${v}`}
                  style={{ fill: "#8b949e", fontSize: 11 }}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>

          {/* Sector table */}
          <div className="bm-sector-table-wrap">
            <table className="bm-sector-table">
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Avg Score</th>
                  <th>Risk Level</th>
                  <th>Sample (n)</th>
                  <th>vs Your Score</th>
                </tr>
              </thead>
              <tbody>
              {/* Sort sectors by avg score descending, then map to table rows */}
                {SECTOR_DATA.sort((a, b) => b.avg - a.avg).map((s) => {
                  const diff    = +(score - s.avg).toFixed(2);
                  const isUser  = s.sector.toLowerCase() === sector.toLowerCase();
                  return (
                    <tr key={s.sector} className={isUser ? "bm-table-row--highlight" : ""}>
                      <td>{isUser ? <strong style={{ color: "#00d4de" }}>▶ {s.sector}</strong> : s.sector}</td>
                      <td style={{ fontWeight: 600 }}>{s.avg}/10</td>
                      <td>
                        <span className={`badge badge-${s.risk}`} style={{ fontSize: 10 }}>
                          {s.risk.charAt(0).toUpperCase() + s.risk.slice(1)}
                        </span>
                      </td>
                      <td style={{ color: "#484f58" }}>{s.n}</td>
                      <td style={{ color: diff > 0 ? "#3fb950" : diff < 0 ? "#f85149" : "#8b949e", fontWeight: 600 }}>
                        {diff > 0 ? `+${diff} ▲` : diff < 0 ? `${diff} ▼` : "Equal"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Control Comparison ── */}
      {activeTab === "controls" && (
        <div className="bm-panel">
          <div className="bm-panel__title">
            Control Adoption — Your Status vs Irish SME Average
            <span className="bm-panel__badge">MTU/NCSC 2025</span>
          </div>
          <p className="bm-panel__desc">
            Each bar shows what % of Irish SMEs have that control in place.
            Your assessment answers determine your own status per control.
          </p>

          <div className="bm-controls-grid">
            {CONTROL_DATA.map((ctrl) => {
              const domColor   = DOMAIN_COLORS[ctrl.domain] || "#58a6ff";
              const smeAdoption = ctrl.adoption;
              const gap         = 100 - smeAdoption;
              return (
                <div key={ctrl.key} className="bm-ctrl-card">
                  <div className="bm-ctrl-card__header">
                    <span className="bm-ctrl-card__name">{ctrl.name}</span>
                    <span
                      className="bm-ctrl-card__domain"
                      style={{ color: domColor, borderColor: domColor + "44", background: domColor + "14" }}
                    >
                      {ctrl.domain}
                    </span>
                  </div>

                  {/* Adoption bar */}
                  <div className="bm-ctrl-bar-wrap">
                    <span className="bm-ctrl-bar-label">Irish SMEs</span>
                    <div className="bm-ctrl-bar-track">
                      <div
                        className="bm-ctrl-bar-fill"
                        style={{
                          width: `${smeAdoption}%`,
                          background: smeAdoption < 25 ? "#f85149" : smeAdoption < 35 ? "#d29922" : "#3fb950",
                        }}
                      />
                    </div>
                    <span className="bm-ctrl-bar-pct">{smeAdoption}%</span>
                  </div>

                  {/* Gap callout */}
                  <div className="bm-ctrl-gap">
                    <span className="bm-ctrl-gap__icon">⚠</span>
                    <span>{gap}% of Irish SMEs lack this control</span>
                  </div>

                  <div className="bm-ctrl-weight">
                    Framework weight: <strong>W={ctrl.weight}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Radar overlay: user vs sector vs SME avg */}
          <div className="bm-radar-wrap">
            <div className="bm-panel__title" style={{ marginTop: 24 }}>
              NIST Domain Scores — You vs Sector vs Irish SME Average
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#21262d" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: "#8b949e", fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 9 }} />
                <Radar name="You" dataKey="user" stroke="#00d4de" fill="#00d4de" fillOpacity={0.15} strokeWidth={2} />
                <Radar name={sector} dataKey="sector" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
                <Radar name="Irish SME Avg" dataKey="smeAvg" stroke="#484f58" fill="transparent" strokeWidth={1} strokeDasharray="2 2" />
                <Tooltip
                  contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                  formatter={(v, name) => [`${v}/10`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="bm-radar-legend">
              <span className="bm-legend-item bm-legend-item--you">━ You</span>
              <span className="bm-legend-item bm-legend-item--sector">╌ {sector}</span>
              <span className="bm-legend-item bm-legend-item--sme">╌ Irish SME Avg</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Score Trend ── */}
      {activeTab === "history" && (
        <div className="bm-panel">
          <div className="bm-panel__title">
            Your Score Trend vs Benchmarks
          </div>
          <p className="bm-panel__desc">
            {results.length > 1
              ? `Showing all ${Math.min(results.length, 12)} assessments with sector and SME average reference lines.`
              : "Only one assessment so far. Submit more to see your trend."}
          </p>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trendData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                formatter={(v, name) => [
                  `${v}/10`,
                  name === "score" ? "Your Score" : name === "smeAvg" ? "Irish SME Avg" : `${sector} Avg`,
                ]}
              />
              {/* Reference lines */}
              <ReferenceLine y={IRISH_SME_AVG} stroke="#484f58" strokeDasharray="4 2"
                label={{ value: `SME avg ${IRISH_SME_AVG}`, fill: "#484f58", fontSize: 10, position: "right" }}
              />
              <ReferenceLine y={sectorRow.avg} stroke="#58a6ff" strokeDasharray="4 2"
                label={{ value: `${sector} ${sectorRow.avg}`, fill: "#58a6ff", fontSize: 10, position: "right" }}
              />
              {/* Score line */}
              <Line
                type="monotone"
                dataKey="score"
                stroke="#00d4de"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return payload.isLatest
                    ? <circle key={payload.name} cx={cx} cy={cy} r={6} fill="#00d4de" stroke="#0d1117" strokeWidth={2} />
                    : <circle key={payload.name} cx={cx} cy={cy} r={3} fill="#00d4de" />;
                }}
                activeDot={{ r: 7, fill: "#00d4de" }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Percentile context */}
          <div className="bm-percentile-card">
            <div className="bm-percentile-card__left">
              <div className="bm-percentile-card__pct">{percentile}<sup>th</sup></div>
              <div className="bm-percentile-card__label">Percentile</div>
            </div>
            <div className="bm-percentile-card__right">
              <p>
                Your score of <strong style={{ color: riskColor(score) }}>{score}/10</strong> places you
                in the <strong>{percentile}th percentile</strong> among Irish SMEs surveyed in the
                MTU/NCSC 2025 study (n=894).
              </p>
              <p>
                {percentile >= 75
                  ? "🏆 You are in the top quartile of Irish SME cybersecurity maturity."
                  : percentile >= 50
                  ? "📈 You are above the Irish SME median. Continue improving to reach the top quartile."
                  : percentile >= 25
                  ? "⚠ You are below the Irish SME median. Priority improvements needed."
                  : "🔴 You are in the bottom quartile. Immediate action is strongly recommended."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="bm-footer">
        <span>📄 Source: MTU/NCSC Ireland SME Cybersecurity Survey 2025 (n=894 Irish SMEs)</span>
        <Link to="/results" className="bm-footer__link">← All Assessments</Link>
      </div>
    </div>
  );
}
