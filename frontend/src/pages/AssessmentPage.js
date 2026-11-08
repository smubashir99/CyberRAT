/**
 * CyberRAT — Assessment Page (10-Criterion Form)
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Collects answers for all 10 framework criteria (C1–C10),
 * submits to backend with optional ECDH encryption, then
 * navigates to the result detail page.
 *
 * ── Criteria Source ──────────────────────────────────────────────
 * C1–C10 are directly derived from MTU/NCSC Ireland Cybersecurity
 * SME Survey 2025 (n=894). Each criterion corresponds to a real
 * measured control with empirically validated adoption rates.
 * Source: CafeBrid_Dataset_v3.xlsx — Sheet: MTU_Control_Indicators
 *
 * C1  Automated Data Backup             (Adoption: 26% — Recover)
 * C2  Multi-Factor Authentication       (Adoption: 39% — Protect)
 * C3  Cyber Incident Response Plan      (Adoption: 22% — Respond)
 * C4  Cybersecurity Awareness Training  (Adoption: 26% — Protect)
 * C5  Business Continuity Plan          (Adoption: 35% — Recover)
 * C6  Password Length Policy (≥12 chars)(Adoption: 38% — Protect)
 * C7  Documented Cybersecurity Policy   (Adoption: 12% — Identify)
 * C8  Network Security Controls         (Adoption: 30% — Protect)
 * C9  Automatic Software Updates        (Adoption: 39% — Protect)
 * C10 VPN for Remote Access             (Adoption: 24% — Protect)
 *
 * Weights are assigned proportional to adoption gap severity:
 * lower adoption = higher weight (bigger gap = bigger risk to SMEs)
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { assessmentAPI } from "../services/api";
import "./AssessmentPage.css";

/* ─────────────────────────────────────────────────────────────
   Framework Criteria Definitions  (C1–C10)
   ─────────────────────────────────────────────────────────────
   Criteria are grounded in empirical data from the MTU/NCSC
   Ireland SME Cybersecurity Survey 2025 (n=894 Irish SMEs).
   Adoption rates are real measured values from that survey.
   Weights reflect adoption gap: lower adoption = higher weight.

   Source: CafeBrid_Dataset_v3.xlsx — MTU_Control_Indicators
   Dataset reference: MTU/NCSC Ireland, 2025; Eurostat ICT Survey
───────────────────────────────────────────────────────────── */
// Each criterion has:
const CRITERIA = [
  {
    id: "c1",
    label: "C1 — Automated Data Backup",
    weight: 10,
    nist: "Recover",
    adoption: 26,   // % of Irish SMEs — MTU/NCSC 2025 (n=894)
    question: "Does your organisation perform automated, regular backups of critical business data?",
    why: "Only 26% of Irish SMEs have automated backups (MTU/NCSC 2025). Without backups, a ransomware attack causes permanent data loss.",
    options: [
      { value: 1, label: "No backups — data is never copied" },
      { value: 2, label: "Manual backups occasionally, not automated" },
      { value: 3, label: "Automated backups, but not regularly tested" },
      { value: 4, label: "Automated daily backups, tested monthly" },
      { value: 5, label: "Automated backups with offsite/cloud copy, tested & verified" },
    ],
  },
  {
    id: "c2",
    label: "C2 — Multi-Factor Authentication (MFA)",
    weight: 10,
    nist: "Protect",
    adoption: 39,
    question: "Is Multi-Factor Authentication (MFA) enforced for business accounts and remote access?",
    why: "61% of Irish SMEs still lack MFA (MTU/NCSC 2025). MFA blocks 99.9% of account-compromise attacks (Microsoft Security Report).",
    options: [
      { value: 1, label: "No MFA — password only for all systems" },
      { value: 2, label: "MFA available but not enforced" },
      { value: 3, label: "MFA enforced for email only" },
      { value: 4, label: "MFA enforced for email + remote access / VPN" },
      { value: 5, label: "MFA enforced across all systems including internal apps" },
    ],
  },
  {
    id: "c3",
    label: "C3 — Cyber Incident Response Plan",
    weight: 10,
    nist: "Respond",
    adoption: 22,
    question: "Does your organisation have a documented and tested Cyber Incident Response Plan (IRP)?",
    why: "78% of Irish SMEs have no incident response plan (MTU/NCSC 2025). Unplanned responses to cyberattacks increase recovery time and costs by 3–5×.",
    options: [
      { value: 1, label: "No IRP — no plan exists at all" },
      { value: 2, label: "Informal verbal procedures only" },
      { value: 3, label: "IRP documented but never tested" },
      { value: 4, label: "IRP documented and tested annually (tabletop)" },
      { value: 5, label: "IRP tested quarterly with live drills; roles assigned" },
    ],
  },
  {
    id: "c4",
    label: "C4 — Cybersecurity Awareness Training",
    weight: 9,
    nist: "Protect",
    adoption: 26,
    question: "What level of cybersecurity awareness training does your organisation provide to all staff?",
    why: "74% of Irish SMEs provide no cybersecurity training (MTU/NCSC 2025). Human error causes 82% of data breaches (Verizon DBIR 2024).",
    options: [
      { value: 1, label: "No training whatsoever" },
      { value: 2, label: "One-off induction session only" },
      { value: 3, label: "Annual training for all staff" },
      { value: 4, label: "Annual training + phishing simulations" },
      { value: 5, label: "Quarterly training, simulated attacks, tracked completion" },
    ],
  },
  {
    id: "c5",
    label: "C5 — Business Continuity Plan (BCP)",
    weight: 9,
    nist: "Recover",
    adoption: 35,
    question: "Does your organisation have a Business Continuity Plan (BCP) covering cyber incidents?",
    why: "65% of Irish SMEs have no BCP (MTU/NCSC 2025). Without a BCP, 60% of SMEs that suffer a major cyberattack close within 6 months (NCSC UK).",
    options: [
      { value: 1, label: "No BCP at all" },
      { value: 2, label: "Informal plan — never documented" },
      { value: 3, label: "BCP documented but not tested" },
      { value: 4, label: "BCP documented, tested annually with RTO/RPO targets" },
      { value: 5, label: "BCP tested quarterly; automated failover; regular updates" },
    ],
  },
  {
    id: "c6",
    label: "C6 — Password Length Policy (≥12 chars)",
    weight: 8,
    nist: "Protect",
    adoption: 38,
    question: "Does your organisation enforce a minimum password length policy of 12 or more characters?",
    why: "62% of Irish SMEs have no password policy (MTU/NCSC 2025). NCSC Ireland recommends a minimum of 12 characters for business accounts.",
    options: [
      { value: 1, label: "No password policy — any password accepted" },
      { value: 2, label: "Policy exists but not enforced technically" },
      { value: 3, label: "Minimum 8 characters enforced" },
      { value: 4, label: "Minimum 12 characters enforced for all accounts" },
      { value: 5, label: "12+ chars, complexity rules, password manager policy, reviewed annually" },
    ],
  },
  {
    id: "c7",
    label: "C7 — Documented Cybersecurity Policy",
    weight: 9,
    nist: "Identify",
    adoption: 12,
    question: "Does your organisation have a documented cybersecurity policy communicated to all staff?",
    why: "88% of Irish SMEs have no documented cyber policy (MTU/NCSC 2025) — the highest gap of all measured controls. NIS2 requires this for in-scope entities.",
    options: [
      { value: 1, label: "No policy exists at all" },
      { value: 2, label: "Informal / verbal guidelines only" },
      { value: 3, label: "Written policy exists but not distributed to staff" },
      { value: 4, label: "Written policy, communicated to all staff, reviewed annually" },
      { value: 5, label: "Formal policy, board-approved, staff-acknowledged, NIS2-aligned" },
    ],
  },
  {
    id: "c8",
    label: "C8 — Network Security Controls",
    weight: 9,
    nist: "Protect",
    adoption: 30,
    question: "What level of network security controls does your organisation have in place?",
    why: "70% of Irish SMEs have inadequate network security (MTU/NCSC 2025). Unprotected networks are the primary entry point for ransomware and lateral movement attacks.",
    options: [
      { value: 1, label: "No firewall or network controls" },
      { value: 2, label: "Basic router firewall only" },
      { value: 3, label: "Firewall + separate Wi-Fi networks (guest vs staff)" },
      { value: 4, label: "Firewall + network segmentation + intrusion detection" },
      { value: 5, label: "Full segmentation, IDS/IPS, DNS filtering, monitored 24/7" },
    ],
  },
  {
    id: "c9",
    label: "C9 — Automatic Software Updates",
    weight: 8,
    nist: "Protect",
    adoption: 39,
    question: "Are operating systems and software kept up-to-date with automatic security updates enabled?",
    why: "61% of Irish SMEs do not apply software updates automatically (MTU/NCSC 2025). Unpatched software is exploited in 57% of successful cyberattacks.",
    options: [
      { value: 1, label: "No updates — systems run outdated software" },
      { value: 2, label: "Updates applied manually when convenient" },
      { value: 3, label: "Automatic updates enabled for OS only" },
      { value: 4, label: "Automatic updates for OS + all software, tested monthly" },
      { value: 5, label: "Automated patching, vulnerability scanning, SLA-bound remediation" },
    ],
  },
  {
    id: "c10",
    label: "C10 — VPN for Remote Access",
    weight: 7,
    nist: "Protect",
    adoption: 24,
    question: "Does your organisation use a VPN (or Zero Trust equivalent) to secure all remote access to business systems?",
    why: "76% of Irish SMEs have no VPN for remote workers (MTU/NCSC 2025). Post-COVID, remote work without VPN is a leading cause of data breaches in SMEs.",
    options: [
      { value: 1, label: "No VPN — remote access over open internet" },
      { value: 2, label: "VPN available but not mandatory" },
      { value: 3, label: "VPN mandatory for access to servers/databases" },
      { value: 4, label: "VPN mandatory for all remote access + MFA required" },
      { value: 5, label: "Zero-trust network access (ZTNA) or VPN + device health checks" },
    ],
  },
];

