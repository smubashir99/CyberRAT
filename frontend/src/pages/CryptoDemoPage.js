/**
 * CyberRAT — ECDH + AES-256-GCM Live Demo Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Interactive demonstration of:
 *   1. Fetching server's P-256 public key
 *   2. Generating client ephemeral keypair in-browser (SubtleCrypto)
 *   3. ECDH exchange → shared secret → AES key
 *   4. AES-256-GCM encrypt + decrypt in-browser
 *
 * All crypto runs inside window.crypto.subtle — pure browser WebCrypto.
 */

import React, { useState } from "react";
import { cryptoAPI } from "../services/api";
import toast from "react-hot-toast";
import "./CryptoDemoPage.css";

/* ── Helpers ── */

/** Import a PEM-encoded P-256 public key as a CryptoKey */
// Matches backend: import_key(pem, format="spki", curve="P-256")
async function importPublicKeyPem(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der    = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki", der.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true, []
  );
}

/** Export a CryptoKey to PEM (SPKI format) */
// Matches backend: export_key(key, format="spki")
async function exportPublicKeyPem(key) {
  const spki   = await window.crypto.subtle.exportKey("spki", key);
  const b64    = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const lines  = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

/**
 * Derive a 32-byte AES key from ECDH raw shared secret using HKDF-SHA256.
 * Matches the backend: HKDF(sha256, raw_ecdh, salt=None, info="CyberRAT-v2-assessment-encryption", 32)
 */
// @param {CryptoKey} privateKey - client's ephemeral private key
async function deriveAesKey(privateKey, serverPublicKey) {
  // Step 1: get raw ECDH shared secret (256 bits)
  const rawBits = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPublicKey }, privateKey, 256
  );

  // Step 2: import raw bits as HKDF key material
  // Note: we use extractable=false here, but it doesn't matter since we don't export it
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", rawBits, { name: "HKDF" }, false, ["deriveKey"]
  );

  // Step 3: HKDF-SHA256 → AES-256-GCM key
  // info = UTF-8 bytes of "CyberRAT-v2-assessment-encryption" (matches backend)
  const info = new TextEncoder().encode("CyberRAT-v2-assessment-encryption");
// Step 4: derive AES-256-GCM key (32 bytes)
  return window.crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,                          // extractable = true so we can show a hint
    ["encrypt", "decrypt"]
  );
}

/** Export AES key raw bytes for display hint */
// @param {CryptoKey} aesKey - AES-256-GCM key
async function exportAesKeyHex(aesKey) {
  const raw = await window.crypto.subtle.exportKey("raw", aesKey);
  return buf2hex(new Uint8Array(raw));
}

/** AES-256-GCM encrypt — returns { ciphertext, iv, authTag } as hex strings */
// @param {string} plaintext - UTF-8 string to encrypt
// @param {CryptoKey} aesKey - AES-256-GCM key
async function aesEncrypt(plaintext, aesKey) {
  const iv        = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(plaintext);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 }, aesKey, encoded
  );
  // Last 16 bytes are the auth tag
  // The rest is the ciphertext.
  const cipherBytes = new Uint8Array(encrypted);
  const ciphertext  = cipherBytes.slice(0, -16);
  const authTag     = cipherBytes.slice(-16);
  return {
    ciphertext: buf2hex(ciphertext),
    iv:         buf2hex(iv),
    authTag:    buf2hex(authTag),
  };
}

