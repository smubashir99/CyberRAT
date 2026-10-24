"""
CyberRAT v2 — OTP (One-Time Password) Model
=============================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Stores email OTP codes for two-factor login verification.

Design:
  - OTP is a 6-digit numeric code, valid for 10 minutes.
  - Each login attempt generates a new OTP, invalidating previous ones.
  - Used and expired codes are soft-deleted by marking used=True.
  - OTP codes are hashed (SHA-256) before storage — never stored in plaintext.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from app.extensions import db


class OTPCode(db.Model):
    """
    SQLite table: otp_code

    Stores hashed OTP codes sent during the login OTP-challenge step.
    Each record belongs to one user and has a short TTL.
    """

    __tablename__ = "otp_code"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(
        db.Integer,
        db.ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # SHA-256 hash of the 6-digit code — never store raw OTP
    code_hash  = db.Column(db.String(64), nullable=False)
    # When this OTP expires (10 minutes from creation)
    expires_at = db.Column(db.DateTime, nullable=False)
    # Once used, mark consumed so it cannot be reused
    used       = db.Column(db.Boolean, nullable=False, default=False)
    # Created timestamp for audit trail
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # ----------------------------------------------------------------
    # Class-level helpers
    # ----------------------------------------------------------------

    @classmethod
    def generate_code(cls) -> str:
        """Generate a cryptographically secure 6-digit OTP string."""
        return f"{secrets.randbelow(900000) + 100000}"
    @classmethod
    def hash_code(cls, code: str) -> str:
        """Return the SHA-256 hex digest of a code string."""
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    @classmethod
    def create_for_user(cls, user_id: int) -> tuple:
        """
        Invalidate all existing unused OTPs for this user,
        then create a fresh 6-digit OTP valid for 10 minutes.

        Returns:
            (otp_record, plaintext_code)
        """
        # Invalidate any previous unused codes for this user
        cls.query.filter_by(user_id=user_id, used=False).update({"used": True})
        db.session.flush()

        plaintext = cls.generate_code()
        record = cls(
            user_id    = user_id,
            code_hash  = cls.hash_code(plaintext),
            expires_at = datetime.utcnow() + timedelta(minutes=10),
        )
        db.session.add(record)
        db.session.commit()
        return record, plaintext

    @classmethod
    def verify_for_user(cls, user_id: int, code: str) -> bool:
        """
        Check whether the supplied code is valid for this user.

        A code is valid when:
          - It matches the stored hash
          - It has not expired
          - It has not been used

        Side-effect: if valid, marks the code as used.

        Returns:
            True if valid, False otherwise.
        """
        record = (
            cls.query
            .filter_by(
                user_id   = user_id,
                code_hash = cls.hash_code(code),
                used      = False,
            )
            .filter(cls.expires_at > datetime.utcnow())
            .first()
        )
        if record:
            record.used = True
            db.session.commit()
            return True
        return False

    def __repr__(self):
        # Return a concise representation of the OTP record for debugging.
        return (
            f"<OTPCode user_id={self.user_id} "
            f"expires={self.expires_at} used={self.used}>"
        )
