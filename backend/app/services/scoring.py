"""
CyberRAT v2 — CRAF Scoring Engine
======================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Compute cybersecurity risk scores from assessment answers
          using the framework scoring formula.

──────────────────────────────────────────────────────────────────
Framework Scoring Formula:
──────────────────────────────────────────────────────────────────

  Overall Score = Σ(Cᵢ × Wᵢ) / 89 × 10

  Where:
    Cᵢ  = Criterion score (0.0 = non-compliant, 0.5 = partial, 1.0 = compliant)
    Wᵢ  = Criterion weight (from the framework)
    89  = Maximum possible weighted sum (Σ all weights)
    10  = Scale factor (output range: 0.0 – 10.0)

  Score Bands:
    8.0 – 10.0  → Low Risk       (Strong security posture)
    6.0 – 7.9   → Medium Risk    (Adequate but improvable)
    4.0 – 5.9   → High Risk      (Significant gaps)
    0.0 – 3.9   → Critical Risk  (Immediate action required)

──────────────────────────────────────────────────────────────────
10 Framework Criteria (mapped to NIST CSF Domains):
──────────────────────────────────────────────────────────────────

  Criteria are empirically grounded in MTU/NCSC Ireland SME
  Cybersecurity Survey 2025 (n=894 Irish SMEs).
  Each criterion maps to a MEASURED control with a known adoption rate.
  Weights are assigned proportional to adoption GAP severity:
    lower adoption = higher weight (bigger real-world risk gap)

  Source: CafeBrid_Dataset_v3.xlsx — MTU_Control_Indicators sheet

  C1  (W=10) RECOVER    — Automated Data Backup         (adoption: 26%)
  C2  (W=10) PROTECT    — Multi-Factor Authentication   (adoption: 39%)
  C3  (W=10) RESPOND    — Cyber Incident Response Plan  (adoption: 22%)
  C4  (W= 9) PROTECT    — Cybersecurity Training        (adoption: 26%)
  C5  (W= 9) RECOVER    — Business Continuity Plan      (adoption: 35%)
  C6  (W= 8) PROTECT    — Password Length Policy ≥12    (adoption: 38%)
  C7  (W= 9) IDENTIFY   — Documented Cyber Policy       (adoption: 12%)
  C8  (W= 9) PROTECT    — Network Security Controls     (adoption: 30%)
  C9  (W= 8) PROTECT    — Automatic Software Updates    (adoption: 39%)
  C10 (W= 7) PROTECT    — VPN for Remote Access         (adoption: 24%)

  Total max weight = 10+10+10+9+9+8+9+9+8+7 = 89

  Benchmark Reference (MTU/NCSC 2025):
    Irish Retail sector average = 4.4/10 (n=894)
    Café Bríd baseline (A001) = 3.93/10 → Critical Risk
──────────────────────────────────────────────────────────────────
"""

from typing import Dict, List, Any


# ----------------------------------------------------------------
# Criterion weights (CRAF framework)
# Empirically grounded in MTU/NCSC Ireland Survey 2025 (n=894).
# Weight = f(adoption gap): controls with lowest SME adoption
# receive highest weights as they represent the greatest risk gap.
#
# Source: CafeBrid_Dataset_v3.xlsx — MTU_Control_Indicators
# ----------------------------------------------------------------
CRITERION_WEIGHTS: Dict[str, int] = {
    "c1_data_backup":            10,   # Automated Data Backup         (adoption: 26%, gap: 74%)
    "c2_mfa":                    10,   # Multi-Factor Authentication   (adoption: 39%, gap: 61%)
    "c3_incident_response":      10,   # Cyber Incident Response Plan  (adoption: 22%, gap: 78%)
    "c4_security_training":       9,   # Cybersecurity Training        (adoption: 26%, gap: 74%)
    "c5_business_continuity":     9,   # Business Continuity Plan      (adoption: 35%, gap: 65%)
    "c6_password_policy":         8,   # Password Length Policy ≥12    (adoption: 38%, gap: 62%)
    "c7_cyber_policy":            9,   # Documented Cyber Policy       (adoption: 12%, gap: 88%)
    "c8_network_security":        9,   # Network Security Controls     (adoption: 30%, gap: 70%)
    "c9_software_updates":        8,   # Automatic Software Updates    (adoption: 39%, gap: 61%)
    "c10_vpn_remote":             7,   # VPN for Remote Access         (adoption: 24%, gap: 76%)
}
# Maximum possible weighted sum (denominator for normalisation)
MAX_WEIGHTED_SUM: int = sum(CRITERION_WEIGHTS.values())  # 89

