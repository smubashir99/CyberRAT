/**
 * CyberRAT — Hypothetical SME Case Study Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * ── Purpose ──────────────────────────────────────────────────
 * Demonstrates the framework using a hypothetical Irish retail
 * SME case study constructed from the dissertation dataset.
 *
 * IMPORTANT: "Café Bríd" is a FICTIONAL business created for
 * this research. It is not based on any real company. The
 * assessment data is derived from control adoption rates
 * measured in the MTU/NCSC Ireland SME Survey 2025 (n=894).
 *
 * Data source: CafeBrid_Dataset_v3.xlsx — CyberRAT_Assessments sheet
 * Three assessments (A001, A002, A003) show score improvement as
 * cybersecurity controls are progressively implemented.
 *
 * This directly validates the dissertation claim:
 * "Small businesses cannot afford dedicated security teams and
 * existing frameworks like NIST and ISO 27001 are too complex."
 *
 * Scoring formula:  Score = Σ(Cᵢ × Wᵢ) / 89 × 10
 * Where Cᵢ = answer value normalised to 0/0.5/1.0 (from 1-5 scale)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import toast from "react-hot-toast";
import { assessmentAPI } from "../services/api";
import "./InsomniaCasePage.css";

/* ────────────────────────────────────────────────────────────────
   HYPOTHETICAL SME CASE STUDY DATA — "Café Bríd"
   ────────────────────────────────────────────────────────────────
   Café Bríd is a FICTIONAL Irish retail café used as a
   hypothetical case study for dissertation validation purposes.
   It is NOT based on any real company.

   Answers use a 3-point scale: No(1) / Partial(3) / Yes(5)
   Backend converts these to 0.0 / 0.5 / 1.0 before scoring.

   Scoring verification:
   A001: weighted_sum = 35.0  → 35/89×10 = 3.93  (Critical)
   A002: weighted_sum = 54.0  → 54/89×10 = 6.07  (Moderate)
   A003: weighted_sum = 89.0  → 89/89×10 = 10.00 (High Resilience)

   A001 breakdown: c1(5→1.0×10) + c4(3→0.5×9) + c5(3→0.5×9) +
                   c6(5→1.0×8) + c9(5→1.0×8) = 10+4.5+4.5+8+8 = 35
   A002 breakdown: A001 controls + c2(5→1.0×10) + c4(5→1.0×9) +
                   c8(3→0.5×9) + c9(5→1.0×8) + c6(5→1.0×8) = 54
   ──────────────────────────────────────────────────────────────── */

