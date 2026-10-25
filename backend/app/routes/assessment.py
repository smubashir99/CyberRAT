"""
CyberRAT v2 — Assessment Routes
==================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Submit, list, and delete cybersecurity assessments.

Endpoints:
  POST   /api/assessment/submit      — Submit a new assessment (Analyst/Admin)
  GET    /api/assessment/list        — List own assessments (Analyst) / all (Admin)
  DELETE /api/assessment/<id>        — Delete own assessment / any (Admin)

Security:
  - Answers are received encrypted (AES-256-GCM) from the client.
  - The server decrypts using the ECDH-derived shared key.
  - Decrypted answers are scored, then re-encrypted for storage.
  - Scores are stored plaintext for aggregation.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.user import Role
from app.models.assessment import Assessment
from app.models.audit_log import AuditAction
from app.middleware.rbac import require_analyst, get_current_user
from app.services.scoring import compute_score
from app.services.crypto import (
    compute_shared_secret,
    encrypt_aes_gcm,
    decrypt_aes_gcm,
    generate_session_key_id,
)
from app.services.audit import log_event
## Blueprint for assessment routes
bp = Blueprint("assessment", __name__, url_prefix="/api/assessment")


# ─────────────────────────────────────────────────────────────
# POST /api/assessment/submit
# ─────────────────────────────────────────────────────────────
@bp.route("/submit", methods=["POST"])
@jwt_required()
@require_analyst
def submit_assessment():
    """
    Submit a new cybersecurity risk assessment.

    The client sends answers either:
      (a) Plain JSON (if no ECDH key exchange was performed)
      (b) Encrypted payload (preferred, after ECDH key exchange)

    Request body (plain):
        {
          "company_name": "Acme Ltd",
          "sector":       "Healthcare",
          "company_size": "Small",
          "answers": {
            "c1_asset_inventory": 1.0,
            "c2_risk_assessment": 0.5,
            "c3_access_control":  0.0,
            ...
          }
        }

    Request body (encrypted via ECDH):
        {
          "company_name":    "Acme Ltd",
          "sector":          "Healthcare",
          "company_size":    "Small",
          "client_public_key": "-----BEGIN PUBLIC KEY-----\n...",
          "encrypted_payload": {
            "ciphertext": "base64...",
            "iv":         "base64...",
            "auth_tag":   "base64..."
          }
        }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Bad Request", "message": "JSON body required."}), 400

    user = get_current_user()

    # ---- Required metadata ----
    company_name = data.get("company_name", "").strip()
    sector       = data.get("sector", "").strip()
    company_size = data.get("company_size", "").strip()

    if not all([company_name, sector, company_size]):
        return jsonify({
            "error": "Validation Error",
            "message": "Fields 'company_name', 'sector', and 'company_size' are required."
        }), 422

    # ---- Resolve assessment answers ----
    session_key_id   = None
    encrypted_payload = None
    # Check if the request contains an encrypted payload and a client public key
    if "encrypted_payload" in data and "client_public_key" in data:
        # ── ENCRYPTED PATH (ECDH + AES-256-GCM) ──────────────
        try:
            aes_key = compute_shared_secret(data["client_public_key"])
        except ValueError as e:
            return jsonify({"error": "Bad Request", "message": str(e)}), 400

        ep = data["encrypted_payload"]
        try:
            answers = decrypt_aes_gcm(
                ciphertext_b64 = ep["ciphertext"],
                iv_b64         = ep["iv"],
                auth_tag_b64   = ep["auth_tag"],
                aes_key        = aes_key,
            )
        except Exception as e:
            return jsonify({
                "error": "Decryption Failed",
                "message": "Could not decrypt assessment payload. Data may have been tampered with."
            }), 400

        # Store the client's ECDH public key for future reference
        user.ecdh_public_key = data["client_public_key"]
        session_key_id = generate_session_key_id()

        # Re-encrypt with a fresh server-side key for at-rest storage
        encrypted_payload = encrypt_aes_gcm(answers, aes_key)

    elif "answers" in data:
        # ── PLAIN PATH (development / testing only) ───────────
        answers = data["answers"]
        # Encrypt the answers before storing (always store encrypted)
        import os, json
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import base64
        # Use a random one-time key for at-rest encryption (server-only)
        ephemeral_key = os.urandom(32)
        encrypted_payload = encrypt_aes_gcm(answers, ephemeral_key)
        session_key_id = generate_session_key_id()
    else:
        return jsonify({
            "error": "Validation Error",
            "message": "Provide either 'answers' (plain) or 'encrypted_payload' + 'client_public_key'."
        }), 422

    # ---- Score the assessment ----
    score_result = compute_score(answers)
    recommendations_str = " | ".join(score_result["recommendations"])

    # ---- Persist ----
    assessment = Assessment(
        user_id            = user.id,
        company_name       = company_name,
        sector             = sector,
        company_size       = company_size,
        encrypted_answers  = encrypted_payload["ciphertext"],
        iv                 = encrypted_payload["iv"],
        auth_tag           = encrypted_payload["auth_tag"],
        session_key_id     = session_key_id,
        overall_score      = score_result["overall_score"],
        risk_level         = score_result["risk_level"],
        score_identify     = score_result["domain_scores"]["identify"],
        score_protect      = score_result["domain_scores"]["protect"],
        score_detect       = score_result["domain_scores"]["detect"],
        score_respond      = score_result["domain_scores"]["respond"],
        score_recover      = score_result["domain_scores"]["recover"],
        recommendations    = recommendations_str,
    )
    # Add to DB
    db.session.add(assessment)
    db.session.commit()
    # Log the submission event
    log_event(
        action        = AuditAction.ASSESSMENT_SUBMITTED,
        description   = (
            f"User '{user.email}' submitted assessment for '{company_name}' "
            f"(score: {score_result['overall_score']}, risk: {score_result['risk_level']})."
        ),
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 201,
        resource_id   = assessment.id,
        resource_type = "assessment",
    )
    # Return the assessment details and scoring results
    return jsonify({
        "message":    "Assessment submitted successfully.",
        "assessment": assessment.to_dict(),
        "scoring": {
            "overall_score":  score_result["overall_score"],
            "risk_level":     score_result["risk_level"],
            "domain_scores":  score_result["domain_scores"],
            "recommendations": score_result["recommendations"],
        }
    }), 201