# MTU/NCSC 2025 Irish SME sector benchmarks (for comparison)
# Source: CafeBrid_Dataset_v3.xlsx — MTU_Sector_Data sheet
SECTOR_BENCHMARKS: Dict[str, float] = {
    "retail":                4.4,
    "technology":            6.2,
    "finance & banking":     7.1,
    "healthcare":            5.8,
    "manufacturing":         4.9,
    "professional services": 5.5,
    "education":             5.1,
    "government":            6.8,
    "logistics & transport": 4.7,
    "other":                 4.4,   # Default to Retail (closest SME average)
}

# MTU/NCSC 2025 Irish SME control adoption rates (%)
# Source: CafeBrid_Dataset_v3.xlsx — MTU_Control_Indicators sheet
CONTROL_ADOPTION_RATES: Dict[str, int] = {
    "c1_data_backup":           26,
    "c2_mfa":                   39,
    "c3_incident_response":     22,
    "c4_security_training":     26,
    "c5_business_continuity":   35,
    "c6_password_policy":       38,
    "c7_cyber_policy":          12,
    "c8_network_security":      30,
    "c9_software_updates":      39,
    "c10_vpn_remote":           24,
}

# ----------------------------------------------------------------
# NIST CSF domain → criterion mapping
# ----------------------------------------------------------------
NIST_DOMAINS: Dict[str, List[str]] = {
    "identify": ["c7_cyber_policy"],
    "protect":  ["c2_mfa", "c4_security_training",
                 "c6_password_policy", "c8_network_security", "c9_software_updates", "c10_vpn_remote"],
    "detect":   [],   # No standalone detect criterion (covered by network security)
    "respond":  ["c3_incident_response"],
    "recover":  ["c1_data_backup", "c5_business_continuity"],
}

# Maximum weighted sum per domain (for normalising domain scores to 0-10)
# Note: 'detect' has no standalone criterion in MTU/NCSC dataset controls
# but is kept for NIST CSF completeness; score = 0 if no criteria mapped.
DOMAIN_MAX: Dict[str, int] = {
    domain: sum(CRITERION_WEIGHTS[c] for c in criteria) if criteria else 1
    for domain, criteria in NIST_DOMAINS.items()
}


# ----------------------------------------------------------------
# Score-to-risk-band mapping
# ----------------------------------------------------------------
def get_sector_benchmark(sector: str) -> float:
    """
    Return the MTU/NCSC 2025 sector average score for a given sector.
    Data source: CafeBrid_Dataset_v3.xlsx — MTU_Sector_Data sheet

    Args:
        sector: Sector name (case-insensitive).

    Returns:
        Sector average score (0–10), or 4.4 (Retail average) as default.
    """
    return SECTOR_BENCHMARKS.get(sector.lower().strip(), 4.4)


def get_risk_level(score: float) -> str:
    """
    Map a numeric score (0.0–10.0) to a qualitative risk band.

    Args:
        score: Overall security score.

    Returns:
        Risk level string: "Low", "Medium", "High", or "Critical".
    """
    # Map score to risk level based on defined bands
    if score >= 8.0:
        return "Low"
    elif score >= 6.0:
        return "Medium"
    elif score >= 4.0:
        return "High"
    else:
        return "Critical"


