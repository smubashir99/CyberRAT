"""
CyberRAT v2 — Authentication Routes
======================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : JWT-based auth endpoints with bcrypt, OTP 2FA, signup, and RBAC.

Endpoints:
  POST /api/auth/signup         — Public self-registration (any role except admin)
  POST /api/auth/login          — Step 1: verify credentials → send OTP
  POST /api/auth/verify-otp     — Step 2: verify OTP → issue JWT tokens
  POST /api/auth/refresh        — Refresh access token using refresh token
  GET  /api/auth/me             — Get current user profile
  POST /api/auth/logout         — Logout (client-side token discard)
  POST /api/auth/register       — Admin-only: create any-role account
  GET  /api/auth/users          — Admin only: list all users
  PUT  /api/auth/users/<id>     — Admin only: update role / active status
  DELETE /api/auth/users/<id>   — Admin only: permanently delete a user

Password complexity rules (enforced on signup, register, and future change-password):
  - Minimum 8 characters
  - At least one uppercase letter  (A-Z)
  - At least one digit             (0-9)
  - At least one special character (!@#$%^&*()_+-=[]{}|;':",.<>?/`~\\)
"""

import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
# Flask-Mail is optional; if not installed, OTP emails will not be sent
from app.extensions import db, limiter, mail
from app.models.user import User, Role
from app.models.otp import OTPCode
from app.models.audit_log import AuditAction
from app.middleware.rbac import require_admin, get_current_user
from app.services.audit import log_event
# Optional import for Flask-Mail
try:
    from flask_mail import Message as MailMessage
    MAIL_AVAILABLE = True
except ImportError:
    MAIL_AVAILABLE = False
# Optional import for bcrypt (used in User model)
bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ─────────────────────────────────────────────────────────────
# Password validation helper
# ─────────────────────────────────────────────────────────────
_SPECIAL = set(r"""!@#$%^&*()_+-=[]{}|;':",.<>?/`~\\""")
# Validate password complexity rules
def validate_password(password: str) -> tuple:
    """
    Enforce password complexity rules.

    Returns:
        (is_valid: bool, error_message: str)
    """
    # Check length
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A–Z)."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit (0–9)."
    if not any(c in _SPECIAL for c in password):
        return False, (
            "Password must contain at least one special character "
            "(!@#$%^&*()_+-=[]{}|;':\",.<>?/`~\\)."
        )
    return True, ""


# ─────────────────────────────────────────────────────────────
# OTP email helper
# ─────────────────────────────────────────────────────────────
def _send_otp_email(user: User, otp_code: str) -> bool:
    """
    Send OTP code by email.

    In MAIL_DEBUG_MODE the email is not actually sent — the code is
    only returned in the API response (demo / testing use).

    Returns True if email sent (or debug mode active), False on error.
    """
    debug_mode = current_app.config.get("MAIL_DEBUG_MODE", True)
    #  In debug mode, just log to console and return True
    if debug_mode:
        # In demo/dev mode — just log to console; API returns code in body
        print(f"[CyberRAT OTP] User: {user.email}  Code: {otp_code}  (debug mode)")
        return True
    
    #  If Flask-Mail is not installed, we cannot send emails
    if not MAIL_AVAILABLE:
        return False
    #   Send the email using Flask-Mail
    try:
        msg = MailMessage(
            subject     = "CyberRAT — Your Login Verification Code",
            recipients  = [user.email],
            sender      = current_app.config.get("MAIL_DEFAULT_SENDER", "noreply@cyberrat.ie"),
            html        = f"""
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
            background:#0d1117;color:#e6edf3;padding:32px;border-radius:8px;
            border:1px solid #30363d;">
  <h2 style="color:#58a6ff;margin-top:0;">🛡 CyberRAT Login Verification</h2>
  <p>Hello <strong>{user.first_name}</strong>,</p>
  <p>Your one-time verification code is:</p>
  <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
              color:#3fb950;text-align:center;padding:16px;
              background:#161b22;border-radius:6px;margin:20px 0;">
    {otp_code}
  </div>
  <p style="color:#8b949e;font-size:13px;">
    This code expires in <strong>10 minutes</strong>.<br>
    If you did not attempt to log in, please ignore this email.
  </p>
  <hr style="border-color:#30363d;margin:24px 0;">
  <p style="color:#6e7681;font-size:11px;">
    CyberRAT v2 · DBS Dublin · CRAF Framework · Dissertation 2026
  </p>
</div>""",
        )
        mail.send(msg)
        return True
    except Exception as exc:
        print(f"[CyberRAT] Email send failed for {user.email}: {exc}")
        return False


