"""
CyberRAT v2 — Application Configuration
=========================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : AI-CRAF Dissertation — DBS Dublin
Purpose : Centralised configuration for all environments.

Security notes:
  - JWT_SECRET_KEY should be changed to a strong random value in production.
    Generate with: python -c "import secrets; print(secrets.token_hex(64))"
  - DATABASE_URL should point to PostgreSQL in production (not SQLite).
  - ECDH server key pair is generated fresh on each startup in development.
    In production, persist the private key securely (e.g. HashiCorp Vault).
"""

import os
from datetime import timedelta

# ----------------------------------------------------------------
# Base directory — where config.py lives (backend/)
# ----------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """
    Base configuration — shared across all environments.
    All sensitive values should be overridden via environment variables.
    """

    # ---- Application ----
    APP_NAME    = "CyberRAT"
    APP_VERSION = "2.0.0"
    SECRET_KEY  = os.environ.get(
        "SECRET_KEY",
        "cyberrat-CHANGE-THIS-IN-PRODUCTION-use-secrets.token_hex(64)"
    )

    # ---- Database ----
    # Local development  : SQLite (no setup needed)
    # Production (Render): PostgreSQL (DATABASE_URL set automatically by Render)
    #
    # Render provides "postgres://" but SQLAlchemy needs "postgresql://"
    # The fix below handles that automatically.
    _db_url = os.environ.get("DATABASE_URL", "")
    if _db_url:
        # Fix Render's legacy postgres:// prefix
        if _db_url.startswith("postgres://"):
            _db_url = _db_url.replace("postgres://", "postgresql://", 1)
        # Python 3.14+ uses psycopg3 which needs postgresql+psycopg:// dialect
        import sys
        if sys.version_info >= (3, 14):
            if _db_url.startswith("postgresql://") and "+psycopg" not in _db_url:
                _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        SQLALCHEMY_DATABASE_URI = _db_url
    else:
        # Local development — use SQLite (no PostgreSQL needed)
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'cyberrat.db')}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Echo SQL queries to console in debug mode (set False in prod)
    SQLALCHEMY_ECHO = False

    # ---- JWT Configuration ----
    # Access token expires in 15 minutes (short-lived for security)
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=15)
    # Refresh token expires in 7 days
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_SECRET_KEY = os.environ.get(
        "JWT_SECRET_KEY",
        "jwt-CHANGE-THIS-IN-PRODUCTION-use-secrets.token_hex(64)"
    )
    # Store JWT type in the "type" claim
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME    = "Authorization"
    JWT_HEADER_TYPE    = "Bearer"

    # ---- CORS ----
    # Only allow requests from the React dev server
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000")

    # ---- Rate Limiting ----
    # Login endpoint: 5 attempts per minute (brute-force protection)
    RATELIMIT_DEFAULT         = "200 per day;100 per hour"
    RATELIMIT_STORAGE_URL     = "memory://"
    RATELIMIT_STRATEGY        = "fixed-window"

    # ---- Security ----
    # bcrypt cost factor — 12 is the recommended minimum
    BCRYPT_COST = 12

    # ---- Email / OTP Configuration ----
    # Set MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD in .env for real email.
    # In development (MAIL_DEBUG_MODE=True), OTP is printed to the console
    # and returned in the API response (for demo/testing purposes).
    MAIL_SERVER        = os.environ.get("MAIL_SERVER",   "smtp.gmail.com")
    MAIL_PORT          = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS       = os.environ.get("MAIL_USE_TLS",  "true").lower() == "true"
    MAIL_USERNAME      = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD      = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@cyberrat.ie")
    # When True: OTP is returned in JSON (dev/demo mode).
    # When False: OTP is emailed only (production mode).
    MAIL_DEBUG_MODE    = os.environ.get("MAIL_DEBUG_MODE", "true").lower() == "true"

    # ---- Default seed users ----
    # These are created on first startup (change passwords immediately in prod)
    SEED_ADMIN_EMAIL    = "admin@cyberrat.com"
    SEED_ADMIN_PASSWORD = "Admin@CyberRAT2026!"
    SEED_ANALYST_EMAIL  = "analyst@cyberrat.com"
    SEED_ANALYST_PASSWORD = "Analyst@CyberRAT2026!"


class DevelopmentConfig(Config):
    """Development settings — verbose logging, debug mode on."""
    DEBUG   = True
    TESTING = False
    SQLALCHEMY_ECHO = False   # Set True to log every SQL query


class TestingConfig(Config):
    """Testing settings — in-memory database, no rate limits."""
    DEBUG   = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    """Production settings — strict security, no debug."""
    DEBUG   = False
    TESTING = False
    # In production, DATABASE_URL must be set as an environment variable.
    # CORS_ORIGINS must be set to the actual frontend domain.


# ---- Active config selector ----
ENV_CONFIGS = {
    "development": DevelopmentConfig,
    "testing":     TestingConfig,
    "production":  ProductionConfig,
}

def get_config(env: str = None):
    """Return the config class matching the FLASK_ENV environment variable."""
    if env is None:
        env = os.environ.get("FLASK_ENV", "development")
    return ENV_CONFIGS.get(env, DevelopmentConfig)