# ----------------------------------------------------------------
# Key/value normaliser
# Maps frontend short keys (c1–c10, values 1–5) to scoring keys.
# These short keys match AssessmentPage.js criterion ids exactly.
# ----------------------------------------------------------------
FRONTEND_KEY_MAP: Dict[str, str] = {
    "c1":  "c1_data_backup",
    "c2":  "c2_mfa",
    "c3":  "c3_incident_response",
    "c4":  "c4_security_training",
    "c5":  "c5_business_continuity",
    "c6":  "c6_password_policy",
    "c7":  "c7_cyber_policy",
    "c8":  "c8_network_security",
    "c9":  "c9_software_updates",
    "c10": "c10_vpn_remote",
}


def normalise_answers(raw: Dict) -> Dict[str, float]:
    """
    Normalise answers from any supported format to the internal format.

    Supported input formats:
      A) Frontend format: { "c1": 3, "c2": 5, ... }  (values 1–5)
      B) Internal format: { "c1_asset_inventory": 0.5, ... }  (values 0/0.5/1)

    Converts format A → B.  Format B is passed through unchanged.
    """
    # Map frontend short keys to internal long keys and convert 1–5 scale to 0/0.5/1.0
    normalised = {}
    for raw_key, raw_val in raw.items():
        # Map short key to full key if needed
        full_key = FRONTEND_KEY_MAP.get(str(raw_key).lower(), raw_key)

        # Convert 1–5 scale to 0/0.5/1.0
        # Frontend always sends integers 1, 3, or 5 (never 0/0.5 floats)
        # The old check `raw_val > 1.0` was broken: value 1 (No) failed
        # the check and was treated as 1.0 (fully compliant) instead of 0.0.
        # Fix: treat any integer ≥1 as frontend 1-5 scale; only pass
        # through if the key was already a long key (internal format).
        raw_key_str = str(raw_key).lower()
        is_frontend_key = raw_key_str in FRONTEND_KEY_MAP
        is_long_key     = raw_key_str in CRITERION_WEIGHTS
        # If the key is a frontend short key or a numeric value ≥1 (frontend scale),
        if is_frontend_key or (isinstance(raw_val, (int, float)) and raw_val >= 1 and not is_long_key):
            # 1–5 scale: 1-2 → 0.0, 3 → 0.5, 4-5 → 1.0
            if raw_val >= 4:
                normalised[full_key] = 1.0
            elif raw_val >= 3:
                normalised[full_key] = 0.5
            else:
                normalised[full_key] = 0.0
        else:
            # Already 0/0.5/1.0 scale (internal long key format)
            normalised[full_key] = float(raw_val)

    return normalised


# ----------------------------------------------------------------
# Main scoring function
# ----------------------------------------------------------------
def compute_score(answers: Dict[str, float]) -> Dict[str, Any]:
    """
    Compute the full framework score from a dict of criterion answers.

    Args:
        answers: Dict mapping criterion keys to scores.
                 Each value must be 0.0 (non-compliant),
                 0.5 (partially compliant), or 1.0 (fully compliant).
                 Example:
                   {
                     "c1_asset_inventory": 1.0,
                     "c2_risk_assessment": 0.5,
                     ...
                   }

    Returns:
        Dict with keys:
          overall_score   — float 0.0–10.0
          risk_level      — "Low" | "Medium" | "High" | "Critical"
          domain_scores   — { identify, protect, detect, respond, recover }
          weighted_sum    — raw weighted total (pre-scaling)
          max_sum         — 89 (the denominator)
          recommendations — list of recommendation strings
    """
    # Normalise from frontend format (c1–c10, 1–5 scale) if needed
    answers = normalise_answers(answers)

    # Validate and sanitise inputs
    sanitised = {}
    for key in CRITERION_WEIGHTS:
        raw = answers.get(key, 0.0)
        # Clamp to valid values: 0.0, 0.5, or 1.0
        if raw >= 0.9:
            sanitised[key] = 1.0
        elif raw >= 0.4:
            sanitised[key] = 0.5
        else:
            sanitised[key] = 0.0

    # ---- Compute overall weighted score ----
    weighted_sum = sum(
        sanitised[criterion] * weight
        for criterion, weight in CRITERION_WEIGHTS.items()
    )
    overall_score = round((weighted_sum / MAX_WEIGHTED_SUM) * 10, 2)

    # ---- Compute per-domain scores ----
    domain_scores = {}
    for domain, criteria in NIST_DOMAINS.items():
        domain_weighted = sum(
            sanitised[c] * CRITERION_WEIGHTS[c] for c in criteria
        )
        domain_score = round((domain_weighted / DOMAIN_MAX[domain]) * 10, 2)
        domain_scores[domain] = domain_score

    # ---- Risk level ----
    risk_level = get_risk_level(overall_score)

    # ---- Generate targeted recommendations ----
    recommendations = generate_recommendations(sanitised, domain_scores, risk_level)

    return {
        "overall_score":      overall_score,
        "risk_level":         risk_level,
        "domain_scores":      domain_scores,
        "weighted_sum":       round(weighted_sum, 2),
        "max_sum":            MAX_WEIGHTED_SUM,
        "recommendations":    recommendations,
        "criterion_scores":   {k: sanitised[k] for k in CRITERION_WEIGHTS},
        "control_adoption":   CONTROL_ADOPTION_RATES,  # For frontend benchmark display
    }