const SECTORS = [
  "Technology", "Finance & Banking", "Healthcare",
  "Retail & E-Commerce", "Manufacturing", "Professional Services",
  "Education", "Government", "Logistics & Transport", "Other",
];
const SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];
const NIST_COLORS = {
  Identify: "#58a6ff",
  Protect:  "#3fb950",
  Detect:   "#d29922",
  Respond:  "#f0883e",
  Recover:  "#bc8cff",
};

// Adoption gap data per criterion for review screen
const CRITERION_ADOPTION = {
  c1: 26, c2: 39, c3: 22, c4: 26, c5: 35,
  c6: 38, c7: 12, c8: 30, c9: 39, c10: 24,
};

// minimum and maximum possible scores for the assessment (used for scoring and normalization)
export default function AssessmentPage() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);        // 0 = metadata, 1–10 = criteria
  const [submitting, setSub]  = useState(false);

  const [meta, setMeta] = useState({
    company_name: "",
    sector: "",
    company_size: "",
  });
  // Initialize answers state with all criteria set to 0 (unanswered)
  const [answers, setAnswers] = useState(
    Object.fromEntries(CRITERIA.map((c) => [c.id, 0]))
  );
  // Calculate total steps and progress percentage for the assessment form

  const totalSteps = CRITERIA.length + 1; // 1 metadata + 10 criteria
  const progress   = Math.round((step / totalSteps) * 100);
  // Determine the current criterion based on the step number (step 1 corresponds to C1, step 2 to C2, etc.)
  const currentCriterion = step > 0 ? CRITERIA[step - 1] : null;

  /* ── Validation ── */
  const metaValid   = meta.company_name.trim() && meta.sector && meta.company_size;
  const answerValid = step > 0 && currentCriterion ? answers[currentCriterion.id] > 0 : true;
  const allAnswered = CRITERIA.every((c) => answers[c.id] > 0);

  /* ── Navigation ── */
  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  /* ── Submit ── */
  // Handle form submission for the assessment. Validates that all criteria have been answered, 
  // sends the data to the backend API, and navigates to the results page upon success.
  const handleSubmit = async () => {
    if (!allAnswered) { toast.error("Please answer all criteria before submitting."); return; }
    setSub(true);
    try {
      const payload = { ...meta, answers };
      const res = await assessmentAPI.submit(payload);
      toast.success("Assessment submitted!");
      // Backend returns { assessment: { id: ... }, scoring: {...} }
      const id = res.data.assessment_id ?? res.data.assessment?.id;
      navigate(`/results/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed.");
      setSub(false);
    }
  };

// Render the AssessmentPage component with metadata form, criteria questions, progress bar, and navigation buttons.
  /* ────────────────────────────────────────────────────────── */
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Cybersecurity Risk Assessment</h1>
        <p className="page-subtitle">
          10-criterion cybersecurity risk evaluation — CRAF Framework (DBS Dublin, 2026)
        </p>
      </div>
  
      {/* ── Progress bar ── */}
      <div className="assessment-progress-wrap">
        <div className="assessment-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="assessment-step-info">
        Step {step + 1} of {totalSteps + 1} — {progress}% complete
      </div>

      {/* ── Step: Metadata ── */}
      {step === 0 && (
        <div className="card assessment-card">
          <h2 className="assessment-card__title">Organisation Details</h2>
          <p className="assessment-card__desc">
            Provide basic information about your organisation before starting the assessment.
          </p>

          <div className="form-group">
            <label className="form-label">Company / Organisation Name *</label>
            <input
              className="form-control"
              placeholder="e.g. Acme Ltd"
              value={meta.company_name}
              onChange={(e) => setMeta({ ...meta, company_name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Industry Sector *</label>
            <select
              className="form-control"
              value={meta.sector}
              onChange={(e) => setMeta({ ...meta, sector: e.target.value })}
            >
              <option value="">Select sector…</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Organisation Size (employees) *</label>
            <div className="size-options">
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`size-btn ${meta.company_size === sz ? "size-btn--active" : ""}`}
                  onClick={() => setMeta({ ...meta, company_size: sz })}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="assessment-nav">
            <div />
            <button
              className="btn btn-primary"
              onClick={goNext}
              disabled={!metaValid}
            >
              Begin Assessment →
            </button>
          </div>
        </div>
      )}

      {/* ── Steps: Criteria 1–10 ── */}
      {step > 0 && step <= CRITERIA.length && currentCriterion && (
        <div className="card assessment-card">
          {/* Header */}
          <div className="criteria-header">
            <span
              className="criteria-domain-badge"
              style={{ background: NIST_COLORS[currentCriterion.nist] + "22",
                       color: NIST_COLORS[currentCriterion.nist],
                       borderColor: NIST_COLORS[currentCriterion.nist] + "55" }}
            >
              NIST: {currentCriterion.nist}
            </span>
            <span className="criteria-weight-badge">
              Weight: {currentCriterion.weight} / 89
            </span>
          </div>

          <h2 className="assessment-card__title">{currentCriterion.label}</h2>
          <p className="assessment-card__desc">{currentCriterion.question}</p>

          {/* Dataset context — Irish SME adoption data */}
          <div className="criteria-dataset-note">
            <span className="criteria-dataset-icon">📊</span>
            <span>
              <strong>Irish SME Adoption (MTU/NCSC 2025, n=894):</strong>{" "}
              Only <strong>{currentCriterion.adoption}%</strong> of Irish small businesses
              have this control in place. {currentCriterion.why}
            </span>
          </div>

          {/* Answer options */}
          <div className="criteria-options">
            {currentCriterion.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`criteria-option ${answers[currentCriterion.id] === opt.value ? "criteria-option--selected" : ""}`}
                onClick={() => setAnswers({ ...answers, [currentCriterion.id]: opt.value })}
              >
                <span className="criteria-option__score">{opt.value}</span>
                <span className="criteria-option__label">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="assessment-nav">
            <button className="btn btn-secondary" onClick={goPrev}>← Back</button>
            {step < CRITERIA.length ? (
              <button
                className="btn btn-primary"
                onClick={goNext}
                disabled={!answerValid}
              >
                Next →
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={goNext}
                disabled={!answerValid}
              >
                Review & Submit →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step: Review & Submit ── */}
      {step > CRITERIA.length && (
        <div className="card assessment-card">
          <h2 className="assessment-card__title">Review Your Answers</h2>
          <p className="assessment-card__desc">
            Review all criteria below. Click any criterion to go back and change your answer.
          </p>

          <div className="review-grid">
            {CRITERIA.map((c, i) => (
              <div
                key={c.id}
                className="review-item"
                onClick={() => setStep(i + 1)}
                title="Click to edit"
              >
                <div className="review-item__left">
                  <span className="review-item__id">{c.id.toUpperCase()}</span>
                  <span className="review-item__label">{c.label.split(" — ")[1]}</span>
                </div>
                <div className="review-item__right">
                  <span className={`review-score review-score--${getScoreClass(answers[c.id])}`}>
                    {answers[c.id]}/5
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="review-summary">
            <strong>{meta.company_name}</strong>
            <span className="text-muted"> · {meta.sector} · {meta.company_size} employees</span>
          </div>

          <div className="assessment-nav">
            <button className="btn btn-secondary" onClick={goPrev}>← Back</button>
            <button
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={submitting || !allAnswered}
            >
              {submitting ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Submitting…</>
              ) : (
                "✓ Submit Assessment"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getScoreClass(v) {
  if (v >= 4) return "high";
  if (v >= 3) return "medium";
  if (v >= 2) return "low";
  return "critical";
}
