"""
CyberRAT v2 — User Model
==========================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : SQLAlchemy model for user accounts with role-based access control.

Roles (RBAC):
  ADMIN    — Full access: manage users, view all assessments, delete records
  ANALYST  — Can submit assessments and view own results
  VIEWER   — Read-only: can view published results, cannot submit

Security:
  - Passwords are NEVER stored in plaintext.
  - bcrypt (cost=12) is applied at the model level via set_password().
  - check_password() uses a constant-time comparison to prevent timing attacks.
  - ECDH public key stored per user for encrypted data exchange.

Relationships:
  - One User → Many Assessments (one-to-many)
  - One User → Many AuditLogs  (one-to-many)
"""

import bcrypt
from datetime import datetime
from app.extensions import db


# ----------------------------------------------------------------
# Role Constants — used throughout the codebase for RBAC checks
# ----------------------------------------------------------------
class Role:
    ADMIN   = "admin"
    ANALYST = "analyst"
    VIEWER  = "viewer"

    # All valid roles (used for input validation)
    ALL = [ADMIN, ANALYST, VIEWER]


class User(db.Model):
    """
    SQLite table: user

    Each row represents one registered user of the CyberRAT system.
    Passwords are hashed; plaintext is never stored or logged.
    """

    __tablename__ = "user"

    # ---- Primary key ----
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # ---- Identity ----
    # Email is the unique login identifier
    email      = db.Column(db.String(254), unique=True, nullable=False, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name  = db.Column(db.String(100), nullable=False)

    # ---- Security: Password ----
    # bcrypt hash of the password (60-char string for bcrypt output)
    # NEVER query or expose this field directly in API responses.
    password_hash = db.Column(db.String(255), nullable=False)

    # ---- Role (RBAC) ----
    # "admin" | "analyst" | "viewer"
    role = db.Column(db.String(20), nullable=False, default=Role.ANALYST)

    # ---- ECDH: Client public key (stored as PEM string) ----
    # Populated when the client sends its ECDH public key during key exchange.
    # Used to derive a shared secret for encrypting assessment data.
    ecdh_public_key = db.Column(db.Text, nullable=True)

    # ---- Account status ----
    is_active  = db.Column(db.Boolean, nullable=False, default=True)
    # Track failed login attempts (lock account after 5 failures)
    failed_logins = db.Column(db.Integer, nullable=False, default=0)
    locked_at     = db.Column(db.DateTime, nullable=True)

    # ---- Password Reset ----
    # Stores SHA-256 hash of the reset token (plain token is emailed, never stored)
    reset_token         = db.Column(db.String(64), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)

    # ---- Timestamps ----
    created_at   = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login   = db.Column(db.DateTime, nullable=True)

    # ---- Relationships ----
    # lazy="dynamic" → returns a query object, not a list (efficient for large sets)
    assessments = db.relationship(
        "Assessment", back_populates="user", lazy="dynamic", cascade="all, delete-orphan"
    )
    audit_logs = db.relationship(
        "AuditLog", back_populates="user", lazy="dynamic", cascade="all, delete-orphan"
    )

    # ----------------------------------------------------------------
    # Password methods
    # ----------------------------------------------------------------

    def set_password(self, plaintext_password: str) -> None:
        """
        Hash and store a password using bcrypt (cost=12).

        This method is the ONLY way to set a password. Direct assignment
        to password_hash is intentionally avoided to enforce this.

        Args:
            plaintext_password: The user's chosen password (plaintext).
        """
        # bcrypt.hashpw expects bytes; encode the password to UTF-8
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(plaintext_password.encode("utf-8"), salt)
        # Store as a decoded string (bcrypt output is ASCII-safe)
        self.password_hash = hashed.decode("utf-8")

    def check_password(self, plaintext_password: str) -> bool:
        """
        Verify a plaintext password against the stored bcrypt hash.

        Uses bcrypt.checkpw() which performs a constant-time comparison,
        preventing timing-based side-channel attacks.

        Args:
            plaintext_password: The password provided at login.

        Returns:
            True if password matches, False otherwise.
        """
        if not self.password_hash:
            return False
        return bcrypt.checkpw(
            plaintext_password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    # ----------------------------------------------------------------
    # Role helpers
    # ----------------------------------------------------------------

    def is_admin(self) -> bool:
        """Return True if this user has the Admin role."""
        return self.role == Role.ADMIN

    def is_analyst(self) -> bool:
        """Return True if this user has the Analyst role."""
        return self.role == Role.ANALYST

    def can_submit_assessment(self) -> bool:
        """Return True if this user is allowed to submit new assessments."""
        return self.role in [Role.ADMIN, Role.ANALYST]

    # ----------------------------------------------------------------
    # Serialisation
    # ----------------------------------------------------------------

    def to_dict(self, include_sensitive=False) -> dict:
        """
        Serialise user to a JSON-safe dictionary.

        Args:
            include_sensitive: If True, include fields like failed_logins
                               (only shown to admins).

        Returns:
            dict — safe to return in API responses.
            Note: password_hash is NEVER included, regardless of flag.
        """
        data = {
            "id":         self.id,
            "email":      self.email,
            "first_name": self.first_name,
            "last_name":  self.last_name,
            "full_name":  f"{self.first_name} {self.last_name}",
            "role":       self.role,
            "is_active":  self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat()  if self.last_login  else None,
        }
        if include_sensitive:
            data["failed_logins"]        = self.failed_logins
            data["locked_at"]            = self.locked_at.isoformat() if self.locked_at else None
            data["reset_token_expires"]  = self.reset_token_expires.isoformat() if self.reset_token_expires else None
        return data

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
