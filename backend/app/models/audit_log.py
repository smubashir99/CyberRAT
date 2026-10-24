"""
CyberRAT v2 — Audit Log Model
===============================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Immutable audit trail for all security-relevant events.

The audit log records every security-relevant action:
  - User login (success / failure)
  - User registration
  - Assessment submitted
  - Assessment result viewed
  - Admin actions (user management, deletions)
  - ECDH key exchange

Why this matters for the dissertation:
  The audit log directly demonstrates the DETECT and RESPOND domains
  of the AI-CRAF framework — the tool models what it assesses.

Design:
  - Rows are INSERT-only. No UPDATE or DELETE is permitted.
  - user_id is nullable to capture pre-authentication events
    (e.g., failed login attempts on a non-existent account).
"""

from datetime import datetime
from app.extensions import db


# ---- Action constants (used throughout the codebase) ----
class AuditAction:
    # Authentication
    LOGIN_SUCCESS   = "LOGIN_SUCCESS"
    LOGIN_FAILED    = "LOGIN_FAILED"
    LOGOUT          = "LOGOUT"
    TOKEN_REFRESHED = "TOKEN_REFRESHED"
    REGISTER        = "REGISTER"

    # Assessments
    ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED"
    ASSESSMENT_VIEWED    = "ASSESSMENT_VIEWED"
    ASSESSMENT_DELETED   = "ASSESSMENT_DELETED"

    # Profile self-service
    USER_UPDATE          = "USER_UPDATE"
    PASSWORD_CHANGED     = "PASSWORD_CHANGED"

    # Admin
    USER_ROLE_CHANGED    = "USER_ROLE_CHANGED"
    USER_DEACTIVATED     = "USER_DEACTIVATED"
    USER_LISTED          = "USER_LISTED"

    # Cryptography
    ECDH_KEY_EXCHANGE    = "ECDH_KEY_EXCHANGE"


class AuditLog(db.Model):
    """
    SQLite table: audit_log

    Immutable record of every security-relevant event in the system.
    This table should only ever be INSERTed into — never UPDATEd or DELETEd.
    """

    __tablename__ = "audit_log"

    # ---- Primary key ----
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # ---- Who performed the action ----
    # Nullable for pre-auth events (failed login on unknown email)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    user = db.relationship("User", back_populates="audit_logs")

    # Email captured separately (so we keep the record even if user is deleted)
    user_email = db.Column(db.String(254), nullable=True)

    # ---- What happened ----
    action      = db.Column(db.String(50),  nullable=False, index=True)
    description = db.Column(db.String(500), nullable=True)

    # ---- Context ----
    # IP address of the request (anonymised in GDPR-sensitive deployments)
    ip_address  = db.Column(db.String(45),  nullable=True)
    # Which HTTP endpoint was called
    endpoint    = db.Column(db.String(200), nullable=True)
    # HTTP method (GET, POST, DELETE, etc.)
    http_method = db.Column(db.String(10),  nullable=True)
    # HTTP status code returned (200, 401, 403, etc.)
    status_code = db.Column(db.Integer,     nullable=True)

    # ---- Related resource (optional) ----
    # e.g., assessment_id for ASSESSMENT_SUBMITTED events
    resource_id   = db.Column(db.Integer, nullable=True)
    resource_type = db.Column(db.String(50), nullable=True)

    # ---- Timestamp ----
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # ----------------------------------------------------------------
    # Serialisation
    # ----------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "user_email":    self.user_email,
            "action":        self.action,
            "description":   self.description,
            "ip_address":    self.ip_address,
            "endpoint":      self.endpoint,
            "http_method":   self.http_method,
            "status_code":   self.status_code,
            "resource_id":   self.resource_id,
            "resource_type": self.resource_type,
            "timestamp":     self.timestamp.isoformat() if self.timestamp else None,
        }

    def __repr__(self):
        return (
            f"<AuditLog id={self.id} action='{self.action}' "
            f"user='{self.user_email}' ts='{self.timestamp}'>"
        )
