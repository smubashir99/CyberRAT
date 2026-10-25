"""
CyberRAT v2 — Results Routes
==============================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Retrieve detailed assessment results and aggregate statistics.

Endpoints:
  GET    /api/results/<id>     — Get full result for a specific assessment
  PUT    /api/results/<id>     — Admin: edit company name / sector / notes
  DELETE /api/results/<id>     — Admin or owner: delete an assessment
  GET    /api/results/all      — Get all results (Admin) or own results
  GET    /api/results/stats    — Aggregate stats across all assessments (Admin)
  GET    /api/results/audit    — Audit log entries (Admin)
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from app.extensions import db

from app.models.assessment import Assessment
from app.models.audit_log import AuditLog, AuditAction
from app.middleware.rbac import require_admin, get_current_user
from app.services.audit import log_event
# Blueprint for results routes
bp = Blueprint("results", __name__, url_prefix="/api/results")


# ─────────────────────────────────────────────────────────────
# GET /api/results/<id>
# ─────────────────────────────────────────────────────────────
@bp.route("/<int:assessment_id>", methods=["GET"])
@jwt_required()
def get_result(assessment_id: int):
    """
    Get full result for a specific assessment.

    Users can only view their own results.
    Admins can view any result.

    Query params:
      ?include_encrypted=true  → include encrypted_answers in response
                                  (only returned to the owning user for
                                   client-side decryption)
    """
    user       = get_current_user()
    assessment = Assessment.query.get(assessment_id)
    # Check if the assessment exists
    if not assessment:
        return jsonify({"error": "Not Found", "message": "Assessment not found."}), 404
    # Check if the user has permission to view this assessment
    if not user.is_admin() and assessment.user_id != user.id:
        return jsonify({
            "error": "Forbidden",
            "message": "You do not have permission to view this assessment."
        }), 403

    # Only return encrypted payload to the owning user
    include_enc = (
        request.args.get("include_encrypted", "false").lower() == "true"
        and assessment.user_id == user.id
    )
    # Log the view event
    log_event(
        action        = AuditAction.ASSESSMENT_VIEWED,
        description   = f"User '{user.email}' viewed assessment #{assessment_id}.",
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
        resource_id   = assessment_id,
        resource_type = "assessment",
    )

    # Build detailed response including submitter info
    result = assessment.to_dict(include_encrypted=include_enc)
    result["submitter"] = {
        "id":       assessment.user.id,
        "email":    assessment.user.email,
        "name":     assessment.user.to_dict()["full_name"],
    } if assessment.user else None

    # Parse recommendations back to list
    if assessment.recommendations:
        result["recommendations_list"] = assessment.recommendations.split(" | ")
    # Return the result as JSON
    return jsonify({"assessment": result}), 200


# ─────────────────────────────────────────────────────────────
# PUT /api/results/<id>
# Admin only: edit editable fields of an existing assessment
# ─────────────────────────────────────────────────────────────
@bp.route("/<int:assessment_id>", methods=["PUT"])
@jwt_required()
def update_result(assessment_id: int):
    """
    Admin or owner (analyst): update editable metadata fields of an assessment.
    - Admin can edit any assessment.
    - Analyst can edit only their own assessments.

    Editable fields:
      - company_name
      - sector
      - company_size

    Score / answers are NOT editable — they are immutable audit records.
    """
    user       = get_current_user()
    assessment = Assessment.query.get(assessment_id)
    # Check if the assessment exists
    if not assessment:
        return jsonify({"error": "Not Found", "message": "Assessment not found."}), 404

    # Admin can edit any; analyst/viewer can only edit their own
    if not user.is_admin() and assessment.user_id != user.id:
        return jsonify({
            "error":   "Forbidden",
            "message": "You do not have permission to edit this assessment."
        }), 403
    # Get JSON payload and track changes
    data    = request.get_json(silent=True) or {}
    changes = []

    # Only allow editing metadata, never scores or answers
    editable = {
        "company_name": str,
        "sector":       str,
        "company_size": str,
    }
    # Update fields if present in the request
    for field, cast in editable.items():
        if field in data:
            new_val = cast(data[field]).strip() if isinstance(data[field], str) else cast(data[field])
            old_val = getattr(assessment, field, None)
            if new_val != old_val:
                setattr(assessment, field, new_val)
                changes.append(f"{field}: {old_val!r} → {new_val!r}")
    # Commit changes if any
    if changes:
        db.session.commit()
    # Log the update event
    log_event(
        action        = "ASSESSMENT_UPDATED",
        description   = (
            f"User '{user.email}' updated assessment #{assessment_id}: "
            + "; ".join(changes) if changes else "no changes"
        ),
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
        resource_id   = assessment_id,
        resource_type = "assessment",
    )
    # Return the updated assessment and list of changes
    return jsonify({
        "message":    "Assessment updated." if changes else "No changes made.",
        "assessment": assessment.to_dict(),
        "changes":    changes,
    }), 200


# ─────────────────────────────────────────────────────────────
# DELETE /api/results/<id>
# Admin: delete any assessment; Analyst/Viewer: delete their own
# ─────────────────────────────────────────────────────────────
@bp.route("/<int:assessment_id>", methods=["DELETE"])
@jwt_required()
def delete_result(assessment_id: int):
    """
    Delete an assessment record.
    - Admin can delete any assessment.
    - Non-admin users can only delete their own assessments.
    """
    user       = get_current_user()
    assessment = Assessment.query.get(assessment_id)
    # Check if the assessment exists
    if not assessment:
        return jsonify({"error": "Not Found", "message": "Assessment not found."}), 404
    # Check if the user has permission to delete this assessment
    if not user.is_admin() and assessment.user_id != user.id:
        return jsonify({
            "error": "Forbidden",
            "message": "You do not have permission to delete this assessment."
        }), 403
    # Delete the assessment and log the event
    company_snapshot = assessment.company_name
    db.session.delete(assessment)
    db.session.commit()
    # Log the deletion event
    log_event(
        action        = AuditAction.ASSESSMENT_DELETED,
        description   = (
            f"User '{user.email}' deleted assessment #{assessment_id} "
            f"({company_snapshot})."
        ),
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
        resource_id   = assessment_id,
        resource_type = "assessment",
    )
    # Return success message
    return jsonify({
        "message": f"Assessment #{assessment_id} deleted successfully.",
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/results/all
# ─────────────────────────────────────────────────────────────
@bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_results():
    """
    Get all results.
    - Admin: all assessments across all users.
    - Analyst/Viewer: only the current user's results.
    """
    user = get_current_user()
    # Check if the user is authenticated
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    #   Fetch assessments based on user role
    if user.is_admin():
        assessments = Assessment.query.order_by(Assessment.created_at.desc()).all()
    else:
        assessments = (
            Assessment.query
            .filter_by(user_id=user.id)
            .order_by(Assessment.created_at.desc())
            .all()
        )
    # Build results list with additional info
    results = []
    for a in assessments:
        r = a.to_dict()
        if a.user:
            r["submitter_email"] = a.user.email
        if a.recommendations:
            r["recommendations_list"] = a.recommendations.split(" | ")
        results.append(r)
    # Return the results as JSON
    return jsonify({
        "results": results,
        "total":   len(results),
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/results/stats
# Admin only
# ─────────────────────────────────────────────────────────────
@bp.route("/stats", methods=["GET"])
@jwt_required()
@require_admin
def get_stats():
    """
    Aggregate statistics across all assessments. Admin only.

    Returns:
      - Total assessments
      - Risk level distribution
      - Average scores per NIST domain
      - Sector breakdown
    """
    # Get total number of assessments
    total = Assessment.query.count()
    # If there are no assessments, return early with empty stats
    if total == 0:
        return jsonify({
            "total": 0,
            "message": "No assessments submitted yet."
        }), 200

    # ---- Risk level distribution ----
    risk_counts = (
        Assessment.query
        .with_entities(Assessment.risk_level, func.count(Assessment.id))
        .group_by(Assessment.risk_level)
        .all()
    )
    # Create a dictionary mapping risk levels to counts
    risk_distribution = {level: count for level, count in risk_counts}

    # ---- Average scores ----
    avg_data = Assessment.query.with_entities(
        func.avg(Assessment.overall_score).label("avg_overall"),
        func.avg(Assessment.score_identify).label("avg_identify"),
        func.avg(Assessment.score_protect).label("avg_protect"),
        func.avg(Assessment.score_detect).label("avg_detect"),
        func.avg(Assessment.score_respond).label("avg_respond"),
        func.avg(Assessment.score_recover).label("avg_recover"),
    ).first()

    avg_scores = {
        "overall":  round(avg_data.avg_overall  or 0, 2),
        "identify": round(avg_data.avg_identify or 0, 2),
        "protect":  round(avg_data.avg_protect  or 0, 2),
        "detect":   round(avg_data.avg_detect   or 0, 2),
        "respond":  round(avg_data.avg_respond  or 0, 2),
        "recover":  round(avg_data.avg_recover  or 0, 2),
    }

    # ---- Sector distribution ----
    sector_counts = (
        Assessment.query
        .with_entities(Assessment.sector, func.count(Assessment.id))
        .group_by(Assessment.sector)
        .all()
    )
    sector_distribution = {sector: count for sector, count in sector_counts}
    # Log the stats retrieval event
    return jsonify({
        "total":               total,
        "risk_distribution":   risk_distribution,
        "average_scores":      avg_scores,
        "sector_distribution": sector_distribution,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/results/audit
# Admin only
# ─────────────────────────────────────────────────────────────
@bp.route("/audit", methods=["GET"])
@jwt_required()
@require_admin
def get_audit_log():
    """
    Retrieve the most recent audit log entries. Admin only.

    Query params:
      ?limit=50  → number of entries to return (default 50, max 200)
      ?action=LOGIN_FAILED → filter by action type
    """
    limit  = min(int(request.args.get("limit", 50)), 200)
    action = request.args.get("action", None)
    # Build the query for audit logs
    query = AuditLog.query.order_by(AuditLog.timestamp.desc())
    # Filter by action if specified
    if action:
        query = query.filter_by(action=action)
    # Fetch the logs with the specified limit
    logs = query.limit(limit).all()
    # Return the logs as JSON
    return jsonify({
        "logs":  [log.to_dict() for log in logs],
        "total": len(logs),
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/results/company-history?company=<name>
# Returns all assessments for a given company name (admin or owner)
# ─────────────────────────────────────────────────────────────
@bp.route("/company-history", methods=["GET"])
@jwt_required()
# Admin or owner: get all assessments for a given company
def get_company_history():
    """
    Return all assessments for a given company name, ordered by date.
    Admin: all matching assessments. Non-admin: only own assessments for that company.

    Query params:
      ?company=<company_name>  (required)
    """
    user         = get_current_user()
    company_name = request.args.get("company", "").strip()
    # Validate that the company name is provided
    if not company_name:
        return jsonify({"error": "Bad Request", "message": "company param is required."}), 400
    # Build the query to fetch assessments for the specified company
    query = Assessment.query.filter(
        Assessment.company_name.ilike(company_name)
    )

    # If the user is not an admin, filter to only their own assessments
    if not user.is_admin():
        query = query.filter_by(user_id=user.id)
    # Fetch the assessments ordered by creation date
    assessments = query.order_by(Assessment.created_at.asc()).all()
    # If no assessments found, return 404
    results = []
    # If no assessments found, return 404
    for a in assessments:
        results.append({
            "id":            a.id,
            "created_at":    a.created_at.isoformat() if a.created_at else None,
            "overall_score": a.overall_score,
            "risk_level":    a.risk_level,
            "scores": {
                "identify": a.score_identify,
                "protect":  a.score_protect,
                "detect":   a.score_detect,
                "respond":  a.score_respond,
                "recover":  a.score_recover,
            },
        })
    # Return the results as JSON
    return jsonify({
        "company":  company_name,
        "history":  results,
        "total":    len(results),
    }), 200