/** AES-256-GCM decrypt */
// @param {string} ciphertextHex - hex string of ciphertext
// @param {string} ivHex - hex string of IV (12 bytes)
// @param {string} authTagHex - hex string of auth tag (16 bytes)
// @param {CryptoKey} aesKey - AES-256-GCM key
async function aesDecrypt(ciphertextHex, ivHex, authTagHex, aesKey) {
  const ctBytes  = hex2buf(ciphertextHex);
  const tagBytes = hex2buf(authTagHex);
  const combined = new Uint8Array(ctBytes.length + tagBytes.length);
  combined.set(ctBytes);
  combined.set(tagBytes, ctBytes.length);
  // Decrypt using AES-GCM with the provided IV and auth tag
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hex2buf(ivHex), tagLength: 128 }, aesKey, combined
  );
  // Decode the decrypted bytes back to a UTF-8 string
  return new TextDecoder().decode(decrypted);
}
// Utility functions to convert between ArrayBuffer/Uint8Array and hex strings
function buf2hex(buf) {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Convert hex string to Uint8Array
function hex2buf(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
}

/* ────────────────────────────────────────────────────────────── */
// ── React Component ── */
const STEPS = ["Fetch Server Key", "ECDH Exchange", "Encrypt", "Decrypt"];
// 0: fetch server key, 1: ECDH exchange, 2: encrypt, 3: decrypt
export default function CryptoDemoPage() {
  const [currentStep, setCurrentStep] = useState(0);

  // State buckets per step
  // Step 1: server key
  // Step 2: client keypair + ECDH
  // Step 3: AES encrypt
  // Step 4: AES decrypt
  const [serverPem,    setServerPem]    = useState("");
  const [clientPem,    setClientPem]    = useState("");
  const [aesKey,       setAesKey]       = useState(null);  // CryptoKey (not displayed)
  const [aesKeyHint,   setAesKeyHint]   = useState("");    // first 16 chars of hex
  const [sessionKeyId, setSessionKeyId] = useState("");

  const [plaintext,    setPlaintext]    = useState("Hello from CyberRAT-v2! This message is encrypted with AES-256-GCM.");
  const [encrypted,    setEncrypted]    = useState(null);  // { ciphertext, iv, authTag }
  const [decrypted,    setDecrypted]    = useState("");

  const [loading, setLoading] = useState(false);
  const [log,     setLog]     = useState([]);   // activity log entries

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));

  /* ── Step 1: Fetch server public key ── */
  const fetchServerKey = async () => {
    setLoading(true);
    try {
      const r = await cryptoAPI.getServerKey();
      setServerPem(r.data.public_key_pem);
      addLog(`✓ Server P-256 public key fetched (curve: ${r.data.curve})`, "success");
      setCurrentStep(1);
      toast.success("Server key fetched!");
    } catch (e) {
      addLog(`✗ ${e.response?.data?.message || e.message}`, "error");
      toast.error("Failed to fetch server key.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Generate client keypair + ECDH exchange ── */
  const doExchange = async () => {
    setLoading(true);
    try {
      // Generate ephemeral client keypair
      const clientKeyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
      );
      const clientPemStr = await exportPublicKeyPem(clientKeyPair.publicKey);
      setClientPem(clientPemStr);
      addLog("✓ Client P-256 ephemeral keypair generated", "success");

      // ECDH exchange with server — get session_key_id
      const serverPubKey = await importPublicKeyPem(serverPem);
      const exRes        = await cryptoAPI.exchange(clientPemStr);
      setSessionKeyId(exRes.data.session_key_id);
      addLog(`✓ ECDH exchange complete. Session key ID: ${exRes.data.session_key_id.slice(0, 12)}…`, "success");

      // Derive AES key locally using HKDF-SHA256 (matches server-side)
      const derivedKey = await deriveAesKey(clientKeyPair.privateKey, serverPubKey);
      setAesKey(derivedKey);
      // Export AES key raw bytes for display hint
      const aesHex = await exportAesKeyHex(derivedKey);
      setAesKeyHint(aesHex.slice(0, 16) + "…");
      addLog("✓ AES-256 key derived via HKDF-SHA256 from ECDH shared secret", "success");

      setCurrentStep(2);
      toast.success("Key exchange complete!");
    } catch (e) {
      addLog(`✗ ${e.message}`, "error");
      toast.error("ECDH exchange failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: Encrypt ── */
  const doEncrypt = async () => {
    // Ensure we have an AES key
    if (!aesKey) { toast.error("No AES key — complete ECDH first."); return; }
    setLoading(true);
    try {
      const enc = await aesEncrypt(plaintext, aesKey);
      setEncrypted(enc);
      setDecrypted("");
      addLog(`✓ Encrypted ${plaintext.length} bytes → ciphertext: ${enc.ciphertext.slice(0, 20)}…`, "success");
      addLog(`  IV: ${enc.iv}`, "info");
      addLog(`  Auth tag: ${enc.authTag}`, "info");
      setCurrentStep(3);
      toast.success("Message encrypted!");
    } catch (e) {
      addLog(`✗ Encryption failed: ${e.message}`, "error");
      toast.error("Encryption failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 4: Decrypt ── */
  // Ensure we have an AES key and ciphertext
  const doDecrypt = async () => {
    // Ensure we have an AES key and ciphertext
    if (!aesKey || !encrypted) { toast.error("Encrypt first."); return; }
    setLoading(true);
    // Attempt decryption and verify auth tag
    try {
      // Decrypt using AES-256-GCM with the provided ciphertext, IV, and auth tag
      const dec = await aesDecrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, aesKey);
      setDecrypted(dec);
      addLog(`✓ Decrypted successfully: "${dec.slice(0, 40)}…"`, "success");
      toast.success("Message decrypted — auth tag verified!");
    } catch (e) {
      addLog(`✗ Decryption / tag verification failed: ${e.message}`, "error");
      toast.error("Decryption failed — tamper detected!");
    } finally {
      setLoading(false);
    }
  };
  // Render the page
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">ECDH + AES-256-GCM Live Demo</h1>
        <p className="page-subtitle">
          Interactive demonstration of P-256 ECDH key exchange and AES-256-GCM encryption
          using browser-native WebCrypto API.
        </p>
      </div>

      {/* ── Step progress ── */}
      <div className="crypto-steps">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`crypto-step ${i <= currentStep ? "crypto-step--done" : ""} ${i === currentStep ? "crypto-step--active" : ""}`}
          >
            <div className="crypto-step__num">{i < currentStep ? "✓" : i + 1}</div>
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="crypto-layout">
        {/* ── Left column: action panels ── */}
        <div className="crypto-panels">

          {/* Panel 1 */}
          <div className={`card crypto-panel ${currentStep >= 0 ? "" : "crypto-panel--disabled"}`}>
            <h3 className="crypto-panel__title">
              <span className="crypto-panel__num">1</span>
              Fetch Server Public Key
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              GET <code>/api/crypto/server-key</code> — returns the server's
              static P-256 (secp256r1) public key in PEM format.
            </p>
            {serverPem && (
              <div className="crypto-pem-box">
                <span className="crypto-pem-label">Server PEM</span>
                <pre>{serverPem}</pre>
              </div>
            )}
            <button className="btn btn-primary" onClick={fetchServerKey} disabled={loading || currentStep > 0}>
              {loading && currentStep === 0 ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Fetching…</> : "Fetch Key"}
            </button>
          </div>

          {/* Panel 2 */}
          <div className={`card crypto-panel ${currentStep >= 1 ? "" : "crypto-panel--disabled"}`}>
            <h3 className="crypto-panel__title">
              <span className="crypto-panel__num">2</span>
              ECDH Key Exchange
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Generate an ephemeral P-256 keypair in-browser, then POST to
              <code> /api/crypto/exchange</code>. Derive shared AES-256 key.
            </p>
            {clientPem && (
              <div className="crypto-pem-box">
                <span className="crypto-pem-label">Client ephemeral PEM</span>
                <pre>{clientPem}</pre>
              </div>
            )}
            {aesKeyHint && (
              <div className="crypto-hint-row">
                <span className="crypto-hint-label">Derived key (raw, first 8 bytes)</span>
                <code>{aesKeyHint}</code>
              </div>
            )}
            {sessionKeyId && (
              <div className="crypto-hint-row">
                <span className="crypto-hint-label">Session key ID</span>
                <code>{sessionKeyId}</code>
              </div>
            )}
            <button className="btn btn-primary" onClick={doExchange} disabled={loading || currentStep !== 1}>
              {loading && currentStep === 1 ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Exchanging…</> : "Generate & Exchange"}
            </button>
          </div>

          {/* Panel 3 */}
          <div className={`card crypto-panel ${currentStep >= 2 ? "" : "crypto-panel--disabled"}`}>
            <h3 className="crypto-panel__title">
              <span className="crypto-panel__num">3</span>
              AES-256-GCM Encrypt
            </h3>
            <div className="form-group">
              <label className="form-label">Plaintext message</label>
              <textarea
                className="form-control"
                rows={3}
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                disabled={currentStep < 2}
              />
            </div>
            {encrypted && (
              <div className="crypto-encrypted-block">
                <div className="crypto-field-row">
                  <span className="crypto-field-label">Ciphertext (hex)</span>
                  <code>{encrypted.ciphertext}</code>
                </div>
                <div className="crypto-field-row">
                  <span className="crypto-field-label">IV (12 bytes)</span>
                  <code>{encrypted.iv}</code>
                </div>
                <div className="crypto-field-row">
                  <span className="crypto-field-label">Auth tag (16 bytes)</span>
                  <code>{encrypted.authTag}</code>
                </div>
              </div>
            )}
            <button className="btn btn-primary" onClick={doEncrypt} disabled={loading || currentStep < 2 || !plaintext}>
              {loading && currentStep === 2 ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Encrypting…</> : "Encrypt"}
            </button>
          </div>

          {/* Panel 4 */}
          <div className={`card crypto-panel ${currentStep >= 3 ? "" : "crypto-panel--disabled"}`}>
            <h3 className="crypto-panel__title">
              <span className="crypto-panel__num">4</span>
              AES-256-GCM Decrypt
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Decrypts using the same derived key. GCM auth tag is verified —
              any tampering with ciphertext, IV, or tag causes decryption to fail.
            </p>
            {decrypted && (
              <div className="crypto-decrypted-block">
                <span className="crypto-field-label">Decrypted plaintext ✓</span>
                <p className="crypto-decrypted-text">{decrypted}</p>
              </div>
            )}
            <button className="btn btn-success" onClick={doDecrypt} disabled={loading || !encrypted}>
              {loading && currentStep === 3 ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Decrypting…</> : "Decrypt & Verify Tag"}
            </button>
          </div>
        </div>

        {/* ── Right column: activity log ── */}
        <div className="crypto-log-panel card">
          <h3 className="crypto-panel__title">Activity Log</h3>
          {log.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12 }}>Waiting for activity…</p>
          ) : (
            <div className="crypto-log">
              {log.map((entry, i) => (
                <div key={i} className={`crypto-log__entry crypto-log__entry--${entry.type}`}>
                  <span className="crypto-log__ts">{entry.ts}</span>
                  <span>{entry.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Algorithm info */}
          <div className="crypto-algo-info">
            <h4>Algorithms Used</h4>
            <table>
              <tbody>
                <tr><td>Key Exchange</td><td>ECDH / P-256 (secp256r1)</td></tr>
                <tr><td>KDF</td><td>SHA-256 (raw shared secret)</td></tr>
                <tr><td>Symmetric</td><td>AES-256-GCM</td></tr>
                <tr><td>IV size</td><td>96-bit (12 bytes, random)</td></tr>
                <tr><td>Auth tag</td><td>128-bit (16 bytes)</td></tr>
                <tr><td>Key size</td><td>256-bit</td></tr>
                <tr><td>API</td><td>window.crypto.subtle (WebCrypto)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