# ─────────────────────────────────────────────────────────────
# POST /api/auth/signup
# Public self-registration — analyst or viewer only
# ─────────────────────────────────────────────────────────────
@bp.route("/signup", methods=["POST"])
@limiter.limit("10 per minute")
def signup():
    """
    Self-registration endpoint. Anyone can create an analyst or viewer account.
    Admin accounts CANNOT be created via signup — only via /register (admin-only).

    Request body:
        {
          "email":      "jane@example.ie",
          "password":   "SecurePass123!",
          "first_name": "Jane",
          "last_name":  "Doe",
          "role":       "analyst"   (optional: "analyst" or "viewer". Default: analyst)
        }
    """
    #---- Parse JSON body ----
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Bad Request", "message": "JSON body required."}), 400

    # ---- Validate required fields ----
    for field in ["email", "password", "first_name", "last_name"]:
        if not str(data.get(field, "")).strip():
            return jsonify({
                "error": "Validation Error",
                "message": f"'{field}' is required."
            }), 422

    email      = data["email"].strip().lower()
    password   = data["password"]
    first_name = data["first_name"].strip()
    last_name  = data["last_name"].strip()
    role       = data.get("role", Role.ANALYST).strip().lower()

    # ---- Disallow admin self-registration ----
    if role == Role.ADMIN:
        return jsonify({
            "error": "Forbidden",
            "message": "Admin accounts cannot be self-registered. "
                       "Contact an existing administrator."
        }), 403

    # ---- Validate role ----
    allowed_signup_roles = [Role.ANALYST, Role.VIEWER]
    if role not in allowed_signup_roles:
        return jsonify({
            "error": "Validation Error",
            "message": f"Invalid role. Signup allows: {allowed_signup_roles}"
        }), 422

    # ---- Validate email format ----
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify({
            "error": "Validation Error",
            "message": "Please enter a valid email address."
        }), 422

    # ---- Check email already registered ----
    if User.query.filter_by(email=email).first():
        return jsonify({
            "error": "Conflict",
            "message": "An account with this email address already exists."
        }), 409

    # ---- Password complexity ----
    valid, err_msg = validate_password(password)
    if not valid:
        return jsonify({"error": "Validation Error", "message": err_msg}), 422

    # ---- Create user ----
    user = User(
        email      = email,
        first_name = first_name,
        last_name  = last_name,
        role       = role,
    )
    #  Set password hash using bcrypt
    user.set_password(password)
    # Add to DB and commit
    db.session.add(user)
    db.session.commit()
    # Log the self-registration event
    log_event(
        action      = AuditAction.REGISTER,
        description = f"Self-registration: '{email}' signed up with role '{role}'.",
        user_id     = user.id,
        user_email  = email,
        status_code = 201,
        resource_id   = user.id,
        resource_type = "user",
    )
    # Return success response with user info (excluding password hash)
    return jsonify({
        "message": f"Account created successfully. You can now log in.",
        "user":    user.to_dict(),
    }), 201


