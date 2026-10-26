"""
CyberRAT v2 — PDF Export Route
================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Generate a professional PDF report for an assessment.

Endpoint:
  GET /api/export/assessment/<id>/pdf
"""

import io
from datetime import datetime

from flask import Blueprint, send_file, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.assessment import Assessment
from app.middleware.rbac import get_current_user
from app.services.audit import log_event

bp = Blueprint("export", __name__, url_prefix="/api/export")

# ── Cybersecurity dark theme colour palette ────────────────────
# Backgrounds (dark charcoal / navy)
C_PAGE_BG     = (0.082, 0.094, 0.118)   # #151820 — very dark page bg
C_DARK        = (0.094, 0.110, 0.141)   # #181c24 — dark charcoal
C_CARD        = (0.118, 0.137, 0.173)   # #1e2330 — card surface
C_CARD2       = (0.141, 0.165, 0.204)   # #242a34 — alternate row
C_HEADER      = (0.059, 0.071, 0.094)   # #0f1218 — header band

# Text
C_WHITE       = (1.000, 1.000, 1.000)
C_TEXT        = (0.878, 0.906, 0.945)   # #e0e7f1 — body text light
C_MUTED       = (0.455, 0.510, 0.588)   # #748296 — muted/dim text
C_DIM         = (0.259, 0.306, 0.369)   # #424e5e — very dim text

# Accent colours
C_CYAN        = (0.000, 0.831, 0.871)   # #00d4de — primary cyber accent
C_CYAN_DIM    = (0.000, 0.400, 0.420)   # #00666b — dim cyan for borders
C_BLUE        = (0.157, 0.478, 0.922)   # #287aeb — secondary blue
C_BORDER      = (0.196, 0.231, 0.290)   # #323b4a — card border

# Risk / threat level colours (bright on dark bg)
C_LOW         = (0.196, 0.918, 0.494)   # #32ea7e — bright green
C_MEDIUM      = (0.996, 0.761, 0.118)   # #fec21e — amber/gold
C_HIGH        = (1.000, 0.431, 0.200)   # #ff6e33 — orange
C_CRITICAL    = (1.000, 0.216, 0.216)   # #ff3737 — red alert

# Risk badge backgrounds (slightly tinted dark)
C_LOW_BG      = (0.059, 0.176, 0.094)   # #0f2d18 — dark green bg
C_MEDIUM_BG   = (0.196, 0.157, 0.039)   # #32280a — dark amber bg
C_HIGH_BG     = (0.220, 0.118, 0.047)   # #381e0c — dark orange bg
C_CRITICAL_BG = (0.220, 0.059, 0.059)   # #380f0f — dark red bg

RISK_COLORS = {
    "Low":      C_LOW,
    "Medium":   C_MEDIUM,
    "High":     C_HIGH,
    "Critical": C_CRITICAL,
}
RISK_BG = {
    "Low":      C_LOW_BG,
    "Medium":   C_MEDIUM_BG,
    "High":     C_HIGH_BG,
    "Critical": C_CRITICAL_BG,
}

def _rgb(t):
    from reportlab.lib.colors import Color
    return Color(*t)


