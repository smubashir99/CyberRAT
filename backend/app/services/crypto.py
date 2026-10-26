"""
CyberRAT v2 — Cryptography Service
=====================================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : ECDH key exchange + AES-256-GCM encryption/decryption
          for securing assessment data in transit and at rest.

──────────────────────────────────────────────────────────────────
Protocol Overview (ECDH + AES-256-GCM):
──────────────────────────────────────────────────────────────────

1. SERVER SETUP
   - Server generates an ECDH key pair (P-256 / secp256r1 curve)
     on startup. Private key stays server-side only.
   - Client requests the server's public key:
       GET /api/crypto/server-key → returns PEM-encoded public key

2. CLIENT KEY EXCHANGE
   - Client generates its own ECDH key pair.
   - Client sends its public key to the server:
       POST /api/crypto/exchange → { client_public_key: PEM }
   - Server performs ECDH: shared_secret = ECDH(server_private, client_public)
   - Client performs ECDH: shared_secret = ECDH(client_private, server_public)
   → Both sides now hold the same shared_secret without it ever being transmitted.

3. KEY DERIVATION
   - Raw ECDH output is fed through HKDF-SHA256 to produce a 256-bit AES key.
   - This protects against weak raw ECDH outputs.

4. ENCRYPTION (Client → Server)
   - Client encrypts assessment JSON: AES-256-GCM(shared_key, plaintext)
   - Produces: ciphertext + IV (12 bytes) + auth_tag (16 bytes)
   - Sends encrypted payload to /api/assessment/submit

5. DECRYPTION (Server)
   - Server decrypts with the same shared key.
   - GCM auth_tag verification detects any tampering.

──────────────────────────────────────────────────────────────────
Why ECDH over RSA:
  - Smaller key sizes (256-bit ECDH ≈ 3072-bit RSA security)
  - Forward secrecy: ephemeral key pairs mean past sessions
    cannot be decrypted even if the server key is later compromised
  - Faster: P-256 operations are significantly faster than RSA-3072
──────────────────────────────────────────────────────────────────
"""

import os
import json
import base64
import hashlib

from cryptography.hazmat.primitives.asymmetric.ec import (
    ECDH,
    generate_private_key,
    EllipticCurvePublicKey,
    SECP256R1,
)
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidTag


# ----------------------------------------------------------------
# Global server ECDH key pair (generated on app startup)
# In production: load from a secure key store, not regenerated
# ----------------------------------------------------------------
_server_private_key = None
_server_public_key_pem = None


def init_server_keypair():
    """
    Generate the server's ECDH key pair on startup.
    Called once from create_app().

    Curve: SECP256R1 (P-256) — NIST-approved, widely supported.
    """
    global _server_private_key, _server_public_key_pem
    # Generate a new ECDH private key for the server
    _server_private_key = generate_private_key(SECP256R1(), default_backend())

    # Export public key as PEM (sent to clients)
    _server_public_key_pem = _server_private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    
    print("[CyberRAT Crypto] ECDH server key pair generated (P-256 / secp256r1)")

def get_server_public_key_pem() -> str:
    """
    Return the server's ECDH public key in PEM format.
    This is the value sent to clients via GET /api/crypto/server-key.
    """
    # Ensure the server key pair has been initialised
    if _server_public_key_pem is None:
        raise RuntimeError("Server ECDH key pair not initialised. Call init_server_keypair() first.")
    return _server_public_key_pem