# ─────────────────────────────────────────────────────────────
# POST /api/auth/login  — Step 1: credentials → send OTP
# Rate limited: 5 attempts per minute per IP (brute-force protection)
# ─────────────────────────────────────────────────────────────
@bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    """
    Step 1 of 2-factor login.
    Validates email + password, then generates and sends a 6-digit OTP.

    Request body:
        { "email": "...", "password": "..." }

    Response (on success):
        {
          "message":    "OTP sent to your email.",
          "otp_required": true,
          "user_id":    42,
          "debug_otp":  "123456"   ← ONLY present when MAIL_DEBUG_MODE=True
        }

    The client must then call POST /api/auth/verify-otp with the OTP code
    to receive the actual JWT access + refresh tokens.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Bad Request", "message": "JSON body required."}), 400

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "error": "Validation Error",
            "message": "Both 'email' and 'password' are required."
        }), 422

    # Generic failure message — do NOT reveal whether email exists
    FAIL_MSG = "Invalid email address or password."
    # Check if user exists
    user = User.query.filter_by(email=email).first()
    # If user not found, log failed attempt and return generic error
    if not user:
        log_event(
            action      = AuditAction.LOGIN_FAILED,
            description = f"Login attempt for unknown email: {email}",
            user_email  = email,
            status_code = 401,
        )
        #  Return generic error to prevent email enumeration
        return jsonify({"error": "Unauthorized", "message": FAIL_MSG}), 401

    # ---- Check account lockout ----
    LOCKOUT_MINUTES = 30
    # If user is locked, check if lockout period has expired
    if user.locked_at:
        unlock_time = user.locked_at + timedelta(minutes=LOCKOUT_MINUTES)
        if datetime.utcnow() < unlock_time:
            remaining = max(1, int((unlock_time - datetime.utcnow()).total_seconds() / 60))
            log_event(
                action      = AuditAction.LOGIN_FAILED,
                description = f"Login attempt on locked account '{email}'. Unlocks in {remaining}m.",
                user_id     = user.id,
                user_email  = email,
                status_code = 423,
            )
            #  Return 423 Locked with remaining time
            return jsonify({
                "error":   "Account Locked",
                "message": f"Your account is temporarily locked due to too many failed login attempts. "
                           f"Please try again in {remaining} minute{'s' if remaining != 1 else ''}.",
                "locked_until": unlock_time.isoformat() + "Z",
                "retry_after_minutes": remaining,
            }), 423
        else:
            # Auto-unlock: 30 minutes have passed
            user.locked_at    = None
            user.failed_logins = 0
            user.is_active    = True
            db.session.commit()
    
    # --- Check if account is active (not deactivated) ---
    if not user.is_active:
        log_event(
            action      = AuditAction.LOGIN_FAILED,
            description = f"Login attempt for inactive email: {email}",
            user_email  = email,
            status_code = 401,
        )
        #  Return generic error to prevent revealing account status
        return jsonify({"error": "Unauthorized", "message": FAIL_MSG}), 401

    # ---- Check password ----
    if not user.check_password(password):
        user.failed_logins += 1
        if user.failed_logins >= 5:
            user.locked_at = datetime.utcnow()
            user.is_active = False
        db.session.commit()
        # Log the failed login attempt with details
        log_event(
            action      = AuditAction.LOGIN_FAILED,
            description = f"Invalid password for '{email}'. Attempts: {user.failed_logins}.",
            user_id     = user.id,
            user_email  = email,
            status_code = 401,
        )
        return jsonify({"error": "Unauthorized", "message": FAIL_MSG}), 401

    # ---- Password OK → generate OTP ----
    _, otp_plaintext = OTPCode.create_for_user(user.id)
    email_sent       = _send_otp_email(user, otp_plaintext)
    # In debug mode, the OTP is not actually emailed, but returned in the response for testing
    debug_mode = current_app.config.get("MAIL_DEBUG_MODE", True)
    # Log the OTP sent event
    log_event(
        action      = "OTP_SENT",
        description = f"OTP sent for '{email}' (debug={debug_mode}, sent={email_sent}).",
        user_id     = user.id,
        user_email  = email,
        status_code = 200,
    )
    # Return response indicating OTP is required
    response = {
        "message":      "OTP sent to your email. Enter the 6-digit code to continue.",
        "otp_required": True,
        "user_id":      user.id,
    }
    # In debug/dev mode, include the OTP in the response for easy testing
    if debug_mode:
        response["debug_otp"] = otp_plaintext
        response["debug_note"] = "DEVELOPMENT MODE — OTP returned in response (not emailed)."
    #  Return 200 OK with the response
    return jsonify(response), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/verify-otp  — Step 2: OTP → issue JWT tokens
# ─────────────────────────────────────────────────────────────
@bp.route("/verify-otp", methods=["POST"])
@limiter.limit("10 per minute")
def verify_otp():
    """
    Step 2 of 2-factor login.
    Verifies the OTP code and returns JWT access + refresh tokens.

    Request body:
        { "user_id": 42, "otp": "123456" }

    Response:
        {
          "access_token":  "eyJ...",
          "refresh_token": "eyJ...",
          "user": { ... }
        }
    """
    # Parse JSON body
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Bad Request", "message": "JSON body required."}), 400
    # Validate required fields
    user_id  = data.get("user_id")
    otp_code = str(data.get("otp", "")).strip()
    
    if not user_id or not otp_code:
        return jsonify({
            "error": "Validation Error",
            "message": "Both 'user_id' and 'otp' are required."
        }), 422
    #  --- Fetch user and check active status ---
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({"error": "Unauthorized", "message": "Invalid session."}), 401

    # ---- Verify OTP ----
    if not OTPCode.verify_for_user(user_id, otp_code):
        log_event(
            action      = "OTP_FAILED",
            description = f"Invalid/expired OTP for user '{user.email}'.",
            user_id     = user.id,
            user_email  = user.email,
            status_code = 401,
        )
        return jsonify({
            "error": "Unauthorized",
            "message": "Invalid or expired verification code. Please try again."
        }), 401

    # ---- OTP valid → issue tokens ----
    user.failed_logins = 0
    user.last_login    = datetime.utcnow()
    db.session.commit()
    
    #--- Create JWT access and refresh tokens ---
    access_token  = create_access_token(identity=user.email)
    refresh_token = create_refresh_token(identity=user.email)

    #  Log successful login event
    log_event(
        action      = AuditAction.LOGIN_SUCCESS,
        description = f"User '{user.email}' authenticated (OTP verified).",
        user_id     = user.id,
        user_email  = user.email,
        status_code = 200,
    )

    return jsonify({
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "user":          user.to_dict(),
    }), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/refresh
# ─────────────────────────────────────────────────────────────
@bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Issue a new access token using a valid refresh token."""
    user_email   = get_jwt_identity()
    access_token = create_access_token(identity=user_email)

    user = User.query.filter_by(email=user_email).first()
    log_event(
        action      = AuditAction.TOKEN_REFRESHED,
        description = f"Access token refreshed for '{user_email}'.",
        user_id     = user.id if user else None,
        user_email  = user_email,
        status_code = 200,
    )
    return jsonify({"access_token": access_token}), 200