# ----------------------------------------------------------------
# Recommendation generator
# Each template aligned to MTU/NCSC 2025 Irish SME survey findings.
# Adoption rates from CafeBrid_Dataset_v3.xlsx — MTU_Control_Indicators
# ----------------------------------------------------------------
RECOMMENDATION_TEMPLATES: Dict[str, str] = {
    "c1_data_backup": (
        "RECOVER — Automated Data Backup [Gap: 74% of Irish SMEs lack this]: "
        "Enable automated daily backups of all critical business data. Store backups "
        "offsite or in a cloud service (e.g., Azure Backup, AWS S3). Test restoration "
        "monthly — an untested backup is not a backup. This is the single most effective "
        "defence against ransomware: with backups, you can recover without paying ransom."
    ),
    "c2_mfa": (
        "PROTECT — Multi-Factor Authentication [Gap: 61% of Irish SMEs lack MFA]: "
        "Enable MFA immediately on all business email, cloud services, and remote access. "
        "Microsoft Authenticator, Google Authenticator, or hardware keys (YubiKey) are "
        "free or low-cost. MFA prevents 99.9% of password-based account takeovers. "
        "NIS2 Directive (Article 21) requires MFA for in-scope entities."
    ),
    "c3_incident_response": (
        "RESPOND — Cyber Incident Response Plan [Gap: 78% of Irish SMEs have no IRP]: "
        "Document a formal Incident Response Plan covering: (1) Who to call internally, "
        "(2) Who to notify (NCSC Ireland: www.ncsc.gov.ie), (3) How to contain the attack, "
        "(4) Evidence preservation steps, (5) Communication to customers/staff. "
        "Run a 1-hour tabletop exercise annually. NCSC Ireland provides free IRP templates."
    ),
    "c4_security_training": (
        "PROTECT — Cybersecurity Awareness Training [Gap: 74% of Irish SMEs provide no training]: "
        "Deliver mandatory cybersecurity training to all staff at least annually. "
        "Cover: phishing recognition, password hygiene, safe browsing, incident reporting. "
        "NCSC Ireland's 'Cyber Essentials' programme provides free training materials. "
        "Human error accounts for 82% of data breaches (Verizon DBIR 2024)."
    ),
    "c5_business_continuity": (
        "RECOVER — Business Continuity Plan [Gap: 65% of Irish SMEs have no BCP]: "
        "Create a BCP covering cyberattack scenarios. Define: RTO (maximum acceptable "
        "downtime), RPO (maximum acceptable data loss), and manual fallback procedures. "
        "60% of SMEs that suffer a major cyberattack with no BCP close within 6 months (NCSC UK). "
        "Test your BCP annually — schedule it now."
    ),
    "c6_password_policy": (
        "PROTECT — Password Length Policy [Gap: 62% of Irish SMEs have no policy]: "
        "Enforce a minimum 12-character password policy for all business accounts. "
        "Implement technically (Active Directory Group Policy, Entra ID, or per-app settings). "
        "Deploy a password manager (Bitwarden, 1Password) for staff — eliminates password reuse. "
        "NCSC Ireland recommends passphrases (3+ random words) over complex but short passwords."
    ),
    "c7_cyber_policy": (
        "IDENTIFY — Documented Cybersecurity Policy [Gap: 88% of Irish SMEs have no policy — highest gap]: "
        "This is the single largest control gap in Irish SMEs. Write a 1–2 page cybersecurity policy "
        "covering: acceptable use, data classification, incident reporting, remote work rules, and "
        "BYOD guidelines. Communicate it to all staff and get sign-off. "
        "NIS2 Directive (2024) requires documented cyber policies for in-scope SMEs. "
        "ENISA provides free policy templates: www.enisa.europa.eu"
    ),
    "c8_network_security": (
        "PROTECT — Network Security Controls [Gap: 70% of Irish SMEs have inadequate network security]: "
        "Implement: (1) Next-gen firewall on your internet connection, (2) Separate guest Wi-Fi from "
        "staff network — this stops malware from spreading, (3) Disable unused ports and services, "
        "(4) DNS filtering to block malicious domains (Cloudflare 1.1.1.1 is free). "
        "Network segmentation limits lateral movement — a compromised device cannot reach all systems."
    ),
    "c9_software_updates": (
        "PROTECT — Automatic Software Updates [Gap: 61% of Irish SMEs do not auto-update]: "
        "Enable automatic security updates for: Windows/macOS, browsers (Chrome/Firefox/Edge), "
        "Office suite, antivirus definitions, and all business software. "
        "Apply critical patches within 72 hours of release. "
        "57% of successful cyberattacks exploit known vulnerabilities with available patches. "
        "Schedule monthly maintenance windows for larger update cycles."
    ),
    "c10_vpn_remote": (
        "PROTECT — VPN for Remote Access [Gap: 76% of Irish remote-work SMEs lack VPN]: "
        "All remote access to business systems must go through a VPN. "
        "Cost-effective options: WireGuard (free, open-source), NordLayer, or Cisco AnyConnect. "
        "Combine VPN with MFA (C2) for maximum security. "
        "Without a VPN, remote workers on public Wi-Fi expose business data to interception. "
        "Post-pandemic, this is now a baseline NIS2 requirement for remote-capable organisations."
    ),
}


