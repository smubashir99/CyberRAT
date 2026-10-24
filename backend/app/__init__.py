"""
CyberRAT v2 — Application Factory
=====================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Flask application factory using the create_app() pattern.

The factory pattern:
  1. Prevents circular imports (extensions imported separately in extensions.py)
  2. Allows multiple app instances (testing, development, production)
  3. Enables proper blueprint registration and database initialisation

Call create_app() from app.py (entry point) or from test fixtures.
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS

from config import get_config, BASE_DIR
from app.extensions import db, jwt, limiter, mail
from app.services.crypto import init_server_keypair


def create_app(config_name: str = None) -> Flask:
    """
    Create and configure the Flask application.

    Args:
        config_name: Configuration class name ("development", "testing",
                     "production"). Reads FLASK_ENV env var if not provided.

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # ── 1. Load configuration ────────────────────────────────
    config = get_config(config_name)
    app.config.from_object(config)

    # ── 1b. Ensure instance/ folder exists (SQLite needs it) ─
    instance_dir = os.path.join(BASE_DIR, "instance")
    os.makedirs(instance_dir, exist_ok=True)

    # ── 2. Initialise extensions ─────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)

    # ── 3. CORS (allow any origin in dev — fix for VM/network setups) ──
    CORS(app,
         origins="*",
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
         supports_credentials=False)

    # ── 4. Register blueprints ───────────────────────────────
    from app.routes.auth          import bp as auth_bp
    from app.routes.assessment    import bp as assessment_bp
    from app.routes.results       import bp as results_bp
    from app.routes.crypto_routes import bp as crypto_bp
    from app.routes.export        import bp as export_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(assessment_bp)
    app.register_blueprint(results_bp)
    app.register_blueprint(crypto_bp)
    app.register_blueprint(export_bp)

    # ── 5. Database initialisation + seed data ───────────────
    with app.app_context():
        # Import models so SQLAlchemy knows about them for db.create_all()
        from app.models import User, Assessment, AuditLog  # noqa: F401
        from app.models.otp import OTPCode  # noqa: F401

        db.create_all()
        _seed_default_users(app)

    # ── 6. Generate ECDH server keypair ──────────────────────
    init_server_keypair()

    # ── 7. JWT error handlers ────────────────────────────────
    _register_jwt_handlers(jwt)

    # ── 8. Global error handlers ─────────────────────────────
    _register_error_handlers(app)

    # ── 9. Health check endpoint ─────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status":  "ok",
            "service": "CyberRAT v2 API",
            "version": "2.0.0",
        }), 200

    return app


# ─────────────────────────────────────────────────────────────
# Seed default users (dev/staging only)
# ─────────────────────────────────────────────────────────────
def _seed_default_users(app: Flask) -> None:
    """
    Create default admin and analyst accounts if they don't exist.
    This provides immediate access without manual setup.
    """
    from app.models.user import User, Role
    from app.services.audit import log_event
    from app.models.audit_log import AuditAction

    seed_users = app.config.get("SEED_USERS", [
        {
            "email":      app.config.get("SEED_ADMIN_EMAIL",    "admin@cyberrat.ie"),
            "password":   app.config.get("SEED_ADMIN_PASSWORD", "Admin@CyberRAT2026!"),
            "first_name": "CyberRAT",
            "last_name":  "Admin",
            "role":       "admin",
        },
        {
            "email":      app.config.get("SEED_ANALYST_EMAIL",    "analyst@cyberrat.ie"),
            "password":   app.config.get("SEED_ANALYST_PASSWORD", "Analyst@CyberRAT2026!"),
            "first_name": "CyberRAT",
            "last_name":  "Analyst",
            "role":       "analyst",
        },
    ])
    created    = 0

    for seed in seed_users:
        if not User.query.filter_by(email=seed["email"]).first():
            user = User(
                email      = seed["email"],
                first_name = seed["first_name"],
                last_name  = seed["last_name"],
                role       = seed["role"],
            )
            user.set_password(seed["password"])
            db.session.add(user)
            created += 1

    if created:
        db.session.commit()
        print(f"[CyberRAT] Seeded {created} default user(s).")
    else:
        print("[CyberRAT] Default users already exist. Skipping seed.")


# ─────────────────────────────────────────────────────────────
# JWT error handlers
# ─────────────────────────────────────────────────────────────
def _register_jwt_handlers(jwt_manager) -> None:
    """Register consistent JSON responses for JWT errors."""

    @jwt_manager.unauthorized_loader
    def missing_token(reason):
        return jsonify({
            "error":   "Unauthorized",
            "message": f"Authentication required. {reason}",
        }), 401

    @jwt_manager.invalid_token_loader
    def invalid_token(reason):
        return jsonify({
            "error":   "Unauthorized",
            "message": f"Invalid token: {reason}",
        }), 401

    @jwt_manager.expired_token_loader
    def expired_token(jwt_header, jwt_data):
        return jsonify({
            "error":   "Unauthorized",
            "message": "Your session has expired. Please log in again.",
            "code":    "TOKEN_EXPIRED",
        }), 401

    @jwt_manager.revoked_token_loader
    def revoked_token(jwt_header, jwt_data):
        return jsonify({
            "error":   "Unauthorized",
            "message": "Token has been revoked. Please log in again.",
        }), 401


# ─────────────────────────────────────────────────────────────
# Global HTTP error handlers
# ─────────────────────────────────────────────────────────────
def _register_error_handlers(app: Flask) -> None:
    """Register JSON error responses for common HTTP errors."""

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad Request", "message": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized", "message": str(e)}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Forbidden", "message": str(e)}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not Found", "message": str(e)}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method Not Allowed", "message": str(e)}), 405

    @app.errorhandler(429)
    def too_many_requests(e):
        return jsonify({
            "error":   "Too Many Requests",
            "message": "Rate limit exceeded. Please wait before trying again.",
        }), 429

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({
            "error":   "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later.",
        }), 500