# ─────────────────────────────────────────────────────────────
# GET /api/auth/me
# ─────────────────────────────────────────────────────────────
@bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return the current authenticated user's profile."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not Found", "message": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200


# ─────────────────────────────────────────────────────────────
# PATCH /api/auth/profile  — update own name
# ─────────────────────────────────────────────────────────────
@bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    """
    Update the authenticated user's own first_name and/or last_name.

    Request body (all optional):
        first_name  : str
        last_name   : str

    Returns:
        200  { user: <updated user dict> }
        400  validation error
        404  user not found
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not Found", "message": "User not found."}), 404

    data = request.get_json(silent=True) or {}

    first_name = data.get("first_name", "").strip()
    last_name  = data.get("last_name",  "").strip()

    if not first_name and not last_name:
        return jsonify({"error": "Bad Request", "message": "Provide at least first_name or last_name."}), 400

    if first_name:
        if len(first_name) > 100:
            return jsonify({"error": "Bad Request", "message": "first_name must be ≤ 100 characters."}), 400
        user.first_name = first_name

    if last_name:
        if len(last_name) > 100:
            return jsonify({"error": "Bad Request", "message": "last_name must be ≤ 100 characters."}), 400
        user.last_name = last_name
    
    # Commit changes to the database
    db.session.commit()
    # Log the profile update event
    log_event(
        action      = AuditAction.USER_UPDATE,
        description = f"User '{user.email}' updated their profile name.",
        user_id     = user.id,
        user_email  = user.email,
        status_code = 200,
    )
    # Return the updated user profile
    return jsonify({"user": user.to_dict(), "message": "Profile updated successfully."}), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/change-password  — change own password
# ─────────────────────────────────────────────────────────────
@bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """
    Change the authenticated user's own password.

    Request body:
        current_password : str  (required — must match stored hash)
        new_password     : str  (required — must pass complexity rules)
        confirm_password : str  (required — must match new_password)

    Returns:
        200  { message: "Password changed successfully." }
        400  validation / mismatch error
        401  wrong current password
        404  user not found
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not Found", "message": "User not found."}), 404
    # Parse JSON body
    data = request.get_json(silent=True) or {}

    current_pw  = data.get("current_password", "")
    new_pw      = data.get("new_password", "")
    confirm_pw  = data.get("confirm_password", "")

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify({"error": "Bad Request", "message": "current_password, new_password and confirm_password are required."}), 400

    # Verify current password
    if not user.check_password(current_pw):
        return jsonify({"error": "Unauthorized", "message": "Current password is incorrect."}), 401

    # Confirm match
    if new_pw != confirm_pw:
        return jsonify({"error": "Bad Request", "message": "new_password and confirm_password do not match."}), 400

    # Complexity check
    is_valid, err_msg = validate_password(new_pw)
    if not is_valid:
        return jsonify({"error": "Bad Request", "message": err_msg}), 400

    # Cannot reuse current password
    if user.check_password(new_pw):
        return jsonify({"error": "Bad Request", "message": "New password must be different from the current password."}), 400
    
    # Update password hash and commit
    user.set_password(new_pw)
    db.session.commit()
    # Log the password change event
    log_event(
        action      = AuditAction.PASSWORD_CHANGED,
        description = f"User '{user.email}' changed their password.",
        user_id     = user.id,
        user_email  = user.email,
        status_code = 200,
    )
    # Return success message
    return jsonify({"message": "Password changed successfully."}), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/logout