const CASE_ASSESSMENTS = [
  {
    id: "A001",
    label: "A001 — Baseline",
    description:
      "Pre-assessment: basic backup and password controls in place. No MFA, no documented policy, no incident response plan.",
    date: "March 2025",
    score: 3.93,
    riskLevel: "Critical Risk",
    riskColor: "#f85149",
    // c1=Yes(5), c4=Partial(3), c5=Partial(3), c6=Yes(5), c9=Yes(5), rest=No(1)
    // Weighted sum = 10 + 4.5 + 4.5 + 8 + 8 = 35 → 35/89×10 = 3.93
    answers: { c1: 5, c2: 1, c3: 1, c4: 3, c5: 3, c6: 5, c7: 1, c8: 1, c9: 5, c10: 1 },
    controlsActive: [
      "Automated cloud backup (daily)",
      "Password length policy (≥12 chars)",
      "Automatic software updates enabled",
      "Basic informal business continuity awareness",
      "Informal staff security reminders",
    ],
    controlsMissing: [
      "MFA — no multi-factor authentication",
      "Incident Response Plan — no formal plan",
      "Documented Cybersecurity Policy",
      "Network Security Controls (segmentation)",
      "VPN for remote access",
    ],
    narrative:
      "Café Bríd (hypothetical) represents a typical Irish retail SME that has never formally assessed its cybersecurity posture. Some basic controls are in place — automated daily cloud backup, a password policy, and automatic OS updates — but critical controls like MFA, incident response, and a formal cyber policy are absent. The score of 3.93 is slightly below the Irish Retail sector average of 4.4/10 (MTU/NCSC 2025), which is consistent with an SME that has basic hygiene but no structured security programme.",
  },
  {
    id: "A002",
    label: "A002 — Partial Improvement",
    description:
      "After implementing quick wins: MFA enforced, all staff trained, automatic updates, network partially segmented, password policy strengthened.",
    date: "June 2025",
    score: 6.07,
    riskLevel: "Medium Risk",
    riskColor: "#d29922",
    // c1=Yes(5), c2=Yes(5), c4=Yes(5), c6=Yes(5), c8=Partial(3), c9=Yes(5), rest=No(1)
    // Weighted sum = 10+10+9+8+4.5+8 = 54 → 54/89×10 = 6.07
    answers: { c1: 5, c2: 5, c3: 1, c4: 5, c5: 3, c6: 5, c7: 1, c8: 3, c9: 5, c10: 1 },
    controlsActive: [
      "Automated cloud backup (daily)",
      "MFA enforced on all email accounts (€0 — free tier)",
      "All staff completed NCSC free cyber training",
      "Password length policy (≥12 chars, enforced)",
      "Network partially segmented (guest Wi-Fi separated)",
      "Automatic software updates enabled",
      "Basic business continuity plan (informal)",
    ],
    controlsMissing: [
      "Cyber Incident Response Plan — not yet documented",
      "Formal Documented Cybersecurity Policy",
      "VPN for remote access",
    ],
    narrative:
      "Café Bríd implemented four low-cost quick wins: MFA on email (free via Google Workspace), enrolled all staff in NCSC's free cybersecurity awareness training, separated guest Wi-Fi from staff network, and strengthened the password policy. Total cost: €0. Score jumped from 3.93 → 6.07, crossing from Critical into Moderate risk — demonstrating that even simple, zero-cost controls have a significant impact on an SME's cybersecurity posture.",
  },
  {
    id: "A003",
    label: "A003 — Full Controls",
    description:
      "All 10 framework controls fully implemented. Automated backup, full MFA, documented IRP, staff training, BCP, password policy, cyber policy, network security, auto-updates, VPN.",
    date: "September 2025",
    score: 10.00,
    riskLevel: "Low Risk",
    riskColor: "#3fb950",
    // All c=Yes(5) → weighted_sum = 89 → 89/89×10 = 10.00
    answers: { c1: 5, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5, c7: 5, c8: 5, c9: 5, c10: 5 },
    controlsActive: [
      "Automated cloud backup (daily, tested monthly)",
      "MFA enforced on all systems",
      "Documented Incident Response Plan (tested annually)",
      "Quarterly security training + phishing simulations",
      "Business Continuity Plan (with RTO/RPO targets)",
      "12+ char password policy (technically enforced)",
      "Board-approved Cyber Policy (NIS2-aligned)",
      "Network segmentation + guest Wi-Fi + IDS",
      "Automated patching + vulnerability scanning",
      "VPN mandatory for all remote access",
    ],
    controlsMissing: [],
    narrative:
      "All 10 framework controls are fully implemented. Estimated total cost: ~€2,400/year (Microsoft 365 Business Basic with Defender, Backblaze cloud backup, WireGuard VPN — all SME-affordable). Score reached 10.00 — maximum High Resilience. This directly validates the dissertation claim: NIS2-aligned cybersecurity is achievable for a small business without a dedicated security team, using the framework as a structured, low-cost roadmap.",
  },
];

// Score progression data for line chart
const PROGRESSION_DATA = [
  { stage: "Baseline (A001)", score: 3.93, benchmark: 4.4 },
  { stage: "Partial (A002)",  score: 6.07, benchmark: 4.4 },
  { stage: "Full (A003)",     score: 10.00, benchmark: 4.4 },
];

// Criterion labels (MTU/NCSC aligned names)
const CRITERION_LABELS = {
  c1:  "Automated Backup",
  c2:  "MFA",
  c3:  "Incident Response",
  c4:  "Security Training",
  c5:  "Business Continuity",
  c6:  "Password Policy",
  c7:  "Cyber Policy",
  c8:  "Network Security",
  c9:  "Auto SW Updates",
  c10: "VPN/Remote",
};

/* ────────────────────────────────────────────────────────────── */

