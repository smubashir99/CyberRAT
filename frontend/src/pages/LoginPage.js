/**
 * CyberRAT — Login Page (2-Factor: Password → Email OTP)
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Two-step login flow:
 *   Step 1 — Enter email + password → server validates and sends OTP to email
 *   Step 2 — Enter 6-digit OTP code → server verifies and issues JWT tokens
 *
 * In development / demo mode the OTP is shown in the UI automatically
 * (MAIL_DEBUG_MODE=true on the backend).
 */

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import "./LoginPage.css";

/** Autofill OTP demo credential into step 1 */
function DemoCred({ role, email, password, onFill }) {
  return (
    <div
      className="login-cred-row"
      onClick={() => onFill(email, password)}
      title={`Click to fill ${role} credentials`}
    >
      <span className={`badge badge-${role.toLowerCase()}`}>{role}</span>
      <code>{email}</code>
    </div>
  );
}
// Main LoginPage component
export default function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();

  // ── Step state: "credentials" | "otp"
  const [step,     setStep]     = useState("credentials");

  // ── Step 1 fields
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // ── Step 2 state
  const [userId,   setUserId]   = useState(null);
  const [otp,      setOtp]      = useState(["", "", "", "", "", ""]);
  const [debugOtp, setDebugOtp] = useState(null); // shown in dev mode

  // ── Shared
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState("");

  const otpRefs = useRef([]);

  // Auto-focus first OTP box when step changes
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ── Step 1: Submit credentials ──────────────────────────────
  // Handles the first step of the login process where the user submits their email and password. If successful, 
  // it transitions to the OTP verification step.
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      // data = { user_id, otp_required, debug_otp? }
      setUserId(data.user_id);
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp);
        // Auto-fill OTP boxes in dev mode
        setOtp(data.debug_otp.split(""));
        toast.success("Dev mode: OTP auto-filled below.");
      } else {
        toast.success("OTP sent to your email!");
      }
      setStep("otp");
    } 
    // Handle errors such as invalid credentials or server issues
    catch (err) {
      const msg = err.response?.data?.message || "Login failed. Please check your credentials.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Submit OTP ──────────────────────────────────────
  // Handles the second step of the login process where the user submits the OTP received via email. If successful,
  // it navigates to the dashboard.
  const handleOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      setLoading(false);
      return;
    }
    // Attempt to verify the OTP with the server
    try {
      const user = await verifyOtp(userId, code);
      toast.success(`Welcome back, ${user.first_name}! 🛡`);
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid or expired OTP. Please try again.";
      setError(msg);
      toast.error(msg);
      // Clear boxes on failure
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP box keyboard handler ────────────────────────────────
  // Handles input changes, navigation between boxes, and pasting of OTP codes. It ensures that only numeric input is accepted 
  // and manages focus between the six OTP input fields.
  const handleOtpChange = (idx, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...otp];
    next[idx]   = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  };
  // Handle backspace and arrow key navigation between OTP boxes
  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
    // Arrow key navigation
    if (e.key === "ArrowLeft"  && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  // Paste handler — fill all boxes from clipboard
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length > 0) {
      const digits = text.split("");
      setOtp([...digits, ...Array(6 - digits.length).fill("")]);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
    }
  };

  
  const fillDemo = (em, pw) => { setEmail(em); setPassword(pw); };

  // ── Back to step 1 ──────────────────────────────────────────
  const goBack = () => {
    setStep("credentials");
    setOtp(["", "", "", "", "", ""]);
    setDebugOtp(null);
    setError("");
    setUserId(null);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-page__glow" />

      <div className="login-card">
        {/* Header */}
        <div className="login-card__header">
          <div className="login-card__logo">🛡</div>
          <h1 className="login-card__title">CyberRAT</h1>
          <p className="login-card__subtitle">
            Cybersecurity Risk Assessment Framework
          </p>
        </div>

        {/* Security badges */}
        <div className="login-card__badges">
          <span className="login-badge">🔐 AES-256-GCM</span>
          <span className="login-badge">🔑 ECDH P-256</span>
          <span className="login-badge">🧂 bcrypt</span>
          <span className="login-badge">🪙 JWT</span>
          <span className="login-badge">📧 OTP 2FA</span>
        </div>
         // Step 1: Credentials form
        {/* ── Step 1: Credentials ── */}
        {step === "credentials" && (
          <form onSubmit={handleCredentials} noValidate>
            {error && <div className="login-error"><span>⚠</span> {error}</div>}

            <div className="login-step-label">Step 1 of 2 — Sign In</div>
            // Email input field
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="admin@cyberrat.ie"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            // Password input field with a link to the forgot password page
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <Link to="/forgot-password" className="link-blue" style={{ fontSize: 12 }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ marginTop: 6 }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</>
              ) : (
                "Continue →"
              )}
            </button>
          </form>
        )}
        // Step 2: OTP verification form
        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          // Form for entering the OTP code sent to the user's email. It includes input fields for each digit of the OTP,
          //  error handling, and navigation back to the previous step.
          <form onSubmit={handleOtp} noValidate>
            {error && <div className="login-error"><span>⚠</span> {error}</div>}

            <div className="login-step-label">Step 2 of 2 — Verification Code</div>

            <p className="login-otp-hint">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            // Show the OTP in dev mode for testing purposes
            {/* Dev mode notice */}
            {debugOtp && (
              <div className="login-debug-otp">
                <span>🛠</span>
                <span>
                  <strong>Dev Mode:</strong> OTP is <code>{debugOtp}</code> (auto-filled)
                </span>
              </div>
            )}
            
            {/* OTP boxes */}
            // Input fields for each digit of the OTP code. Users can paste the entire OTP, and the input will automatically 
            fill the boxes.
            <div className="otp-boxes" onPaste={handleOtpPaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className={`otp-box ${digit ? "otp-box--filled" : ""}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || otp.join("").length < 6}
            > // Submit button for verifying the OTP code. It shows a loading spinner when the verification is in progress 
                 and is disabled until all six digits are entered.
              {loading ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</>
              ) : (
                "Verify & Sign In"
              )}
            </button>
            // Back button to return to the previous step (credentials entry). It resets the OTP fields and any debug information.
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={goBack}
              style={{ marginTop: 8 }}
            >
              ← Back
            </button>
          </form>
        )}
        // Demo credentials for quick testing in development mode. Clicking on a demo credential fills the email 
           and password fields.
        {/* ── Demo credentials (step 1 only) ── */}
        {step === "credentials" && (
          <div className="login-card__demo">
            <p className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>
              DEMO CREDENTIALS (click to fill)
            </p>
            <DemoCred role="Admin"   email="admin@cyberrat.com"   password="Admin@CyberRAT2026!"   onFill={fillDemo} />
            <DemoCred role="Analyst" email="analyst@cyberrat.com" password="Analyst@CyberRAT2026!" onFill={fillDemo} />
          </div>
        )} 

        {/* ── Signup link ── */}
        {step === "credentials" && (
          <p className="login-card__signup-link">
            Don't have an account?{" "}
            <Link to="/signup" className="link-blue">Create one here</Link>
          </p>
        )}
  
        <p className="login-card__footer">
          DBS Dublin · CRAF Framework · Dissertation 2026
        </p>
      </div>
    </div>
  );
}
