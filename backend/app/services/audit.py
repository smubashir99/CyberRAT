"""
CyberRAT v2 — Audit Service
=============================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Centralised helper for writing immutable audit log entries.

Usage (anywhere in the codebase):
    from flask import request
    from app.services.audit import log_event
    from app.models.audit_log import AuditAction

    log_event(
        action      = AuditAction.LOGIN_SUCCESS,
        description = f"User {email} authenticated successfully.",
        user_id     = user.id,
        user_email  = user.email,
        status_code = 200,
    )

All writes go through this module to enforce the INSERT-ONLY rule.
"""

from datetime import datetime
from flask import request as flask_request

from app.extensions import db
from app.models.audit_log import AuditLog, AuditAction

# -------------------- Audit Logging Service --------------------
def log_event(
    action: str,
    description: str = None,
    user_id: int = None,
    user_email: str = None,
    status_code: int = None,
    resource_id: int = None,
    resource_type: str = None,
) -> AuditLog:
    """
    Create and persist an immutable audit log entry.

    This function extracts HTTP context automatically from the Flask
    request context (IP address, endpoint, HTTP method). It is safe
    to call outside a request context — those fields will be None.

    Args:
        action        : AuditAction constant (e.g., AuditAction.LOGIN_SUCCESS).
        description   : Human-readable event description.
        user_id       : ID of the user who performed the action (nullable).
        user_email    : Email of the user (kept even if user is later deleted).
        status_code   : HTTP response status code (200, 401, 403, etc.).
        resource_id   : ID of the affected resource (e.g., assessment ID).
        resource_type : Type of affected resource (e.g., "assessment", "user").

    Returns:
        The created AuditLog instance (already committed to the database).
    """

    # Extract HTTP context from Flask request (if available)
    ip_address  = None
    endpoint    = None
    http_method = None
    # If this function is called outside a Flask request context (e.g., from a CLI command),
    # accessing flask_request will raise a RuntimeError. We catch that and leave the fields as None.
    try:
        ip_address  = flask_request.remote_addr
        endpoint    = flask_request.path
        http_method = flask_request.method
    except RuntimeError:
        # No active Flask request context (e.g., called from CLI seed command)
        pass
    # Create the audit log entry
    entry = AuditLog(
        user_id       = user_id,
        user_email    = user_email,
        action        = action,
        description   = description,
        ip_address    = ip_address,
        endpoint      = endpoint,
        http_method   = http_method,
        status_code   = status_code,
        resource_id   = resource_id,
        resource_type = resource_type,
        timestamp     = datetime.utcnow(),
    )
    # Add the entry to the session and commit. If commit fails, log to stderr but do not raise an exception.
    db.session.add(entry)

    try:
        db.session.commit()
    except Exception as e:
        # Audit log failures must NEVER break the main application flow.
        # Log to stderr and roll back only the audit entry.
        db.session.rollback()
        print(f"[CyberRAT Audit] WARNING: Failed to write audit log: {e}")

    return entry

#-------------------- Audit Retrieval Helpers --------------------
def get_recent_logs(limit: int = 50) -> list:
    """
    Retrieve the most recent audit log entries (for admin dashboard).

    Args:
        limit: Maximum number of entries to return.

    Returns:
        List of AuditLog instances ordered by timestamp descending.
    """
    return (
        AuditLog.query
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )

#-------------------- User-Specific Audit Retrieval --------------------
def get_user_logs(user_id: int, limit: int = 20) -> list:
    """
    Retrieve audit log entries for a specific user.

    Args:
        user_id: The user's primary key.
        limit:   Maximum number of entries to return.

    Returns:
        List of AuditLog instances for that user, newest first.
    """
    return (
        AuditLog.query
        .filter_by(user_id=user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
