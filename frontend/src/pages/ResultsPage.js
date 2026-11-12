/**
 * CyberRAT v2 — Results Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Two views:
 *   /results          → list of all assessments
 *   /results/:id      → detailed result with charts + recommendations
 */

import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, LabelList,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import toast from "react-hot-toast";
import { resultsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import RecommendationsPanel from "../components/RecommendationsPanel";
import "./ResultsPage.css";

/* ────────────────────────────────────────────────────────────────
   MTU/NCSC Ireland SME Survey 2025 data (n=894)
   Source: CafeBrid_Dataset_v3.xlsx — MTU_Sector_Data sheet
   Used for Irish sector benchmark comparison on results page.
   ──────────────────────────────────────────────────────────────── */
const SECTOR_BENCHMARKS = {
  "Retail & E-Commerce":     4.4,
  "Technology":              6.2,
  "Finance & Banking":       7.1,
  "Healthcare":              5.8,
  "Manufacturing":           4.9,
  "Professional Services":   5.5,
  "Education":               5.1,
  "Government":              6.8,
  "Logistics & Transport":   4.7,
  "Other":                   4.4,
};

// MTU/NCSC 2025 SME control adoption rates — all Irish sectors (n=894)
const CONTROL_ADOPTION = [
  { control: "Automated Backup",    adoption: 26, criterion: "C1" },
  { control: "MFA",                 adoption: 39, criterion: "C2" },
  { control: "Incident Response",   adoption: 22, criterion: "C3" },
  { control: "Security Training",   adoption: 26, criterion: "C4" },
  { control: "Business Continuity", adoption: 35, criterion: "C5" },
  { control: "Password Policy",     adoption: 38, criterion: "C6" },
  { control: "Cyber Policy",        adoption: 12, criterion: "C7" },
  { control: "Network Security",    adoption: 30, criterion: "C8" },
  { control: "SW Updates",          adoption: 39, criterion: "C9" },
  { control: "VPN/Remote",          adoption: 24, criterion: "C10" },
];

// Café Bríd hypothetical case study progression — from dataset Sheet 4
// A003 = all 10 controls Yes(5) → weighted_sum=89 → 89/89×10 = 10.00
const CASE_STUDY_PROGRESSION = [
  { stage: "A001 – Baseline",       score: 3.93,  label: "3.93",  fill: "#f85149" },
  { stage: "A002 – Partial Fix",    score: 6.07,  label: "6.07",  fill: "#d29922" },
  { stage: "A003 – Full Controls",  score: 10.00, label: "10.00", fill: "#3fb950" },
];

/* ────────────────────────────────────────────────────────────── */
/*  Results LIST view                                             */
/* ────────────────────────────────────────────────────────────── */
const SECTORS = [
  "Retail & E-Commerce", "Technology", "Finance & Banking", "Healthcare",
  "Manufacturing", "Professional Services", "Education", "Government",
  "Logistics & Transport", "Other",
];
const SIZES = ["1-9", "10-49", "50-249", "250+"];

function ResultsList() {
  const { isAdmin, user }              = useAuth();
  const [assessments, setAssessments]  = useState([]);
  const [loading, setLoading]          = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId]      = useState(null);
  const [editForm, setEditForm]        = useState({});
  const [saving, setSaving]            = useState(false);

  // Admin can edit/delete any; analyst can edit/delete their own only
  const canEdit   = (a) => isAdmin || a.user_id === user?.id;
  const canDelete = (a) => isAdmin || a.user_id === user?.id;

  const loadAll = () => {
    setLoading(true);
    resultsAPI.getAll()
      .then((r) => setAssessments(r.data.results || r.data.assessments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const handleDelete = async (id) => {
    setConfirmDeleteId(null);
    try {
      await resultsAPI.deleteResult(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Assessment deleted.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to delete.");
    }
  };

  const openEdit = (a, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(a.id);
    setEditForm({ company_name: a.company_name, sector: a.sector, company_size: a.company_size });
  };

  const handleEditSave = async (id) => {
    setSaving(true);
    try {
      const res = await resultsAPI.updateResult(id, editForm);
      setAssessments((prev) =>
        prev.map((a) => a.id === id ? { ...a, ...res.data.assessment } : a)
      );
      toast.success("Assessment updated.");
      setEditingId(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /> Loading results…</div>;

  return (
    <div className="page">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Assessment Results</h1>
          <p className="page-subtitle">{assessments.length} assessment(s) on record</p>
        </div>
        <Link to="/assessment" className="btn btn-primary">+ New Assessment</Link>
      </div>

      {assessments.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <h3>No results yet</h3>
            <p style={{ marginBottom: 16 }}>Submit an assessment to see results here.</p>
            <Link to="/assessment" className="btn btn-primary">Start Assessment</Link>
          </div>
        </div>
      ) : (
        <div className="results-grid">
          {assessments.map((a) => (
            <div key={a.id} className="result-card-wrap">
              {/* ── Inline edit form (admin or owner) ── */}
              {canEdit(a) && editingId === a.id ? (
                <div className="result-card result-card--editing">
                  <div className="edit-form-title">✏ Edit Assessment #{a.id}</div>
                  <div className="form-group">
                    <label className="form-label-sm">Company Name</label>
                    <input
                      className="form-control form-control-sm"
                      value={editForm.company_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label-sm">Sector</label>
                    <select
                      className="form-control form-control-sm"
                      value={editForm.sector}
                      onChange={(e) => setEditForm((f) => ({ ...f, sector: e.target.value }))}
                    >
                      {SECTORS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label-sm">Company Size</label>
                    <select
                      className="form-control form-control-sm"
                      value={editForm.company_size}
                      onChange={(e) => setEditForm((f) => ({ ...f, company_size: e.target.value }))}
                    >
                      {SIZES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="edit-form-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleEditSave(a.id)} disabled={saving}>
                      {saving ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "Save"}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <Link to={`/results/${a.id}`} className="result-card">
                  <div className="result-card__header">
                    <div>
                      <div className="result-card__company">{a.company_name}</div>
                      <div className="result-card__meta">{a.sector} · {a.company_size} employees</div>
                    </div>
                    <span className={`badge badge-${(a.scores?.risk_level || "critical").toLowerCase()}`}>
                      {a.scores?.risk_level ?? "N/A"}
                    </span>
                  </div>
                  <div className="result-card__score-row">
                    <div className={`score-ring score-ring--lg score-${(a.scores?.risk_level || "critical").toLowerCase()}`}>
                      {a.scores?.overall ?? "—"}
                    </div>
                    <div className="result-card__score-label">
                      <strong>{a.scores?.overall ?? "—"} / 10</strong>
                      <span className="text-muted">Framework Score</span>
                    </div>
                  </div>
                  <div className="result-card__date text-muted">
                    {new Date(a.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </Link>
              )}

              {/* ── Edit/Delete buttons (admin or owner) ── */}
              {(canEdit(a) || canDelete(a)) && editingId !== a.id && (
                <div className="result-card-admin-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={(e) => openEdit(a, e)}
                    title="Edit assessment metadata"
                  >
                    ✏ Edit
                  </button>
                  {confirmDeleteId === a.id ? (
                    <span className="confirm-delete-inline">
                      Delete?&nbsp;
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Yes</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={(e) => { e.preventDefault(); setConfirmDeleteId(a.id); }}
                      title="Delete assessment"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Result DETAIL view                                            */
/* ────────────────────────────────────────────────────────────── */
const DOMAIN_COLORS = {
  identify: "#58a6ff",
  protect:  "#3fb950",
  detect:   "#d29922",
  respond:  "#f0883e",
  recover:  "#bc8cff",
};

function ResultDetail({ id }) {
  const { isAdmin, user }     = useAuth();
  const navigate              = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm]           = useState({});
  const [editSaving, setEditSaving]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    resultsAPI.getResult(id)
      .then((r) => {
        setData(r.data);
        // Load company history for trend comparison
        const company = r.data?.assessment?.company_name;
        if (company) {
          resultsAPI.getCompanyHistory(company)
            .then((hr) => setCompanyHistory(hr.data?.history || []))
            .catch(() => {})
            .finally(() => setHistoryLoaded(true));
        } else {
          setHistoryLoaded(true);
        }
      })
      .catch((e) => setError(e.response?.data?.message || "Failed to load result."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      const res = await resultsAPI.updateResult(id, editForm);
      setData((prev) => ({ ...prev, assessment: { ...prev.assessment, ...res.data.assessment } }));
      toast.success("Assessment updated.");
      setShowEditModal(false);
    } catch (e) {
      toast.error(e.response?.data?.message || "Update failed.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await resultsAPI.deleteResult(id);
      toast.success("Assessment deleted.");
      navigate("/results");
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed.");
    }
  };

  const [pdfExporting,    setPdfExporting]    = useState(false);
  const [companyHistory,  setCompanyHistory]  = useState([]);
  const [historyLoaded,   setHistoryLoaded]   = useState(false);
  const handleExportPdf = async () => {
    setPdfExporting(true);
    try {
      const res = await resultsAPI.exportPdf(id);
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `CyberRAT_Assessment_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF downloaded!");
    } catch (e) {
      toast.error("PDF export failed.");
    } finally {
      setPdfExporting(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /> Loading result…</div>;
  if (error)   return <div className="page"><div className="card"><p style={{ color: "var(--accent-red)" }}>{error}</p></div></div>;
  if (!data?.assessment) return <div className="page"><div className="card"><p className="text-muted">No data found.</p></div></div>;

  // Backend returns { assessment: { id, scores: { overall, risk_level, identify, ... }, recommendations, ... } }
  const assessment = data.assessment;
  const scores     = assessment.scores || {};
  const domainKeys = ["identify", "protect", "detect", "respond", "recover"];

  // Recommendations: either array from recommendations_list or split the pipe-separated string
  const recommendations = assessment.recommendations_list
    || (assessment.recommendations ? assessment.recommendations.split(" | ") : []);

  // Support both domain_scores nested object and flat keys on scores
  const domainScores = scores.domain_scores || scores;

  const radarData = domainKeys.map((key) => ({
    domain: key.charAt(0).toUpperCase() + key.slice(1),
    score:  parseFloat(domainScores[key] ?? 0),
  }));

  const barData = domainKeys.map((key) => ({
    name:  key.charAt(0).toUpperCase() + key.slice(1),
    score: parseFloat(domainScores[key] ?? 0),
    fill:  DOMAIN_COLORS[key] || "#58a6ff",
  }));

  const riskClass = (scores.risk_level || "critical").toLowerCase();
  const sectorBenchmark = SECTOR_BENCHMARKS[assessment.sector] ?? 4.4;
  const overallScore = parseFloat(scores.overall ?? 0);
  const vsIrishAvg = overallScore - 4.4;   // vs Irish SME average (all sectors)
  const vsSector   = overallScore - sectorBenchmark;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="flex-between" style={{ alignItems: "flex-start" }}>
          <div>
            <Link to="/results" className="back-link">← All Results</Link>
            <h1 className="page-title">{assessment.company_name}</h1>
            <p className="page-subtitle">
              {assessment.sector} · {assessment.company_size} employees ·{" "}
              {new Date(assessment.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Admin or owner action bar */}
          {(isAdmin || assessment.user_id === user?.id) && (
            <div className="detail-admin-actions">
              <button
                className="btn btn-sm btn-accent"
                onClick={handleExportPdf}
                disabled={pdfExporting}
                title="Download PDF report"
              >
                {pdfExporting ? "⏳ Exporting…" : "📄 Export PDF"}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setEditForm({ company_name: assessment.company_name, sector: assessment.sector, company_size: assessment.company_size });
                  setShowEditModal(true);
                }}
              >
                ✏ Edit
              </button>
              {confirmDelete ? (
                <span className="confirm-delete-inline">
                  Delete?&nbsp;
                  <button className="btn btn-sm btn-danger" onClick={handleDelete}>Yes, delete</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setConfirmDelete(false)}>No</button>
                </span>
              ) : (
                <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal (admin or owner) ── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">✏ Edit Assessment #{assessment.id}</h3>
            <p className="modal-subtitle">Scores and answers are immutable — only metadata is editable.</p>

            <div className="form-group">
              <label className="form-label-sm">Company Name</label>
              <input
                className="form-control"
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label-sm">Sector</label>
              <select
                className="form-control"
                value={editForm.sector}
                onChange={(e) => setEditForm((f) => ({ ...f, sector: e.target.value }))}
              >
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label-sm">Company Size</label>
              <select
                className="form-control"
                value={editForm.company_size}
                onChange={(e) => setEditForm((f) => ({ ...f, company_size: e.target.value }))}
              >
                {SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : "Save Changes"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Score hero ── */}
      <div className="score-hero">
        <div className={`score-hero__ring score-${riskClass}`}>{scores.overall ?? "—"}</div>
        <div className="score-hero__details">
          <span className={`badge badge-${riskClass} badge-lg`}>{scores.risk_level || "Unknown"} Risk</span>
          <p className="score-hero__weighted">
            Framework Score: {scores.overall ?? "—"} / 10
          </p>
          <div className="benchmark-chips">
            <span className={`benchmark-chip ${vsIrishAvg >= 0 ? "benchmark-chip--above" : "benchmark-chip--below"}`}>
              {vsIrishAvg >= 0 ? "▲" : "▼"} {Math.abs(vsIrishAvg).toFixed(2)} vs Irish SME avg (4.4)
            </span>
            <span className={`benchmark-chip ${vsSector >= 0 ? "benchmark-chip--above" : "benchmark-chip--below"}`}>
              {vsSector >= 0 ? "▲" : "▼"} {Math.abs(vsSector).toFixed(2)} vs {assessment.sector} avg ({sectorBenchmark})
            </span>
          </div>
          <p className="benchmark-source">Source: MTU/NCSC Ireland SME Survey 2025, n=894</p>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid-2 mb-16">
        <div className="card">
          <h3 className="dash-section-title">NIST CSF Domain Scores</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#30363d" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: "#8b949e", fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 10 }} />
              <Radar dataKey="score" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                formatter={(v) => [`${v}/10`, "Score"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="dash-section-title">Score per Domain</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barSize={36}>
              <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6 }}
                formatter={(v) => [`${v}/10`, "Score"]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="score" radius={[4,4,0,0]}>
                {barData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="card mb-16">
        <h3 className="dash-section-title">🎯 Security Recommendations</h3>
        <p className="card-desc" style={{ marginBottom: 16 }}>
          NIST CSF-aligned recommendations based on your assessment scores and Irish SME control adoption data.
          Click any card to expand action steps.
        </p>
        <RecommendationsPanel recommendations={recommendations} />
      </div>

      {/* ── Irish SME Benchmark Panel ── */}
      <div className="card mb-16">
        <h3 className="dash-section-title">🇮🇪 Irish SME Benchmark — MTU/NCSC 2025 (n=894)</h3>
        <p className="card-desc">
          How does this score compare to verified Irish SME cybersecurity data?
          Below shows real control adoption rates across 894 surveyed Irish SMEs.
        </p>

        <div className="grid-2 mt-12">
          {/* Control adoption chart */}
          <div>
            <h4 className="chart-sub-title">Control Adoption Rates — Irish SMEs (%)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={CONTROL_ADOPTION} layout="vertical" barSize={14} margin={{ left: 10, right: 30 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6e7681", fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="control" width={110} tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                  formatter={(v, name, props) => [`${v}% of Irish SMEs`, props.payload.criterion]}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <ReferenceLine x={50} stroke="#30363d" strokeDasharray="3 3" />
                <Bar dataKey="adoption" radius={[0, 3, 3, 0]}>
                  {CONTROL_ADOPTION.map((entry) => (
                    <Cell key={entry.criterion} fill={entry.adoption < 30 ? "#f85149" : entry.adoption < 40 ? "#d29922" : "#3fb950"} />
                  ))}
                  <LabelList dataKey="adoption" position="right" formatter={(v) => `${v}%`} style={{ fill: "#8b949e", fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="chart-footnote">Red = &lt;30% adoption | Yellow = 30-39% | Green = ≥40%. Source: MTU/NCSC Ireland 2025</p>
          </div>

          {/* Café Bríd hypothetical case study progression */}
          <div>
            <h4 className="chart-sub-title">Café Bríd (Hypothetical) — Framework Score Progression (Case Study)</h4>
            <p className="card-desc-sm">
              Real-world SME case study: score progression as controls were implemented.
              A001 = baseline (same as Irish Retail avg 4.4). A003 = full controls applied.
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CASE_STUDY_PROGRESSION} barSize={48}>
                <XAxis dataKey="stage" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={overallScore} stroke="#58a6ff" strokeDasharray="4 2"
                  label={{ value: `Your score: ${overallScore}`, fill: "#58a6ff", fontSize: 10, position: "right" }} />
                <Tooltip
                  contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => [`${v}/10`, "Framework Score"]}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="score" radius={[4,4,0,0]}>
                  {CASE_STUDY_PROGRESSION.map((e) => <Cell key={e.stage} fill={e.fill} />)}
                  <LabelList dataKey="label" position="top" style={{ fill: "#e6edf3", fontSize: 12, fontWeight: "bold" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="case-study-legend">
              <div className="case-study-legend-item">
                <span className="dot dot--red" /> A001 Baseline (3.93): 4 controls in place
              </div>
              <div className="case-study-legend-item">
                <span className="dot dot--yellow" /> A002 Partial (6.07): Added MFA + Training
              </div>
              <div className="case-study-legend-item">
                <span className="dot dot--green" /> A003 Full (10.00): All 10 controls active
              </div>
            </div>

            <div className="sector-table-wrap mt-12">
              <h5 className="chart-sub-title" style={{ fontSize: 12 }}>Sector Averages — Irish SMEs</h5>
              <table className="sector-table">
                <thead>
                  <tr><th>Sector</th><th>Avg Score</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {Object.entries(SECTOR_BENCHMARKS).map(([sec, avg]) => (
                    <tr key={sec} className={sec === assessment.sector ? "sector-table__row--highlight" : ""}>
                      <td>{sec}</td>
                      <td>{avg}/10</td>
                      <td><span className={`badge badge-${avg >= 8 ? "low" : avg >= 6 ? "medium" : avg >= 4 ? "high" : "critical"}`} style={{ fontSize: 10, padding: "1px 6px" }}>
                        {avg >= 8 ? "Low" : avg >= 6 ? "Medium" : avg >= 4 ? "High" : "Critical"}
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Assessment History / Score Comparison ── */}
      {historyLoaded && companyHistory.length > 1 && (
        <div className="card mb-16">
          <h3 className="dash-section-title">
            📈 Assessment History — {assessment.company_name}
          </h3>
          <p className="card-desc">
            Score progression across {companyHistory.length} assessments for this company.
            Current assessment highlighted.
          </p>

          <div className="grid-2 mt-12">
            {/* Trend line chart */}
            <div>
              <h4 className="chart-sub-title">Overall Score Over Time</h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={companyHistory.map((h, i) => ({
                  name:    `A${String(h.id).padStart(3, "0")}`,
                  score:   parseFloat(h.overall_score ?? 0),
                  date:    new Date(h.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" }),
                  current: h.id === parseInt(id, 10),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
                    formatter={(v, n, p) => [
                      `${v}/10${p.payload.current ? " ← current" : ""}`,
                      "Score"
                    ]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.date ? `${label} · ${payload[0].payload.date}` : label
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#58a6ff"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      return payload.current
                        ? <circle key={payload.name} cx={cx} cy={cy} r={6} fill="#58a6ff" stroke="#0d1117" strokeWidth={2} />
                        : <circle key={payload.name} cx={cx} cy={cy} r={3} fill="#58a6ff" />;
                    }}
                    activeDot={{ r: 7, fill: "#79c0ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Domain comparison table: current vs previous */}
            <div>
              <h4 className="chart-sub-title">Domain Score Comparison</h4>
              {(() => {
                const currentIdx = companyHistory.findIndex((h) => h.id === parseInt(id, 10));
                const prevAssmt  = currentIdx > 0 ? companyHistory[currentIdx - 1] : null;
                const currAssmt  = companyHistory[currentIdx];
                const domains    = ["identify", "protect", "detect", "respond", "recover"];
                if (!prevAssmt) return (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    This is the first assessment for {assessment.company_name}. Submit a follow-up assessment to see score comparisons.
                  </p>
                );
                return (
                  <table className="history-compare-table">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Previous (#{prevAssmt.id})</th>
                        <th>Current (#{currAssmt.id})</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((d) => {
                        const prev = parseFloat(prevAssmt.scores[d] ?? 0);
                        const curr = parseFloat(currAssmt.scores[d] ?? 0);
                        const diff = curr - prev;
                        return (
                          <tr key={d}>
                            <td style={{ textTransform: "capitalize", color: "#8b949e" }}>{d}</td>
                            <td>{prev.toFixed(1)}</td>
                            <td style={{ color: "#58a6ff", fontWeight: 600 }}>{curr.toFixed(1)}</td>
                            <td style={{ color: diff > 0 ? "#3fb950" : diff < 0 ? "#f85149" : "#8b949e", fontWeight: 600 }}>
                              {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                              {diff > 0 ? " ▲" : diff < 0 ? " ▼" : " —"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: "1px solid #30363d" }}>
                        <td style={{ fontWeight: 600, color: "#e6edf3" }}>Overall</td>
                        <td>{parseFloat(prevAssmt.overall_score ?? 0).toFixed(1)}</td>
                        <td style={{ color: "#58a6ff", fontWeight: 700 }}>{parseFloat(currAssmt.overall_score ?? 0).toFixed(1)}</td>
                        <td style={{
                          color: (currAssmt.overall_score - prevAssmt.overall_score) > 0 ? "#3fb950" : (currAssmt.overall_score - prevAssmt.overall_score) < 0 ? "#f85149" : "#8b949e",
                          fontWeight: 700
                        }}>
                          {(() => {
                            const d = parseFloat(currAssmt.overall_score ?? 0) - parseFloat(prevAssmt.overall_score ?? 0);
                            return `${d > 0 ? "+" : ""}${d.toFixed(2)}${d > 0 ? " ▲" : d < 0 ? " ▼" : " —"}`;
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Assessment timeline chips */}
          <div className="history-timeline mt-12">
            {companyHistory.map((h) => (
              <Link
                key={h.id}
                to={`/results/${h.id}`}
                className={`history-chip ${h.id === parseInt(id, 10) ? "history-chip--active" : ""} history-chip--${(h.risk_level || "critical").toLowerCase()}`}
                title={`Assessment #${h.id} · ${new Date(h.created_at).toLocaleDateString("en-IE")}`}
              >
                #{h.id}
                <span className="history-chip__score">{parseFloat(h.overall_score ?? 0).toFixed(1)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Metadata ── */}
      <div className="card">
        <h3 className="dash-section-title">Assessment Metadata</h3>
        <div className="meta-grid">
          <div><span className="meta-key">ID</span><code className="meta-val">{assessment.id}</code></div>
          <div><span className="meta-key">Submitted by</span><span className="meta-val">{assessment.submitter?.email || assessment.submitter_email || "—"}</span></div>
          <div><span className="meta-key">Encrypted at rest</span><span className="meta-val">Yes (AES-256-GCM)</span></div>
          <div><span className="meta-key">Session key</span><code className="meta-val">{assessment.encrypted_payload?.session_key_id || "—"}</code></div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Route wrapper — /results vs /results/:id                      */
/* ────────────────────────────────────────────────────────────── */
export default function ResultsPage() {
  const { id } = useParams();
  return id ? <ResultDetail id={id} /> : <ResultsList />;
}