def generate_recommendations(
    sanitised_answers: Dict[str, float],
    domain_scores: Dict[str, float],
    risk_level: str
) -> List[str]:
    """
    Generate prioritised recommendations based on criterion scores.

    Logic:
      1. Any criterion scored 0.0 → CRITICAL recommendation (must address)
      2. Any criterion scored 0.5 → IMPROVEMENT recommendation (should address)
      3. If all criteria scored 1.0 → maintenance recommendations only

    Returns a list of recommendation strings (max 10, prioritised by weight).
    """
    recommendations = []

    # Sort criteria by weight descending (highest-weight gaps addressed first)
    sorted_criteria = sorted(
        CRITERION_WEIGHTS.keys(),
        key=lambda k: CRITERION_WEIGHTS[k],
        reverse=True
    )
    # Generate recommendations for each criterion based on score
    for criterion in sorted_criteria:
        score = sanitised_answers.get(criterion, 0.0)
        if score < 1.0:  # non-compliant or partial
            rec = RECOMMENDATION_TEMPLATES.get(criterion, "")
            if rec:
                prefix = "[CRITICAL] " if score == 0.0 else "[IMPROVE] "
                recommendations.append(prefix + rec)

    # If no gaps found, add a maintenance recommendation
    if not recommendations:
        recommendations.append(
            "[MAINTAIN] Excellent security posture. Continue regular risk reviews, "
            "staff training, and patch management to sustain your Low Risk rating. "
            "Consider pursuing ISO 27001 certification to formalise your controls."
        )
    # Limit to top 10 recommendations
    return recommendations
