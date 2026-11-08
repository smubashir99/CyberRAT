/**
 * CyberRAT — Recommendations Panel
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Parses backend recommendation strings (format below) into structured
 * interactive cards with priority badge, NIST domain badge, gap callout,
 * and expandable action steps.
 *
 * Format: "[CRITICAL] RECOVER — Automated Data Backup [Gap: 74% of Irish SMEs lack this]: Enable automated daily backups…"
 * or:     "[MAINTAIN] PROTECT — Multi-Factor Authentication: Continue enforcing MFA…"
 */

import React, { useState } from "react";
import "./RecommendationsPanel.css";

/* ── Priority config ──────────────────────────────────────────── */
// Priority metadata for recommendation cards, including label, CSS class, order for sorting, and icon.
const PRIORITY_META = {
  CRITICAL: {
    label:    "⚠ CRITICAL",
    cssClass: "rec-priority--critical",
    order:    0,
    icon:     "🔴",
  },
  IMPROVE: {
    label:    "↑ IMPROVE",
    cssClass: "rec-priority--improve",
    order:    1,
    icon:     "🟡",
  },
  MAINTAIN: {
    label:    "✓ MAINTAIN",
    cssClass: "rec-priority--maintain",
    order:    2,
    icon:     "🟢",
  },
};

/* ── NIST domain config ───────────────────────────────────────── */
// NIST CSF domain metadata for recommendation cards, including color, background color, and icon.
const DOMAIN_META = {
  IDENTIFY:  { color: "#58a6ff", bg: "rgba(88,166,255,0.12)",   icon: "🔍" },
  PROTECT:   { color: "#3fb950", bg: "rgba(63,185,80,0.12)",    icon: "🛡" },
  DETECT:    { color: "#d29922", bg: "rgba(210,153,34,0.12)",   icon: "📡" },
  RESPOND:   { color: "#f0883e", bg: "rgba(240,136,62,0.12)",   icon: "⚡" },
  RECOVER:   { color: "#bc8cff", bg: "rgba(188,140,255,0.12)",  icon: "♻" },
};

/* ── Parser ───────────────────────────────────────────────────── */
/**
 * Parses a single recommendation string into a structured object.
 *
 * Input examples:
 *  "[CRITICAL] RECOVER — Automated Data Backup [Gap: 74% of Irish SMEs lack this]: Enable automated daily backups..."
 *  "[IMPROVE] PROTECT — Multi-Factor Authentication [Gap: 61% of Irish SMEs lack this]: Implement MFA..."
 *  "[MAINTAIN] PROTECT — Password Policy: Continue enforcing a strong password policy..."
 *
 * Returns:
 *  { priority, domain, title, gap, gapPct, body, bodyLines }
 */
// Parses a single recommendation string into a structured object with priority, domain, title, gap information, 
// and action lines.
function parseRecommendation(raw) {
  const str = (raw || "").trim();

  // Extract priority tag
  // Pattern: [CRITICAL], [IMPROVE], [MAINTAIN]
  const priorityMatch = str.match(/^\[(CRITICAL|IMPROVE|MAINTAIN)\]\s*/);
  const priority      = priorityMatch ? priorityMatch[1] : "IMPROVE";
  const afterPriority = priorityMatch ? str.slice(priorityMatch[0].length) : str;

  // Extract NIST domain (word before " — " or " - ")
  // Pattern: IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER
  const domainMatch = afterPriority.match(/^([A-Z]+)\s*[—\-]\s*/);
  const domain      = domainMatch ? domainMatch[1].toUpperCase() : "PROTECT";
  const afterDomain = domainMatch ? afterPriority.slice(domainMatch[0].length) : afterPriority;

  // Extract [Gap: XX% ...] callout
  // Pattern: [Gap: 74% of Irish SMEs lack this]
  const gapMatch  = afterDomain.match(/\[Gap:\s*(\d+)%([^\]]*)\]/);
  const gap       = gapMatch ? gapMatch[0].replace(/^\[|\]$/g, "") : null;
  const gapPct    = gapMatch ? parseInt(gapMatch[1], 10) : null;
  const afterGap  = gapMatch ? afterDomain.replace(gapMatch[0], "").trim() : afterDomain;

  // Split title from body at colon
  // Pattern: "Title: Body"
  const colonIdx  = afterGap.indexOf(":");
  const title     = colonIdx > -1 ? afterGap.slice(0, colonIdx).trim() : afterGap.trim();
  const body      = colonIdx > -1 ? afterGap.slice(colonIdx + 1).trim() : "";

  // Split body into numbered/bullet action lines
  // Pattern: lines starting with digit. or - or •
  // Split body into lines based on numbered or bullet points, trimming whitespace and filtering out empty lines.
  const bodyLines = body
    .split(/(?=\d+\.|[-•])\s*/)
    .map((l) => l.trim())
    .filter(Boolean);

  // If no structured lines, keep body as single item
  const actionLines = bodyLines.length > 1 ? bodyLines : (body ? [body] : []);