def _generate_pdf(assessment, user) -> bytes:
    """Build a polished executive cybersecurity dark-theme PDF report."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm, mm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
            HRFlowable, KeepTogether,
        )
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.lib.colors import Color
        from reportlab.graphics.shapes import Drawing, Rect, String, Line
    except ImportError:
        raise RuntimeError("reportlab is not installed.")

    PAGE_W, PAGE_H = A4
    MARGIN   = 1.9 * cm
    CONTENT_W = PAGE_W - 2 * MARGIN
    
    buf = io.BytesIO()

    # ── Helper: section divider banner ─────────────────────────────
    def _section_banner(num_str, title_str, w=CONTENT_W):
        """Cyan-accented section header bar — replaces plain Paragraph h2."""
        BH = 28
        d  = Drawing(w, BH)
        # Full-width dark background
        d.add(Rect(0, 0, w, BH, fillColor=_rgb(C_DARK), strokeColor=None))
        # Cyan left bar
        d.add(Rect(0, 0, 3, BH, fillColor=_rgb(C_CYAN), strokeColor=None))
        # Section number pill
        d.add(Rect(8, 5, 22, 18, fillColor=_rgb(C_CYAN), strokeColor=None, rx=2, ry=2))
        d.add(String(10, 9, num_str,
                     fontName="Helvetica-Bold", fontSize=8,
                     fillColor=Color(0.05, 0.06, 0.08)))
        # Title
        d.add(String(36, 9, title_str.upper(),
                     fontName="Helvetica-Bold", fontSize=9,
                     fillColor=Color(*C_TEXT)))
        # Dotted rule to right edge
        for dx in range(36 + len(title_str) * 6 + 12, int(w) - 6, 5):
            d.add(Rect(dx, BH // 2 - 0.5, 2, 1,
                       fillColor=_rgb(C_CYAN_DIM), strokeColor=None))
        return d

    # ── Document ───────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=MARGIN, leftMargin=MARGIN,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title=f"CyberRAT Assessment — {assessment.company_name}",
        author="CyberRAT v2 · DBS Dublin",
    )

    acc      = _rgb(C_CYAN)
    cyan_dim = _rgb(C_CYAN_DIM)
    border   = _rgb(C_BORDER)
    txt      = _rgb(C_TEXT)
    muted    = _rgb(C_MUTED)
    rc  = RISK_COLORS.get(assessment.risk_level, C_CRITICAL)
    rb  = RISK_BG.get(assessment.risk_level, C_CRITICAL_BG)

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    STYLES = {
        "label": S("label", fontName="Helvetica-Bold", fontSize=7,
                   textColor=_rgb(C_CYAN), leading=10),
        "val":   S("val",   fontName="Helvetica-Bold", fontSize=9.5,
                   textColor=txt, leading=14),
        "tbl_header": S("tbl_header", fontName="Helvetica-Bold", fontSize=8,
                        textColor=_rgb(C_CYAN), leading=11),
        "tbl_cell":   S("tbl_cell", fontName="Helvetica", fontSize=9,
                        textColor=txt, leading=12),
        "tbl_cell_bold": S("tbl_cell_bold", fontName="Helvetica-Bold",
                           fontSize=9, textColor=txt, leading=12),
        "footer": S("footer", fontName="Courier", fontSize=7,
                    textColor=_rgb(C_MUTED), leading=10, alignment=TA_CENTER),
    }

    def _score_color(s):
        if s >= 8.0: return _rgb(C_LOW)
        if s >= 6.0: return _rgb(C_MEDIUM)
        if s >= 4.0: return _rgb(C_HIGH)
        return _rgb(C_CRITICAL)

    def _score_label(s):
        if s >= 8.0: return "STRONG"
        if s >= 6.0: return "MODERATE"
        if s >= 4.0: return "WEAK"
        return "CRITICAL"

    story = []

    # ════════════════════════════════════════════════════════════════
    # HEADER — full-width banner with grid + score badge
    # ════════════════════════════════════════════════════════════════
    HEADER_H = 108
    hdr = Drawing(CONTENT_W, HEADER_H)

    # Base dark fill
    hdr.add(Rect(0, 0, CONTENT_W, HEADER_H,
                 fillColor=_rgb(C_HEADER), strokeColor=None))

    # Dot-matrix grid overlay
    for gx in range(0, int(CONTENT_W), 22):
        for gy in range(0, HEADER_H, 22):
            hdr.add(Rect(gx, gy, 1, 1,
                         fillColor=_rgb(C_BORDER), strokeColor=None))

    # Gradient-like dark fade on left 58% (text legibility)
    hdr.add(Rect(0, 0, CONTENT_W * 0.60, HEADER_H,
                 fillColor=Color(0.059, 0.071, 0.094, 0.92), strokeColor=None))

    # Bottom cyan accent line
    hdr.add(Rect(0, 0, CONTENT_W, 3, fillColor=_rgb(C_CYAN), strokeColor=None))

    # Left cyan stripe
    hdr.add(Rect(0, 3, 4, HEADER_H - 3, fillColor=_rgb(C_CYAN), strokeColor=None))

    # "CLASSIFIED / CONFIDENTIAL" style top bar
    hdr.add(Rect(0, HEADER_H - 14, CONTENT_W, 14,
                 fillColor=Color(0.0, 0.831, 0.871, 0.12), strokeColor=None))
    tag1 = "CYBERSECURITY RISK ASSESSMENT"
    tag2 = "NIST CSF  //  DBS DUBLIN  //  DISSERTATION 2026"
    hdr.add(String(12, HEADER_H - 10, tag1,
                   fontName="Courier-Bold", fontSize=6.5,
                   fillColor=Color(*C_CYAN)))
    hdr.add(String(CONTENT_W - len(tag2) * 4.35 - 6, HEADER_H - 10, tag2,
                   fontName="Courier", fontSize=6.5,
                   fillColor=Color(*C_MUTED)))

    # Main title
    hdr.add(String(14, HEADER_H - 34,
                   "CyberRAT v2",
                   fontName="Helvetica-Bold", fontSize=22,
                   fillColor=Color(*C_CYAN)))

    # Subtitle
    hdr.add(String(14, HEADER_H - 52,
                   "Cybersecurity Risk Assessment Report",
                   fontName="Helvetica-Bold", fontSize=10.5,
                   fillColor=Color(*C_WHITE)))

    # Company line — Courier with >> prefix
    co = assessment.company_name or "Unknown"
    hdr.add(String(14, HEADER_H - 68,
                   f">>  {co}",
                   fontName="Courier-Bold", fontSize=9,
                   fillColor=Color(0.65, 0.84, 1.0)))

    # Date line
    date_str = (assessment.created_at.strftime("%d %B %Y")
                if assessment.created_at else "—")
    hdr.add(String(14, HEADER_H - 83,
                   f"Date: {date_str}",
                   fontName="Courier", fontSize=7.5,
                   fillColor=Color(*C_MUTED)))

    # ── Score badge (right) ─────────────────────────────────────
    BX, BY, BW, BH2 = CONTENT_W - 96, 10, 86, 82

    # Outer glow ring
    hdr.add(Rect(BX - 3, BY - 3, BW + 6, BH2 + 6,
                 fillColor=Color(*rc, alpha=0.12), strokeColor=None, rx=6, ry=6))
    # Card
    hdr.add(Rect(BX, BY, BW, BH2,
                 fillColor=Color(0.094, 0.110, 0.141),
                 strokeColor=Color(*rc), strokeWidth=1.8, rx=5, ry=5))
    # Top label band
    hdr.add(Rect(BX, BY + BH2 - 16, BW, 16,
                 fillColor=Color(*rc, alpha=0.18), strokeColor=None,
                 rx=5, ry=5))
    hdr.add(String(BX + BW / 2 - 18, BY + BH2 - 11,
                   "RISK  SCORE",
                   fontName="Courier-Bold", fontSize=6.5,
                   fillColor=Color(*rc)))

    # Score number (centred)
    score_str = f"{assessment.overall_score:.1f}"
    hdr.add(String(BX + BW / 2 - len(score_str) * 7.5,
                   BY + BH2 - 42,
                   score_str,
                   fontName="Helvetica-Bold", fontSize=26,
                   fillColor=Color(*rc)))
    # /10.0 sub-label
    hdr.add(String(BX + BW / 2 - 12, BY + BH2 - 54,
                   "/ 10.0",
                   fontName="Courier", fontSize=7,
                   fillColor=Color(*C_MUTED)))
    # Separator line
    hdr.add(Line(BX + 10, BY + BH2 - 58, BX + BW - 10, BY + BH2 - 58,
                 strokeColor=Color(*rc, alpha=0.4), strokeWidth=0.6))

    # Risk level pill
    rl = (assessment.risk_level or "N/A").upper()
    hdr.add(Rect(BX + 10, BY + 8, BW - 20, 17,
                 fillColor=Color(*rc), strokeColor=None, rx=3, ry=3))
    hdr.add(String(BX + BW / 2 - len(rl) * 3.6,
                   BY + 13,
                   rl,
                   fontName="Helvetica-Bold", fontSize=8,
                   fillColor=Color(0.04, 0.05, 0.07)))

    story.append(hdr)
    story.append(Spacer(1, 10))

    # ════════════════════════════════════════════════════════════════
    # SECTION 1 — ASSESSMENT OVERVIEW
    # ════════════════════════════════════════════════════════════════
    story.append(_section_banner("01", "Assessment Overview"))
    story.append(Spacer(1, 6))

    submitter = user.to_dict()["full_name"] if user else "—"

    meta_data = [
        [
            Paragraph("ORGANISATION", STYLES["label"]),
            Paragraph(assessment.company_name or "—", STYLES["val"]),
            Paragraph("REPORT DATE", STYLES["label"]),
            Paragraph(date_str, STYLES["val"]),
        ],
        [
            Paragraph("SECTOR", STYLES["label"]),
            Paragraph(assessment.sector or "—", STYLES["val"]),
            Paragraph("ASSESSED BY", STYLES["label"]),
            Paragraph(submitter, STYLES["val"]),
        ],
        [
            Paragraph("ORG SIZE", STYLES["label"]),
            Paragraph(assessment.company_size or "—", STYLES["val"]),
            Paragraph("ASSESSMENT ID", STYLES["label"]),
            Paragraph(f"CRA-{assessment.id:04d}", STYLES["val"]),
        ],
    ]

    meta_tbl = Table(meta_data, colWidths=[2.6*cm, 6.6*cm, 2.8*cm, 5.5*cm])
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), _rgb(C_CARD)),
        ("BACKGROUND",    (0, 1), (-1, 1),  _rgb(C_CARD2)),
        ("BOX",           (0, 0), (-1, -1), 0.8, cyan_dim),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, border),
        ("LINEBEFORE",    (2, 0), (2, -1),  0.8, cyan_dim),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 12))

    # ════════════════════════════════════════════════════════════════
    # SECTION 2 — NIST DOMAIN SCORES
    # ════════════════════════════════════════════════════════════════
    story.append(_section_banner("02", "NIST CSF Domain Scores"))
    story.append(Spacer(1, 6))

    domains = [
        ("Identify",  assessment.score_identify or 0.0),
        ("Protect",   assessment.score_protect  or 0.0),
        ("Detect",    assessment.score_detect   or 0.0),
        ("Respond",   assessment.score_respond  or 0.0),
        ("Recover",   assessment.score_recover  or 0.0),
    ]

    score_header = [
        Paragraph("DOMAIN",  STYLES["tbl_header"]),
        Paragraph("SCORE",   STYLES["tbl_header"]),
        Paragraph("STATUS",  STYLES["tbl_header"]),
        Paragraph("VISUAL",  STYLES["tbl_header"]),
    ]
    score_rows = [score_header]
    for domain, score in domains:
        filled = max(0, min(10, int(round(score))))
        bar_str = "|" * filled + "." * (10 - filled)
        score_rows.append([
            Paragraph(domain, STYLES["tbl_cell_bold"]),
            Paragraph(f"{score:.2f} / 10", ParagraphStyle(
                "sc", fontName="Courier-Bold", fontSize=10,
                textColor=_score_color(score), leading=13)),
            Paragraph(_score_label(score), ParagraphStyle(
                "ss", fontName="Helvetica-Bold", fontSize=7.5,
                textColor=_score_color(score), leading=11)),
            Paragraph(bar_str, ParagraphStyle(
                "bs", fontName="Courier-Bold", fontSize=9,
                textColor=_score_color(score), leading=11)),
        ])

    # Overall row
    ov_rc = RISK_COLORS.get(assessment.risk_level, C_CRITICAL)
    score_rows.append([
        Paragraph("OVERALL SCORE", ParagraphStyle(
            "oh", fontName="Helvetica-Bold", fontSize=9,
            textColor=_rgb(C_CYAN), leading=12)),
        Paragraph(f"{assessment.overall_score:.2f} / 10", ParagraphStyle(
            "ov", fontName="Courier-Bold", fontSize=11,
            textColor=_rgb(ov_rc), leading=14)),
        Paragraph(assessment.risk_level or "—", ParagraphStyle(
            "rl", fontName="Helvetica-Bold", fontSize=9,
            textColor=_rgb(ov_rc), leading=12)),
        Paragraph("", STYLES["tbl_cell"]),
    ])

    score_tbl = Table(score_rows,
                      colWidths=[3.4*cm, 3.3*cm, 2.8*cm, 8.0*cm])
    rs = [
        ("BACKGROUND",    (0, 0), (-1, 0),  _rgb(C_DARK)),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.5, acc),
        ("BOX",           (0, 0), (-1, -1), 0.8, cyan_dim),
        ("LINEBELOW",     (0, 1), (-1, -2), 0.3, border),
        ("BACKGROUND",    (0, -1), (-1, -1), _rgb(C_DARK)),
        ("LINEABOVE",     (0, -1), (-1, -1), 1.5, acc),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(score_rows) - 1):
        rs.append(("BACKGROUND", (0, i), (-1, i),
                   _rgb(C_CARD if i % 2 == 1 else C_CARD2)))
    score_tbl.setStyle(TableStyle(rs))
    story.append(score_tbl)
    story.append(Spacer(1, 14))

    # ════════════════════════════════════════════════════════════════
    # SECTION 3 — DOMAIN SCORE CHART
    # ════════════════════════════════════════════════════════════════
    CHART_W  = CONTENT_W
    BAR_H    = 24
    BAR_GAP  = 14
    LABEL_W  = 80
    SCORE_W  = 42
    AXIS_H   = 24
    BAR_AREA = CHART_W - LABEL_W - SCORE_W - 10
    CHART_H  = len(domains) * (BAR_H + BAR_GAP) + BAR_GAP + AXIS_H + 12

    chart = Drawing(CHART_W, CHART_H)
    chart.add(Rect(0, 0, CHART_W, CHART_H,
                   fillColor=_rgb(C_CARD), strokeColor=cyan_dim, strokeWidth=0.8))

    # Grid lines
    for pct in [0, 2, 4, 6, 8, 10]:
        x = LABEL_W + (pct / 10) * BAR_AREA
        chart.add(Line(x, AXIS_H, x, CHART_H - 6,
                       strokeColor=_rgb(C_BORDER), strokeWidth=0.5))
        lbl = str(pct)
        chart.add(String(x - len(lbl) * 2.5, AXIS_H - 15, lbl,
                         fontName="Courier", fontSize=7,
                         fillColor=Color(*C_MUTED)))

    # Axis line
    chart.add(Line(LABEL_W, AXIS_H, LABEL_W + BAR_AREA, AXIS_H,
                   strokeColor=acc, strokeWidth=1.2))

    for idx, (domain, score) in enumerate(domains):
        y = AXIS_H + BAR_GAP + (len(domains) - 1 - idx) * (BAR_H + BAR_GAP)
        bar_w = max(0.0, (score / 10.0) * BAR_AREA)

        if score >= 8.0:   dc = C_LOW;      dc_bg = C_LOW_BG
        elif score >= 6.0: dc = C_MEDIUM;   dc_bg = C_MEDIUM_BG
        elif score >= 4.0: dc = C_HIGH;     dc_bg = C_HIGH_BG
        else:              dc = C_CRITICAL; dc_bg = C_CRITICAL_BG

        chart.add(String(6, y + BAR_H / 2 - 4, domain,
                         fontName="Courier-Bold", fontSize=8,
                         fillColor=Color(*C_TEXT)))

        # Track
        chart.add(Rect(LABEL_W, y, BAR_AREA, BAR_H,
                       fillColor=Color(*dc_bg), strokeColor=Color(*dc),
                       strokeWidth=0.3))
        # Filled bar
        if bar_w > 0:
            chart.add(Rect(LABEL_W, y, bar_w, BAR_H,
                           fillColor=Color(*dc), strokeColor=None))
            # Highlight edge (glow)
            chart.add(Line(LABEL_W, y + BAR_H,
                           LABEL_W + bar_w, y + BAR_H,
                           strokeColor=Color(min(dc[0]+0.35, 1),
                                             min(dc[1]+0.35, 1),
                                             min(dc[2]+0.35, 1)),
                           strokeWidth=1.2))

        chart.add(String(LABEL_W + BAR_AREA + 6, y + BAR_H / 2 - 4,
                         f"{score:.1f}",
                         fontName="Courier-Bold", fontSize=9,
                         fillColor=Color(*dc)))

    story.append(KeepTogether([
        _section_banner("03", "Domain Score Chart"),
        Spacer(1, 6),
        chart,
        Spacer(1, 12),
    ]))

    # ════════════════════════════════════════════════════════════════
    # SECTION 4 — RISK ASSESSMENT SUMMARY
    # ════════════════════════════════════════════════════════════════
    story.append(_section_banner("04", "Risk Assessment Summary"))
    story.append(Spacer(1, 6))

    _risk_summaries = {
        "Low": (
            f"This assessment recorded an overall score of <b>{assessment.overall_score:.2f}/10</b>, "
            f"placing <b>{assessment.company_name}</b> in the <b>LOW risk</b> category. "
            "Security controls are largely effective across all NIST CSF domains. "
            "Continued monitoring, staff awareness training, and incremental improvements "
            "are recommended to sustain this posture."
        ),
        "Medium": (
            f"This assessment recorded an overall score of <b>{assessment.overall_score:.2f}/10</b>, "
            f"placing <b>{assessment.company_name}</b> in the <b>MEDIUM risk</b> category. "
            "Several control areas require targeted investment and remediation. "
            "A structured remediation plan should be developed and prioritised "
            "to close the identified gaps before they escalate."
        ),
        "High": (
            f"This assessment recorded an overall score of <b>{assessment.overall_score:.2f}/10</b>, "
            f"placing <b>{assessment.company_name}</b> in the <b>HIGH risk</b> category. "
            "Significant security deficiencies have been identified. "
            "Immediate remediation is strongly recommended to reduce exposure "
            "to data breaches and operational disruption."
        ),
        "Critical": (
            f"This assessment recorded an overall score of <b>{assessment.overall_score:.2f}/10</b>, "
            f"placing <b>{assessment.company_name}</b> in the <b>CRITICAL risk</b> category. "
            "Severe security deficiencies have been identified. Urgent and comprehensive action is required. "
            "The organisation faces heightened risk of data breaches, regulatory penalties, "
            "and significant operational disruption without immediate intervention."
        ),
    }
    summary_text = _risk_summaries.get(
        assessment.risk_level,
        f"Overall score: {assessment.overall_score:.2f}/10.  "
        f"Risk level: {assessment.risk_level or 'Unknown'}."
    )

    summary_tbl = Table(
        [[Paragraph(summary_text, ParagraphStyle(
            "sp", fontName="Helvetica", fontSize=9.5,
            textColor=_rgb(C_TEXT), leading=15.5))]],
        colWidths=[CONTENT_W],
    )
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), _rgb(rb)),
        ("BOX",           (0, 0), (-1, -1), 1.5, _rgb(rc)),
        ("LINEBEFORE",    (0, 0), (0, -1),  5.0, _rgb(rc)),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 12))

    # ════════════════════════════════════════════════════════════════
    # SECTION 5 — RECOMMENDATIONS
    # ════════════════════════════════════════════════════════════════
    if assessment.recommendations:
        story.append(_section_banner("05", "Remediation Recommendations"))
        story.append(Spacer(1, 6))

        recos = [r.strip() for r in assessment.recommendations.split(" | ") if r.strip()]

        for i, reco in enumerate(recos, 1):
            reco_lower = reco.lower()
            if any(k in reco_lower for k in ["immediately", "urgent", "critical", "mfa", "multi-factor"]):
                ic, ibg, pri = C_CRITICAL, C_CRITICAL_BG, "CRITICAL"
            elif any(k in reco_lower for k in ["high", "patch", "encrypt", "firewall"]):
                ic, ibg, pri = C_HIGH, C_HIGH_BG, "HIGH"
            elif any(k in reco_lower for k in ["medium", "monitor", "review", "update", "train"]):
                ic, ibg, pri = C_MEDIUM, C_MEDIUM_BG, "MEDIUM"
            else:
                ic, ibg, pri = C_LOW, C_LOW_BG, "LOW"

            reco_tbl = Table(
                [[
                    Paragraph(f"{i:02d}", ParagraphStyle(
                        "rn", fontName="Courier-Bold", fontSize=11,
                        textColor=_rgb(ic), leading=13, alignment=TA_CENTER)),
                    Paragraph(reco, ParagraphStyle(
                        "rt", fontName="Helvetica", fontSize=9,
                        textColor=_rgb(C_TEXT), leading=14)),
                    Paragraph(pri, ParagraphStyle(
                        "rb", fontName="Helvetica-Bold", fontSize=6.5,
                        textColor=_rgb(C_DARK), leading=9, alignment=TA_CENTER)),
                ]],
                colWidths=[0.9*cm, CONTENT_W - 3.4*cm, 1.9*cm],
            )
            reco_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (0, 0),  _rgb(ibg)),
                ("BACKGROUND",    (1, 0), (1, 0),  _rgb(C_CARD)),
                ("BACKGROUND",    (2, 0), (2, 0),  _rgb(ic)),
                ("BOX",           (0, 0), (-1, -1), 0.8, _rgb(ic)),
                ("LINEAFTER",     (0, 0), (0, 0),  1.0, _rgb(ic)),
                ("LINEBEFORE",    (0, 0), (0, 0),  3.5, _rgb(ic)),
                ("LINEBEFORE",    (2, 0), (2, 0),  0.8, _rgb(ic)),
                ("TOPPADDING",    (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING",   (0, 0), (0, 0),  5),
                ("LEFTPADDING",   (1, 0), (1, 0),  10),
                ("LEFTPADDING",   (2, 0), (2, 0),  4),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(reco_tbl)
            story.append(Spacer(1, 4))

    # ════════════════════════════════════════════════════════════════
    # FOOTER
    # ════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.0,
                            color=cyan_dim, spaceAfter=5, spaceBefore=0))
    story.append(Paragraph(
        f"[ CYBERRAT v2  //  "
        f"{datetime.utcnow().strftime('%d %b %Y  %H:%M UTC')}  //  "
        f"Syed Mubashir Ahmed Hashmi (20089221)  //  "
        "MSc Information Systems  //  Dublin Business School  //  ACADEMIC USE ONLY ]",
        STYLES["footer"]
    ))

    # ── Dark page background + page decorations ────────────────────
    def _page_bg(canvas, doc):
        canvas.saveState()
        # Dark bg
        canvas.setFillColor(_rgb(C_PAGE_BG))
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # Dot grid
        canvas.setFillColor(_rgb(C_BORDER))
        for gx in range(0, int(PAGE_W), 22):
            for gy in range(0, int(PAGE_H), 22):
                canvas.rect(gx, gy, 1, 1, fill=1, stroke=0)
        # Corner brackets
        canvas.setStrokeColor(_rgb(C_CYAN_DIM))
        canvas.setLineWidth(0.9)
        m, bl = 7, 18
        for (x1, y1, x2, y2), (x3, y3, x4, y4) in [
            ((m, PAGE_H-m, m+bl, PAGE_H-m), (m, PAGE_H-m, m, PAGE_H-m-bl)),
            ((PAGE_W-m, PAGE_H-m, PAGE_W-m-bl, PAGE_H-m), (PAGE_W-m, PAGE_H-m, PAGE_W-m, PAGE_H-m-bl)),
            ((m, m, m+bl, m), (m, m, m, m+bl)),
            ((PAGE_W-m, m, PAGE_W-m-bl, m), (PAGE_W-m, m, PAGE_W-m, m+bl)),
        ]:
            canvas.line(x1, y1, x2, y2)
            canvas.line(x3, y3, x4, y4)
        # Page number (bottom centre)
        canvas.setFont("Courier", 7)
        canvas.setFillColor(_rgb(C_MUTED))
        canvas.drawCentredString(PAGE_W / 2, 12,
            f"PAGE {doc.page}  //  CYBERRAT v2  //  CONFIDENTIAL")
        canvas.restoreState()

    doc.build(story, onFirstPage=_page_bg, onLaterPages=_page_bg)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────
# GET /api/export/assessment/<id>/pdf
# ─────────────────────────────────────────────────────────────
@bp.route("/assessment/<int:assessment_id>/pdf", methods=["GET"])
@jwt_required()
def export_pdf(assessment_id: int):
    """
    Export an assessment as a professional PDF report.
    Admin: any assessment. Analyst/Viewer: own assessments only.
    """
    user       = get_current_user()
    assessment = Assessment.query.get(assessment_id)

    if not assessment:
        return jsonify({"error": "Not Found", "message": "Assessment not found."}), 404

    if not user.is_admin() and assessment.user_id != user.id:
        return jsonify({"error": "Forbidden", "message": "Access denied."}), 403

    try:
        pdf_bytes = _generate_pdf(assessment, user)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "PDF Error", "message": str(exc)}), 500

    log_event(
        action        = "ASSESSMENT_EXPORTED_PDF",
        description   = f"User '{user.email}' exported assessment #{assessment_id} as PDF.",
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
        resource_id   = assessment_id,
        resource_type = "assessment",
    )

    safe_name = "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in (assessment.company_name or "assessment")
    )
    filename = f"CyberRAT_Assessment_{assessment_id}_{safe_name}.pdf"

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )
