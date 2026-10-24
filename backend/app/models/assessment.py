"""
CyberRAT v2 — Assessment Model
================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : SQLAlchemy model for cybersecurity risk assessments.

Security design:
  - The 10 criterion answers (c1–c10) are AES-256-GCM ENCRYPTED before being stored in the database.
  - The encryption key is derived from the ECDH shared secret (unique per user session).
  - This means even if the database is compromised, raw assessment answers cannot be read without the ECDH private key.
  - encrypted_answers: stores the ciphertext (base64-encoded)
  - iv: the AES-GCM Initialisation Vector (unique per encryption)
  - tag: the GCM authentication tag (detects tampering)

Calculated scores (overall + 5 NIST domains) are stored in plaintext
as they are needed for aggregation/reporting queries.
"""

from datetime import datetime
from app.extensions import db


class Assessment(db.Model):
    """
    SQLite table: assessment

    Stores one row per completed CyberRAT risk assessment.
    Answers are encrypted using AES-256-GCM; scores are plaintext.
    """

    __tablename__ = "assessment"

    # ---- Primary key ----
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # ---- Foreign key: which user submitted this assessment ----
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user = db.relationship("User", back_populates="assessments")

    # ---- Company / SME information ----
    company_name = db.Column(db.String(200), nullable=False)
    sector       = db.Column(db.String(100), nullable=False)
    # Micro (<10), Small (10-49), Medium (50-249)
    company_size = db.Column(db.String(50),  nullable=False)

    # ---- Encrypted assessment answers ----
    # The JSON of 10 criterion answers, encrypted with AES-256-GCM.
    # Format: {"c1_mfa": 0.5, "c2_patching": 1.0, ...}
    # Stored as base64-encoded ciphertext string.
    encrypted_answers = db.Column(db.Text, nullable=False)

    # AES-GCM Initialisation Vector (base64-encoded, 12 bytes / 96 bits)
    # Must be unique for every encryption operation.
    iv = db.Column(db.String(32), nullable=False)

    # AES-GCM Authentication Tag (base64-encoded, 16 bytes / 128 bits)
    # Verifies ciphertext has not been tampered with.
    auth_tag = db.Column(db.String(32), nullable=False)

    # ECDH ephemeral session key identifier (links to key exchange record)
    # Stored so we know which shared secret was used for this assessment.
    session_key_id = db.Column(db.String(64), nullable=True)

    # ---- Calculated risk scores (stored plaintext for queries) ----
    # Overall score: 0.0 – 10.0 (higher = better security posture)
    overall_score  = db.Column(db.Float, nullable=False, default=0.0)
    # Risk band: "Low" | "Medium" | "High" | "Critical"
    risk_level     = db.Column(db.String(20), nullable=False, default="Critical")

    # NIST CSF per-domain scores (0.0 – 10.0 each)
    score_identify = db.Column(db.Float, nullable=False, default=0.0)
    score_protect  = db.Column(db.Float, nullable=False, default=0.0)
    score_detect   = db.Column(db.Float, nullable=False, default=0.0)
    score_respond  = db.Column(db.Float, nullable=False, default=0.0)
    score_recover  = db.Column(db.Float, nullable=False, default=0.0)

    # Pipe-separated list of recommended actions generated from the score
    recommendations = db.Column(db.Text, nullable=True)

    # ---- Timestamps ----
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ----------------------------------------------------------------
    # Serialisation
    # ----------------------------------------------------------------

    def to_dict(self, include_encrypted=False) -> dict:
        """
        Serialise to JSON-safe dict.

        Args:
            include_encrypted: If True, include encrypted_answers, iv, auth_tag
                               (only provided to the owning user for client-side decryption).

        Returns:
            dict — safe for API responses.
        """
        data = {
            "id":           self.id,
            "user_id":      self.user_id,
            "company_name": self.company_name,
            "sector":       self.sector,
            "company_size": self.company_size,
            "scores": {
                "overall":    round(self.overall_score,  2),
                "risk_level": self.risk_level,
                # Flat keys for dashboard compatibility
                "identify":   round(self.score_identify, 2),
                "protect":    round(self.score_protect,  2),
                "detect":     round(self.score_detect,   2),
                "respond":    round(self.score_respond,  2),
                "recover":    round(self.score_recover,  2),
                # Nested domain_scores for ResultsPage charts
                "domain_scores": {
                    "identify": round(self.score_identify, 2),
                    "protect":  round(self.score_protect,  2),
                    "detect":   round(self.score_detect,   2),
                    "respond":  round(self.score_respond,  2),
                    "recover":  round(self.score_recover,  2),
                },
            },
            "recommendations": self.recommendations,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }
        # Encrypted payload — only returned to the authenticated owner
        if include_encrypted:
            data["encrypted_payload"] = {
                "ciphertext":     self.encrypted_answers,
                "iv":             self.iv,
                "auth_tag":       self.auth_tag,
                "session_key_id": self.session_key_id,
            }
        return data

    def __repr__(self):
        return (
            f"<Assessment id={self.id} company='{self.company_name}' "
            f"score={self.overall_score} level='{self.risk_level}'>"
        )
