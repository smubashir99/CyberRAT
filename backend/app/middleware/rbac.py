"""
CyberRAT v2 — RBAC Middleware (Role-Based Access Control)
===========================================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Decorator-based RBAC enforcement for Flask routes.

Usage:
    from app.middleware.rbac import require_role, require_admin, require_analyst
    from flask_jwt_extended import jwt_required

    @bp.route("/admin/users")
    @jwt_required()
    @require_admin
    def list_users():
        ...

    @bp.route("/assessment/submit", methods=["POST"])
    @jwt_required()
    @require_analyst       # allows admin AND analyst
    def submit_assessment():
        ...

──────────────────────────────────────────────────────────────────
Role Matrix:
  ADMIN   → full access (all endpoints)
  ANALYST → can submit assessments, view own results
  VIEWER  → read-only (view published results, no submit)
──────────────────────────────────────────────────────────────────
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from app.models.user import User, Role

def require_role(*allowed_roles: str):
    """
    Factory decorator: require the authenticated user to have one of the
    specified roles. Must be applied AFTER @jwt_required().

    Args:
        allowed_roles: One or more Role constants.

    Returns:
        Decorator that returns 403 if the current user's role is not permitted.

    Example:
        @require_role(Role.ADMIN, Role.ANALYST)
    """
    
    def decorator(fn):
        @wraps(fn)
        # Wrapper function that checks the current user's role against allowed_roles.
        def wrapper(*args, **kwargs):
            # get_jwt_identity() returns the user's email (set during login)
            user_email = get_jwt_identity()
            user = User.query.filter_by(email=user_email, is_active=True).first()
            # If the user is not found or deactivated, return 403 Forbidden.
            if not user:
                return jsonify({
                    "error": "Forbidden",
                    "message": "User account not found or deactivated.",
                }), 403
            # If the user's role is not in the allowed_roles, return 403 Forbidden.
            if user.role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": (
                        f"This action requires one of the following roles: "
                        f"{', '.join(allowed_roles)}. "
                        f"Your current role is '{user.role}'."
                    ),
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ----------------------------------------------------------------
# Convenience decorators (single-role shortcuts)
# ----------------------------------------------------------------

def require_admin(fn):
    """
    Require Admin role.
    Shortcut for @require_role(Role.ADMIN).
    """
    @wraps(fn)
    # Wrapper function that checks if the current user is an admin.
    def wrapper(*args, **kwargs):
        user_email = get_jwt_identity()
        user = User.query.filter_by(email=user_email, is_active=True).first()
        # If the user is not found or deactivated, return 403 Forbidden.
        if not user:
            return jsonify({
                "error": "Forbidden",
                "message": "User account not found or deactivated.",
            }), 403
        # If the user is not an admin, return 403 Forbidden.
        if not user.is_admin():
            return jsonify({
                "error": "Forbidden",
                "message": "Admin role required for this action.",
            }), 403

        return fn(*args, **kwargs)
    return wrapper


def require_analyst(fn):
    """
    Require Analyst OR Admin role.
    Analysts and Admins can submit assessments and view their own results.
    Viewers cannot.
    """
    @wraps(fn)
    # Wrapper function that checks if the current user is an analyst or admin.
    def wrapper(*args, **kwargs):
        user_email = get_jwt_identity()
        user = User.query.filter_by(email=user_email, is_active=True).first()
        # If the user is not found or deactivated, return 403 Forbidden.
        if not user:
            return jsonify({
                "error": "Forbidden",
                "message": "User account not found or deactivated.",
            }), 403
        # If the user is not an analyst or admin, return 403 Forbidden.
        if not user.can_submit_assessment():
            return jsonify({
                "error": "Forbidden",
                "message": "Analyst or Admin role required to submit assessments.",
            }), 403
        # If the user has the required role, proceed to call the original function.
        return fn(*args, **kwargs)
    return wrapper

def get_current_user() -> User:
    """
    Helper: retrieve the full User object for the current JWT identity.
    Returns None if not found or deactivated.

    Use inside a @jwt_required() route.
    """
    user_email = get_jwt_identity()
    # If the JWT identity is None (e.g., no token), return None.
    if not user_email:
        return None
    return User.query.filter_by(email=user_email, is_active=True).first()
