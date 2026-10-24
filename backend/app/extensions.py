"""
CyberRAT v2 — Flask Extensions
================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Instantiate all Flask extensions OUTSIDE the app factory to avoid circular imports.

Pattern: Extensions are created here (no app bound yet), then initialised with the app inside create_app() using
         extension.init_app(app).

Extensions:
  db       — SQLAlchemy ORM (database access for all models)
  jwt      — Flask-JWT-Extended (JSON Web Token management)
  limiter  — Flask-Limiter (rate limiting on auth endpoints)
  mail     — Flask-Mail (OTP email delivery)
"""

from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail

# ---- SQLAlchemy — database ORM ----
# All models import `db` from here.
db = SQLAlchemy()

# ---- JWTManager — stateless authentication ----
# Handles: token creation, verification, refresh, revocation hooks.
jwt = JWTManager()

# ---- Flask-Limiter — rate limiting ----
# Uses the client's IP address as the key.
# Specific limits are set per-route with @limiter.limit("X per minute")
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "100 per hour"],
    storage_uri="memory://",
)

# ---- Flask-Mail — email delivery for OTP codes ----
# Configured via MAIL_* env variables or config.py MAIL_* keys.
mail = Mail()