// Return the parsed recommendation object with priority, domain, title, gap information, body, and action lines.
  return { priority, domain, title, gap, gapPct, body, actionLines };
}

/* ── Single card ──────────────────────────────────────────────── */
// Renders a single recommendation card with priority badge, NIST domain badge, gap callout, and expandable action steps.
function RecCard({ rec, index, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const parsed   = parseRecommendation(rec);
  const pmeta    = PRIORITY_META[parsed.priority] || PRIORITY_META.IMPROVE;
  const dmeta    = DOMAIN_META[parsed.domain]      || DOMAIN_META.PROTECT;
 // Return the rendered recommendation card with header, badges, title, and expandable body containing gap 
 // callout and action steps.
  return (
    <div className={`rec-card ${pmeta.cssClass}`}>
      {/* ── Card header (always visible) ── */}
      <div
        className="rec-card__header"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
        aria-expanded={open}
      >
        <div className="rec-card__badges">
          {/* Priority badge */}
          <span className={`rec-badge rec-badge--priority ${pmeta.cssClass}`}>
            {pmeta.label}
          </span>

          {/* NIST domain badge */}
          <span
            className="rec-badge rec-badge--domain"
            style={{ color: dmeta.color, background: dmeta.bg, borderColor: dmeta.color + "44" }}
          >
            {dmeta.icon} {parsed.domain}
          </span>

          {/* Gap callout (if present) */}
          {parsed.gapPct !== null && (
            <span className="rec-badge rec-badge--gap">
              📊 {parsed.gapPct}% lack this
            </span>
          )}
        </div>

        <div className="rec-card__title-row">
          <span className="rec-card__title">{parsed.title || "Recommendation"}</span>
          <span className={`rec-card__chevron ${open ? "open" : ""}`}>›</span>
        </div>
      </div>

      {/* ── Expandable body ── */}
      {open && (
        <div className="rec-card__body">
          {parsed.gapPct !== null && (
            <div className="rec-gap-callout">
              <div className="rec-gap-callout__label">Irish SME Adoption Gap</div>
              <div className="rec-gap-bar-wrap">
                <div className="rec-gap-bar-track">
                  <div
                    className="rec-gap-bar-fill"
                    style={{
                      width: `${parsed.gapPct}%`,
                      background: parsed.gapPct >= 60 ? "#f85149" : parsed.gapPct >= 40 ? "#d29922" : "#3fb950",
                    }}
                  />
                </div>
                <span className="rec-gap-pct">{parsed.gapPct}%</span>
              </div>
              <p className="rec-gap-desc">
                {parsed.gapPct}% of Irish SMEs surveyed (MTU/NCSC 2025, n=894) do not have this control in place.
              </p>
            </div>
          )}

          {parsed.actionLines.length > 0 && (
            <div className="rec-actions">
              <div className="rec-actions__label">Recommended Actions</div>
              <ul className="rec-actions__list">
                {parsed.actionLines.map((line, i) => (
                  <li key={i} className="rec-action-item">
                    <span className="rec-action-bullet">→</span>
                    <span>{line.replace(/^[\d.•\-]+\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rec-nist-ref">
            <span className="rec-nist-ref__label">NIST CSF Domain:</span>
            <span
              className="rec-nist-ref__domain"
              style={{ color: dmeta.color }}
            >
              {dmeta.icon} {parsed.domain}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Summary strip ────────────────────────────────────────────── */
// Renders a summary strip showing counts of recommendations by priority (Critical, Improve, Maintain) and 
// the source of the data.
function RecSummaryStrip({ parsed }) {
  const counts = { CRITICAL: 0, IMPROVE: 0, MAINTAIN: 0 };
  parsed.forEach((p) => { counts[p.priority] = (counts[p.priority] || 0) + 1; });

  return (
    <div className="rec-summary-strip">
      {counts.CRITICAL > 0 && (
        <span className="rec-summary-chip rec-summary-chip--critical">
          ⚠ {counts.CRITICAL} Critical
        </span>
      )}
      {counts.IMPROVE > 0 && (
        <span className="rec-summary-chip rec-summary-chip--improve">
          ↑ {counts.IMPROVE} Improve
        </span>
      )}
      {counts.MAINTAIN > 0 && (
        <span className="rec-summary-chip rec-summary-chip--maintain">
          ✓ {counts.MAINTAIN} Maintain
        </span>
      )}
      <span className="rec-summary-source">
        Based on MTU/NCSC Ireland 2025 SME Survey (n=894)
      </span>
    </div>
  );
}

/* ── Domain filter tabs ───────────────────────────────────────── */

const ALL_DOMAINS = ["ALL", "IDENTIFY", "PROTECT", "DETECT", "RESPOND", "RECOVER"];

/* ── Main panel component (exported) ─────────────────────────── */
export default function RecommendationsPanel({ recommendations }) {
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterDomain,   setFilterDomain]   = useState("ALL");
  const [expandAll,      setExpandAll]      = useState(false);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="rec-empty">
        <div className="rec-empty__icon">🏆</div>
        <div className="rec-empty__title">Excellent Security Posture</div>
        <p className="rec-empty__desc">No active recommendations — all key controls are in place.</p>
      </div>
    );
  }

  // Parse all recommendations
  const parsed = recommendations.map((r) => parseRecommendation(r));

  // Sort: CRITICAL → IMPROVE → MAINTAIN, then by gap% desc
  const sorted = [...parsed.map((p, i) => ({ ...p, raw: recommendations[i], idx: i }))]
    .sort((a, b) => {
      const pa = PRIORITY_META[a.priority]?.order ?? 1;
      const pb = PRIORITY_META[b.priority]?.order ?? 1;
      if (pa !== pb) return pa - pb;
      return (b.gapPct ?? 0) - (a.gapPct ?? 0);
    });

  // Filter
  
  const filtered = sorted.filter((p) => {
    const okPriority = filterPriority === "ALL" || p.priority === filterPriority;
    const okDomain   = filterDomain   === "ALL" || p.domain   === filterDomain;
    return okPriority && okDomain;
  });

  const allParsedForStrip = sorted;
  // For summary strip, use all parsed recommendations (not filtered)
  return (
    <div className="rec-panel">
      {/* ── Summary strip ── */}
      <RecSummaryStrip parsed={allParsedForStrip} />

      {/* ── Filter row ── */}
      <div className="rec-filters">
        <div className="rec-filter-group">
          <span className="rec-filter-label">Priority:</span>
          {["ALL", "CRITICAL", "IMPROVE", "MAINTAIN"].map((p) => (
            <button
              key={p}
              className={`rec-filter-btn rec-filter-btn--${p.toLowerCase()} ${filterPriority === p ? "active" : ""}`}
              onClick={() => setFilterPriority(p)}
            >
              {p === "ALL" ? "All" : p === "CRITICAL" ? "⚠ Critical" : p === "IMPROVE" ? "↑ Improve" : "✓ Maintain"}
            </button>
          ))}
        </div>

        <div className="rec-filter-group">
          <span className="rec-filter-label">Domain:</span>
          {ALL_DOMAINS.map((d) => {
            const dm = DOMAIN_META[d];
            return (
              <button
                key={d}
                className={`rec-filter-btn rec-domain-btn ${filterDomain === d ? "active" : ""}`}
                style={filterDomain === d && d !== "ALL" ? {
                  borderColor: dm?.color,
                  color: dm?.color,
                  background: dm?.bg,
                } : {}}
                onClick={() => setFilterDomain(d)}
              >
                {d === "ALL" ? "All Domains" : `${dm?.icon} ${d}`}
              </button>
            );
          })}
        </div>

        <button
          className="rec-expand-all-btn"
          onClick={() => setExpandAll(!expandAll)}
        >
          {expandAll ? "⊖ Collapse All" : "⊕ Expand All"}
        </button>
      </div>

      {/* ── Count line ── */}
      <div className="rec-count-line">
        Showing {filtered.length} of {sorted.length} recommendation{sorted.length !== 1 ? "s" : ""}
        {(filterPriority !== "ALL" || filterDomain !== "ALL") && (
          <button
            className="rec-clear-filters"
            onClick={() => { setFilterPriority("ALL"); setFilterDomain("ALL"); }}
          >
            × Clear filters
          </button>
        )}
      </div>

      {/* ── Cards ── */}
      <div className="rec-cards-list">
        {filtered.length === 0 ? (
          <div className="rec-no-match">No recommendations match the current filters.</div>
        ) : (
          filtered.map((p, i) => (
            <RecCard
              key={p.idx}
              rec={p.raw}
              index={i}
              defaultOpen={expandAll || (p.priority === "CRITICAL" && i === 0)}
            />
          ))
        )}
      </div>
    </div>
  );
}