# ─────────────────────────────────────────────────────────────
# GET /api/assessment/list
# ─────────────────────────────────────────────────────────────
@bp.route("/list", methods=["GET"])
@jwt_required()
def list_assessments():
    """
    List assessments.
    - Admin: returns ALL assessments across all users.
    - Analyst/Viewer: returns only the current user's assessments.
    """
    # Get the current user from the JWT token
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.is_admin():
        assessments = Assessment.query.order_by(Assessment.created_at.desc()).all()
    else:
        assessments = (
            Assessment.query
            .filter_by(user_id=user.id)
            .order_by(Assessment.created_at.desc())
            .all()
        )
    # Return the list of assessments as JSON
    return jsonify({
        "assessments": [a.to_dict() for a in assessments],
        "total":       len(assessments),
    }), 200


# ─────────────────────────────────────────────────────────────
# DELETE /api/assessment/<id>
# ─────────────────────────────────────────────────────────────
@bp.route("/<int:assessment_id>", methods=["DELETE"])
@jwt_required()
def delete_assessment(assessment_id: int):
    """
    Delete an assessment.
    - Users can delete their own assessments.
    - Admins can delete any assessment.
    """
    user       = get_current_user()
    assessment = Assessment.query.get(assessment_id)
    # Check if the assessment exists
    if not assessment:
        return jsonify({"error": "Not Found", "message": "Assessment not found."}), 404
    
    # Ownership check
    if not user.is_admin() and assessment.user_id != user.id:
        return jsonify({
            "error": "Forbidden",
            "message": "You do not have permission to delete this assessment."
        }), 403
    # Delete the assessment
    company = assessment.company_name
    db.session.delete(assessment)
    db.session.commit()
    # Log the deletion event
    log_event(
        action        = AuditAction.ASSESSMENT_DELETED,
        description   = f"User '{user.email}' deleted assessment #{assessment_id} ('{company}').",
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
        resource_id   = assessment_id,
        resource_type = "assessment",
    )
    # Return success message
    return jsonify({"message": f"Assessment #{assessment_id} deleted."}), 200