export default function InsomniaCasePage() {
  const navigate  = useNavigate();
  const [active,   setActive]   = useState(0);   // 0=A001, 1=A002, 2=A003
  const [running,  setRunning]  = useState({});  // { "A001": true/false, ... }
  const [results,  setResults]  = useState({});  // { "A001": assessmentId, ... }

  const current = CASE_ASSESSMENTS[active];

  const isRunning = (id) => !!running[id];

  // Run this case study assessment against the live prototype
  const runAssessment = async (caseStudy) => {
    setRunning((prev) => ({ ...prev, [caseStudy.id]: true }));
    try {
      const payload = {
        company_name: `Café Bríd — Hypothetical Case Study (${caseStudy.id})`,
        sector: "Retail & E-Commerce",
        company_size: "11–50",
        answers: caseStudy.answers,
      };
      const res = await assessmentAPI.submit(payload);
      const id  = res.data.assessment?.id ?? res.data.assessment_id;
      setResults((prev) => ({ ...prev, [caseStudy.id]: id }));
      const backendScore = res.data.scoring?.overall_score ?? "—";
      const backendRisk  = res.data.scoring?.risk_level ?? "";
      toast.success(`${caseStudy.id} submitted! Score: ${backendScore}/10 · ${backendRisk} Risk`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed.");
    } finally {
      setRunning((prev) => ({ ...prev, [caseStudy.id]: false }));
    }
  };

  // Bar data for per-criterion answer comparison across all 3 assessments
  const criteriaBarData = Object.keys(CRITERION_LABELS).map((key) => ({
    name: CRITERION_LABELS[key],
    A001: CASE_ASSESSMENTS[0].answers[key],
    A002: CASE_ASSESSMENTS[1].answers[key],
    A003: CASE_ASSESSMENTS[2].answers[key],
  }));

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <h1 className="page-title">Café Bríd — Hypothetical SME Case Study</h1>
        <p className="page-subtitle">
          Fictional Irish Retail SME · Dublin · 11–50 employees ·{" "}
          <span className="tag-source">Data: CafeBrid_Dataset_v3.xlsx</span>
        </p>
      </div>

      {/* ── Context banner ── */}
      <div className="case-context-banner">
        <div className="case-context-banner__icon">☕</div>
        <div>
          <strong>Case Study Purpose:</strong> Validates the dissertation claim that this
          framework enables Irish SMEs to improve cybersecurity posture using low-cost,
          practical controls — without a dedicated security team or complex frameworks like NIST or ISO 27001.
          <br />
          <span className="text-muted" style={{ fontSize: 12 }}>
            <strong>Note:</strong> Café Bríd is a <em>fictional business</em> constructed for this research.
            It is not based on any real company. The assessment data is derived from control
            adoption rates measured in the MTU/NCSC Ireland SME Survey 2025 (n=894).
            The baseline score of 3.93 is slightly below the Irish Retail sector average of 4.4/10 —
            consistent with an SME that has basic hygiene but no formal security programme.
          </span>
        </div>
      </div>

      {/* ── Score progression chart ── */}
      <div className="card mb-16">
        <h3 className="dash-section-title">Framework Score Progression — Café Bríd (Hypothetical)</h3>
        <p className="card-desc">
          Blue line = Café Bríd score as controls were progressively implemented.
          Dashed orange = Irish Retail sector average (4.4/10) — MTU/NCSC 2025 benchmark.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={PROGRESSION_DATA} margin={{ top: 8, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
            <XAxis dataKey="stage" tick={{ fill: "#8b949e", fontSize: 12 }} axisLine={false} />
            <YAxis domain={[0, 10]} tick={{ fill: "#6e7681", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
              formatter={(v, name) => [`${v}/10`, name === "score" ? "Café Bríd" : "Irish Retail avg"]}
            />
            <Legend
              formatter={(v) => v === "score" ? "Café Bríd Score" : "Irish Retail Average (4.4)"}
              wrapperStyle={{ fontSize: 12 }}
            />
            <ReferenceLine
              y={4.4} stroke="#f0883e" strokeDasharray="5 3"
              label={{ value: "Retail avg 4.4", fill: "#f0883e", fontSize: 10, position: "insideTopRight" }}
            />
            <Line
              type="monotone" dataKey="score" stroke="#58a6ff"
              strokeWidth={3} dot={{ fill: "#58a6ff", r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Assessment tabs ── */}
      <div className="case-tabs">
        {CASE_ASSESSMENTS.map((c, i) => (
          <button
            key={c.id}
            className={`case-tab ${active === i ? "case-tab--active" : ""}`}
            style={active === i ? { borderColor: c.riskColor, color: c.riskColor } : {}}
            onClick={() => setActive(i)}
          >
            <span className="case-tab__id">{c.id}</span>
            <span className="case-tab__score" style={{ color: c.riskColor }}>{c.score}/10</span>
            <span className="case-tab__risk">{c.riskLevel}</span>
          </button>
        ))}
      </div>

      {/* ── Active assessment detail ── */}
      <div className="card mb-16">
        <div className="case-detail-header">
          <div>
            <h2 className="case-detail-title">{current.label}</h2>
            <p className="case-detail-date">{current.date}</p>
          </div>
          <div className="case-score-hero" style={{ borderColor: current.riskColor + "60" }}>
            <span className="case-score-val" style={{ color: current.riskColor }}>{current.score}</span>
            <span className="case-score-label">{current.riskLevel}</span>
          </div>
        </div>

        <p className="case-detail-desc">{current.description}</p>
        <p className="case-narrative">{current.narrative}</p>

        <div className="case-controls-grid">
          {current.controlsActive.length > 0 && (
            <div>
              <h4 className="case-controls-title case-controls-title--on">
                ✓ Controls Active ({current.controlsActive.length})
              </h4>
              <ul className="case-controls-list">
                {current.controlsActive.map((c, i) => (
                  <li key={i} className="case-control-item case-control-item--on">{c}</li>
                ))}
              </ul>
            </div>
          )}
          {current.controlsMissing.length > 0 && (
            <div>
              <h4 className="case-controls-title case-controls-title--off">
                ✗ Controls Missing ({current.controlsMissing.length})
              </h4>
              <ul className="case-controls-list">
                {current.controlsMissing.map((c, i) => (
                  <li key={i} className="case-control-item case-control-item--off">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Run live test button */}
        <div className="case-action-row">
          {results[current.id] ? (
            <div className="case-run-success">
              ✓ Submitted to prototype &nbsp;
              <Link to={`/results/${results[current.id]}`} className="link-inline">View Result →</Link>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => runAssessment(current)}
              disabled={isRunning(current.id)}
            >
              {isRunning(current.id)
                ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Running…</>
                : `▶ Run ${current.id} Against Live Prototype`}
            </button>
          )}
          <p className="case-action-note">
            Submits real assessment answers to the live backend. Scores are computed in real-time
            using the formula: Score = Σ(Cᵢ × Wᵢ) / 89 × 10.
          </p>
        </div>
      </div>

      {/* ── Per-criterion comparison chart ── */}
      <div className="card mb-16">
        <h3 className="dash-section-title">Per-Criterion Answer Comparison — A001 vs A002 vs A003</h3>
        <p className="card-desc">
          Each bar shows the answer (1=No, 3=Partial, 5=Yes) for each framework criterion
          across the three assessment stages. The backend normalises these to 0 / 0.5 / 1.0
          before applying criterion weights.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={criteriaBarData} barCategoryGap="20%" barGap={2}>
            <CartesianGrid stroke="#21262d" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name" tick={{ fill: "#8b949e", fontSize: 9 }}
              axisLine={false} interval={0} angle={-20} textAnchor="end" height={55}
            />
            <YAxis
              domain={[0, 5]} ticks={[1, 3, 5]}
              tick={{ fill: "#6e7681", fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => ({ 1: "No", 3: "Partial", 5: "Yes" }[v] || v)}
            />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, fontSize: 12 }}
              formatter={(v, name) => [({ 1: "No (0.0)", 3: "Partial (0.5)", 5: "Yes (1.0)" }[v] || v), name]}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="A001" fill="#f85149" radius={[2, 2, 0, 0]} name="A001 Baseline" />
            <Bar dataKey="A002" fill="#d29922" radius={[2, 2, 0, 0]} name="A002 Partial" />
            <Bar dataKey="A003" fill="#3fb950" radius={[2, 2, 0, 0]} name="A003 Full" />
          </BarChart>
        </ResponsiveContainer>
        <p className="chart-footnote">
          Source: CafeBrid_Dataset_v3.xlsx — CyberRAT_Assessments sheet.
          Café Bríd is a fictional business constructed for this research; not a real company.
        </p>
      </div>

      {/* ── Run all three ── */}
      <div className="card">
        <h3 className="dash-section-title">Run All Three Assessments</h3>
        <p className="card-desc">
          Submit all three assessment scenarios to the live backend one by one.
          Each produces a unique result — compare them in the Assessment History page.
        </p>
        <div className="case-sector-note">
          <span className="case-sector-badge">🏪 Sector: Retail &amp; E-Commerce</span>
          <span className="case-sector-info">
            Café Bríd is a fictional Irish retail SME — all three assessments use the
            Retail &amp; E-Commerce sector for consistent benchmark comparison.
            The three different <strong>risk levels</strong> (Critical → Medium → Low)
            reflect progressive cybersecurity improvements within the same business sector.
          </span>
        </div>
        <div className="run-all-grid">
          {CASE_ASSESSMENTS.map((c) => (
            <div key={c.id} className="run-all-card" style={{ borderColor: c.riskColor + "40" }}>
              <div className="run-all-header">
                <span className="run-all-id">{c.id}</span>
                <span style={{ color: c.riskColor, fontWeight: 700 }}>{c.score}/10</span>
              </div>
              <p className="run-all-label" style={{ color: c.riskColor }}>{c.riskLevel}</p>
              {results[c.id] ? (
                <Link
                  to={`/results/${results[c.id]}`}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  View Result →
                </Link>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{
                    fontSize: 12, padding: "6px 12px",
                    background: c.riskColor + "22",
                    borderColor: c.riskColor + "66",
                    color: c.riskColor,
                  }}
                  onClick={() => runAssessment(c)}
                  disabled={isRunning(c.id)}
                >
                  {isRunning(c.id) ? "Running…" : `Run ${c.id}`}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-12">
          <Link to="/results" className="btn btn-secondary">View All Results →</Link>
        </div>
      </div>
    </div>
  );
}