# ─────────────────────────────────────────────────────────────
@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logout endpoint. JWT is stateless — client must discard tokens."""
    user = get_current_user()
    if user:
        log_event(
            action      = AuditAction.LOGOUT,
            description = f"User '{user.email}' logged out.",
            user_id     = user.id,
            user_email  = user.email,
            status_code = 200,
        )
    return jsonify({"message": "Logged out successfully. Please discard your tokens."}), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/register
# Admin-only: create any role including admin
# ─────────────────────────────────────────────────────────────
@bp.route("/register", methods=["POST"])
@jwt_required()
@require_admin
def register():
    """
    Register a new user (Admin only — can assign any role).

    Request body:
        {
          "email":      "analyst@example.ie",
          "password":   "SecurePass123!",
          "first_name": "Jane",
          "last_name":  "Doe",
          "role":       "analyst"
        }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Bad Request", "message": "JSON body required."}), 400
    
    #--- Validate required fields ---
    for field in ["email", "password", "first_name", "last_name"]:
        if not str(data.get(field, "")).strip():
            return jsonify({
                "error": "Validation Error",
                "message": f"'{field}' is required."
            }), 422

    email      = data["email"].strip().lower()
    password   = data["password"]
    first_name = data["first_name"].strip()
    last_name  = data["last_name"].strip()
    role       = data.get("role", Role.ANALYST).strip().lower()
    #--- Validate role ---
    if role not in Role.ALL:
        return jsonify({
            "error": "Validation Error",
            "message": f"Invalid role '{role}'. Must be one of: {Role.ALL}"
        }), 422

    if User.query.filter_by(email=email).first():
        return jsonify({
            "error": "Conflict",
            "message": "An account with this email address already exists."
        }), 409

    # ---- Password complexity (enforced even for admin-created accounts) ----
    valid, err_msg = validate_password(password)
    if not valid:
        return jsonify({"error": "Validation Error", "message": err_msg}), 422

    user = User(
        email      = email,
        first_name = first_name,
        last_name  = last_name,
        role       = role,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    # Log the admin-created user event
    admin = get_current_user()
    log_event(
        action      = AuditAction.REGISTER,
        description = f"Admin '{admin.email}' created user '{email}' with role '{role}'.",
        user_id     = user.id,
        user_email  = email,
        status_code = 201,
        resource_id   = user.id,
        resource_type = "user",
    )

    return jsonify({
        "message": f"User '{email}' created successfully.",
        "user":    user.to_dict(),
    }), 201


# ─────────────────────────────────────────────────────────────
# GET /api/auth/users
# Admin only: list all users
# ─────────────────────────────────────────────────────────────
@bp.route("/users", methods=["GET"])
@jwt_required()
@require_admin
def list_users():
    """Return a list of all user accounts. Admin only."""
    users = User.query.order_by(User.created_at.desc()).all()
    admin = get_current_user()

    log_event(
        action      = AuditAction.USER_LISTED,
        description = f"Admin '{admin.email}' listed all users ({len(users)} total).",
        user_id     = admin.id,
        user_email  = admin.email,
        status_code = 200,
    )

    return jsonify({
        "users": [u.to_dict(include_sensitive=True) for u in users],
        "total": len(users),
    }), 200


# ─────────────────────────────────────────────────────────────
# PUT /api/auth/users/<user_id>
# Admin only: update role or active status
# ─────────────────────────────────────────────────────────────
@bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
@require_admin
def update_user(user_id: int):
    """
    Update a user's role or active status. Admin only.

    Request body (all optional):
        { "role": "viewer", "is_active": true }
    """
    data  = request.get_json(silent=True) or {}
    user  = User.query.get(user_id)
    admin = get_current_user()
    
    
    # Check if user exists
    if not user:
        return jsonify({"error": "Not Found", "message": "User not found."}), 404
    
    # Prevent admin from changing their own role to non-admin
    if user.id == admin.id and data.get("role") and data["role"] != Role.ADMIN:
        return jsonify({
            "error": "Forbidden",
            "message": "You cannot change your own role."
        }), 403

    changes = []
    
    # Update role if provided
    if "role" in data:
        new_role = data["role"].strip().lower()
        if new_role not in Role.ALL:
            return jsonify({
                "error": "Validation Error",
                "message": f"Invalid role. Must be one of: {Role.ALL}"
            }), 422
        if user.role != new_role:
            changes.append(f"role: {user.role} → {new_role}")
            user.role = new_role
            log_event(
                action      = AuditAction.USER_ROLE_CHANGED,
                description = f"Admin '{admin.email}' changed '{user.email}' role to '{new_role}'.",
                user_id     = user.id,
                user_email  = user.email,
                status_code = 200,
                resource_id   = user.id,
                resource_type = "user",
            )
    # Update is_active if provided
    if "is_active" in data:
        new_status = bool(data["is_active"])
        if user.is_active != new_status:
            changes.append(f"is_active: {user.is_active} → {new_status}")
            user.is_active = new_status
            if not new_status:
                log_event(
                    action      = AuditAction.USER_DEACTIVATED,
                    description = f"Admin '{admin.email}' deactivated user '{user.email}'.",
                    user_id     = user.id,
                    user_email  = user.email,
                    status_code = 200,
                    resource_id   = user.id,
                    resource_type = "user",
                )
    # Commit changes if any
    if changes:
        db.session.commit()

    return jsonify({
        "message": "User updated successfully." if changes else "No changes made.",
        "user":    user.to_dict(include_sensitive=True),
        "changes": changes,
    }), 200


# ─────────────────────────────────────────────────────────────
# DELETE /api/auth/users/<user_id>
# Admin only: permanently delete a user
# ─────────────────────────────────────────────────────────────
@bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_user(user_id: int):
    """
    Permanently delete a user account and all their assessments.
    Admin only. Admin cannot delete their own account.

    This action is IRREVERSIBLE.
    """
    user  = User.query.get(user_id)
    admin = get_current_user()

    if not user:
        return jsonify({"error": "Not Found", "message": "User not found."}), 404

    if user.id == admin.id:
        return jsonify({
            "error": "Forbidden",
            "message": "You cannot delete your own admin account."
        }), 403

    email_snapshot = user.email
    name_snapshot  = f"{user.first_name} {user.last_name}"

    db.session.delete(user)
    db.session.commit()

    log_event(
        action      = "USER_DELETED",
        description = (
            f"Admin '{admin.email}' permanently deleted user "
            f"'{email_snapshot}' ({name_snapshot})."
        ),
        user_id     = admin.id,
        user_email  = admin.email,
        status_code = 200,
        resource_type = "user",
    )

    return jsonify({
        "message": f"User '{email_snapshot}' has been permanently deleted.",
    }), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/forgot-password
# Public: request password reset email
# ─────────────────────────────────────────────────────────────
@bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per hour")
def forgot_password():
    """
    Request a password reset link. Sends a time-limited token to the user's email.

    Request body:
        { "email": "user@example.com" }

    Always returns 200 to prevent email enumeration.
    """
    data  = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    # Validate email presence
    if not email:
        return jsonify({"error": "Validation Error", "message": "Email is required."}), 422

    # Always return success — do not reveal whether email exists (enumeration prevention)
    GENERIC_OK = {"message": "If an account with that email exists, a reset link has been sent."}

    user = User.query.filter_by(email=email, is_active=True).first()
    if not user:
        return jsonify(GENERIC_OK), 200

    # Generate a secure reset token (32 random bytes → hex string, 1-hour TTL)
    import secrets, hashlib
    token_plain  = secrets.token_urlsafe(32)
    token_hash   = hashlib.sha256(token_plain.encode()).hexdigest()
    expires_at   = datetime.utcnow() + timedelta(hours=1)

    user.reset_token        = token_hash
    user.reset_token_expires = expires_at
    db.session.commit()

    debug_mode  = current_app.config.get("MAIL_DEBUG_MODE", True)
    reset_url   = f"http://localhost:3000/reset-password?token={token_plain}&email={email}"

    if not debug_mode and MAIL_AVAILABLE:
        try:
            msg = MailMessage(
                subject    = "CyberRAT — Password Reset Request",
                recipients = [email],
                html       = f"""
<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
  <div style="text-align:center;margin-bottom:20px">
    <span style="font-size:40px">🛡</span>
    <h2 style="color:#1e293b;margin:8px 0">CyberRAT Password Reset</h2>
  </div>
  <p style="color:#374151">Hello <strong>{user.first_name}</strong>,</p>
  <p style="color:#374151">We received a request to reset your CyberRAT account password.
  Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="{reset_url}"
       style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
      Reset My Password
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px">If you did not request this, ignore this email — your password will not change.</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px">
    DBS Dublin · CRAF Framework · Dissertation 2026
  </p>
</div>""",
            )
            mail.send(msg)
        except Exception as exc:
            current_app.logger.error(f"Password reset email failed for {email}: {exc}")

    log_event(
        action      = "PASSWORD_RESET_REQUESTED",
        description = f"Password reset requested for '{email}' (debug={debug_mode}).",
        user_id     = user.id,
        user_email  = email,
        status_code = 200,
    )
    # Return generic success response (200 OK) regardless of email existence
    response = dict(GENERIC_OK)
    if debug_mode:
        response["debug_reset_url"]  = reset_url
        response["debug_token"]      = token_plain
        response["debug_note"]       = "DEVELOPMENT MODE — reset link returned in response."
    return jsonify(response), 200


# ─────────────────────────────────────────────────────────────
# POST /api/auth/reset-password
# Public: set new password using valid reset token
# ─────────────────────────────────────────────────────────────
@bp.route("/reset-password", methods=["POST"])
@limiter.limit("10 per hour")
def reset_password():
    """
    Reset password using a valid token from the reset email.

    Request body:
        { "email": "user@example.com", "token": "<reset_token>", "new_password": "..." }
    """
    import hashlib
    data         = request.get_json(silent=True) or {}
    email        = data.get("email", "").strip().lower()
    token_plain  = data.get("token", "").strip()
    new_password = data.get("new_password", "")

    # Validate required fields
    if not email or not token_plain or not new_password:
        return jsonify({
            "error": "Validation Error",
            "message": "email, token, and new_password are all required."
        }), 422
    # Validate email format
    INVALID_MSG = "This reset link is invalid or has expired. Please request a new one."

    user = User.query.filter_by(email=email).first()
    if not user or not user.reset_token or not user.reset_token_expires:
        return jsonify({"error": "Bad Request", "message": INVALID_MSG}), 400

    # Check expiry
    if datetime.utcnow() > user.reset_token_expires:
        user.reset_token         = None
        user.reset_token_expires = None
        db.session.commit()
        return jsonify({"error": "Bad Request", "message": INVALID_MSG}), 400

    # Constant-time comparison via hash
    token_hash = hashlib.sha256(token_plain.encode()).hexdigest()
    if token_hash != user.reset_token:
        return jsonify({"error": "Bad Request", "message": INVALID_MSG}), 400

    # Validate new password complexity
    valid, err_msg = validate_password(new_password)
    if not valid:
        return jsonify({"error": "Validation Error", "message": err_msg}), 422

    user.set_password(new_password)
    user.reset_token         = None
    user.reset_token_expires = None
    user.failed_logins       = 0
    user.locked_at           = None
    user.is_active           = True
    db.session.commit()

    log_event(
        action      = "PASSWORD_RESET_SUCCESS",
        description = f"Password reset completed for '{email}'.",
        user_id     = user.id,
        user_email  = email,
        status_code = 200,
    )
    # Return success message
    return jsonify({"message": "Password reset successfully. You can now log in with your new password."}), 200
