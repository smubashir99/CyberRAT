"""
CyberRAT v2 — ECDH Crypto Routes
===================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Expose server ECDH public key and perform key exchange.

Endpoints:
  GET  /api/crypto/server-key   — Return server's ECDH public key (PEM)
  POST /api/crypto/exchange     — Client sends its public key; server stores it

These endpoints enable the full ECDH key exchange flow:
  1. Client calls GET /api/crypto/server-key → gets server PEM
  2. Client generates its own ECDH keypair
  3. Client calls POST /api/crypto/exchange → sends its public key
  4. Both parties compute the same shared secret independently
  5. Shared secret → HKDF → AES-256 key for encrypting assessments
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.models.audit_log import AuditAction
from app.middleware.rbac import get_current_user
from app.services.crypto import (
    get_server_public_key_pem,
    compute_shared_secret,
    generate_session_key_id,
)
from app.services.audit import log_event
from app.extensions import db

bp = Blueprint("crypto", __name__, url_prefix="/api/crypto")


# ─────────────────────────────────────────────────────────────
# GET /api/crypto/server-key
# Public endpoint — no authentication required
# ─────────────────────────────────────────────────────────────
@bp.route("/server-key", methods=["GET"])
def get_server_key():
    """
    Return the server's ECDH public key in PEM format.

    This is the starting point for the ECDH key exchange protocol.
    No authentication required — the public key is not sensitive.

    Response:
        {
          "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
          "curve":      "P-256 (secp256r1)",
          "algorithm":  "ECDH"
        }
    """
    try:
        pem = get_server_public_key_pem()
    except RuntimeError as e:
        return jsonify({"error": "Server Error", "message": str(e)}), 500
    # Return the PEM-encoded public key and metadata
    return jsonify({
        "public_key_pem": pem,   # field name frontend expects
        "public_key":     pem,   # keep for backwards compat
        "curve":          "P-256 (secp256r1)",
        "algorithm":      "ECDH",
        "kdf":            "HKDF-SHA256 → AES-256-GCM key",
        "note": (
            "Generate your own ECDH keypair on this curve. "
            "Exchange public keys to derive a shared AES-256 key. "
            "Use that key with AES-256-GCM to encrypt your assessment answers."
        ),
    }), 200


# ─────────────────────────────────────────────────────────────
# POST /api/crypto/exchange
# Requires authentication
# ─────────────────────────────────────────────────────────────
@bp.route("/exchange", methods=["POST"])
@jwt_required()
def key_exchange():
    """
    Perform ECDH key exchange.

    The client sends its ECDH public key. The server:
      1. Stores the client's public key against the user account.
      2. Derives the shared AES-256 key (for validation).
      3. Returns a session_key_id (used to tag encrypted assessments).

    Request body:
        { "client_public_key": "-----BEGIN PUBLIC KEY-----\n..." }

    Response:
        {
          "session_key_id": "abc123...",
          "message":        "Key exchange complete. Shared key derived."
        }
    """
    # Validate request body
    data = request.get_json(silent=True)
    if not data or "client_public_key" not in data:
        return jsonify({
            "error": "Bad Request",
            "message": "'client_public_key' (PEM string) is required."
        }), 400
    # Extract the client's public key from the request
    client_public_key_pem = data["client_public_key"]

    # Derive the shared secret to validate the client's key is on P-256
    try:
        _shared_key = compute_shared_secret(client_public_key_pem)
    except ValueError as e:
        return jsonify({"error": "Bad Request", "message": str(e)}), 400

    user = get_current_user()

    # Store client public key against user account
    user.ecdh_public_key = client_public_key_pem
    session_key_id = generate_session_key_id()
    # Store the session_key_id in the user record for future reference
    db.session.commit()
    # Log the key exchange event in the audit log
    log_event(
        action        = AuditAction.ECDH_KEY_EXCHANGE,
        description   = f"ECDH key exchange performed for user '{user.email}'. Session: {session_key_id}.",
        user_id       = user.id,
        user_email    = user.email,
        status_code   = 200,
    )
    # Return the session_key_id to the client for tagging encrypted assessments
    return jsonify({
        "session_key_id": session_key_id,
        "message": (
            "ECDH key exchange complete. "
            "Derive the shared key using HKDF-SHA256 from the ECDH output. "
            "Use this key with AES-256-GCM to encrypt your assessment payload."
        ),
    }), 200