def compute_shared_secret(client_public_key_pem: str) -> bytes:
    """
    Perform ECDH key exchange using the server private key and
    the client's public key, then derive a 256-bit AES key via HKDF.

    Args:
        client_public_key_pem: The client's ECDH public key in PEM format.

    Returns:
        32-byte AES-256 key derived from the shared ECDH secret.

    Raises:
        ValueError: If the client's public key is invalid or malformed.
    """
    if _server_private_key is None:
        raise RuntimeError("Server ECDH key pair not initialised.")

    try:
        # Load the client's public key from PEM
        client_public_key = serialization.load_pem_public_key(
            client_public_key_pem.encode("utf-8"),
            backend=default_backend()
        )
        # Validate that it's an ECDH public key on the correct curve
    except Exception as e:
        raise ValueError(f"Invalid client ECDH public key: {e}")

    # Perform ECDH: server_private × client_public → shared_secret (raw bytes)
    raw_shared_secret = _server_private_key.exchange(ECDH(), client_public_key)

    # HKDF-SHA256: stretch/normalise the raw shared secret into a proper AES key.
    # Salt: None (uses HKDF default).
    # Info: application-specific label to domain-separate keys.
    aes_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,                    # 32 bytes = 256-bit AES key
        salt=None,
        info=b"CyberRAT-v2-assessment-encryption",
        backend=default_backend()
    ).derive(raw_shared_secret)

    return aes_key

def encrypt_aes_gcm(plaintext: dict, aes_key: bytes) -> dict:
    """
    Encrypt a dictionary using AES-256-GCM.

    AES-GCM provides both confidentiality (encryption) AND
    integrity (authentication tag). Any tampering with the
    ciphertext will cause decryption to fail with InvalidTag.

    Args:
        plaintext: Python dict (will be JSON-serialised before encryption).
        aes_key:   32-byte AES-256 key.

    Returns:
        dict with keys:
          ciphertext — base64-encoded encrypted data (includes GCM tag appended)
          iv         — base64-encoded 12-byte IV (Initialisation Vector)
          auth_tag   — base64-encoded 16-byte GCM authentication tag (extracted)
    """
    # Serialise dict → JSON bytes
    plaintext_bytes = json.dumps(plaintext, separators=(",", ":")).encode("utf-8")

    # Generate a random 12-byte IV (96 bits — GCM standard)
    # CRITICAL: IV must be unique for every encryption with the same key.
    iv = os.urandom(12)

    # AES-256-GCM encryption
    aesgcm = AESGCM(aes_key)
    # AESGCM.encrypt() appends the 16-byte auth tag to the ciphertext
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext_bytes, None)

    # Split ciphertext and auth tag
    auth_tag   = ciphertext_with_tag[-16:]   # last 16 bytes
    ciphertext = ciphertext_with_tag[:-16]   # everything before auth tag

    return {
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
        "iv":         base64.b64encode(iv).decode("utf-8"),
        "auth_tag":   base64.b64encode(auth_tag).decode("utf-8"),
    }


def decrypt_aes_gcm(ciphertext_b64: str, iv_b64: str, auth_tag_b64: str, aes_key: bytes) -> dict:
    """
    Decrypt AES-256-GCM ciphertext and verify the authentication tag.

    Args:
        ciphertext_b64: base64-encoded ciphertext (without auth tag).
        iv_b64:         base64-encoded 12-byte IV.
        auth_tag_b64:   base64-encoded 16-byte GCM authentication tag.
        aes_key:        32-byte AES-256 key.

    Returns:
        Decrypted plaintext as a Python dict.

    Raises:
        InvalidTag:  If the auth tag verification fails (data tampered).
        ValueError:  If base64 decoding fails or JSON is malformed.
    """
    try:
        ciphertext = base64.b64decode(ciphertext_b64)
        iv         = base64.b64decode(iv_b64)
        auth_tag   = base64.b64decode(auth_tag_b64)
    except Exception as e:
        raise ValueError(f"Invalid base64 in encrypted payload: {e}")

    # Reconstruct the ciphertext+tag format that AESGCM.decrypt() expects
    ciphertext_with_tag = ciphertext + auth_tag

    aesgcm = AESGCM(aes_key)
    try:
        plaintext_bytes = aesgcm.decrypt(iv, ciphertext_with_tag, None)
    except InvalidTag:
        # Authentication tag mismatch — ciphertext was tampered with
        raise InvalidTag("AES-GCM authentication failed: ciphertext may have been tampered with.")

    return json.loads(plaintext_bytes.decode("utf-8"))


def generate_session_key_id() -> str:
    """
    Generate a unique 32-character hex string to identify an ECDH session.
    Stored with each assessment so we can trace which key exchange was used.
    """
    return os.urandom(16).hex()
