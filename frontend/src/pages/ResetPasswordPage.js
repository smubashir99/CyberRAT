/**
 * CyberRAT — Reset Password Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Reads ?token=... and ?email=... from the URL (sent in reset email).
 * User enters a new password, submits → redirected to login on success.
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "./LoginPage.css"; // reuse login styles

// Password hint displayed below the password input field to inform users of the required complexity for a valid password.
const PASSWORD_HINT =
  "Min 8 chars · uppercase · digit · special character (!@#$%...)";

// ResetPasswordPage component handles the password reset process by validating the token and email from the URL, 
// allowing users to set a new password, and providing feedback on the password strength.
export default function ResetPasswordPage() {
  const [searchParams]           = useSearchParams();
  const navigate                 = useNavigate();

  const [newPassword,    setNewPassword]    = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw,         setShowPw]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [tokenMissing,   setTokenMissing]   = useState(false);

  // Extract the token and email from the URL search parameters. If either is missing, 
  // set the tokenMissing state to true to display an error message.
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  // useEffect hook checks if the token or email is missing when the component mounts or when they change,
  useEffect(() => {
    if (!token || !email) setTokenMissing(true);
  }, [token, email]);

  // Handle form submission for resetting the password. Validates the new password and confirmation,
  // sends a POST request to the backend, and provides feedback to the user.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    // Additional password complexity checks can be added here if needed.
    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", {
        email,
        token,
        new_password: newPassword,
      });
      toast.success("Password reset! Please log in with your new password.");
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "Reset failed. The link may have expired.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (tokenMissing) {
    return (
      <div className="login-page">
        <div className="login-page__glow" />
        <div className="login-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: "#ef4444", marginBottom: 8 }}>Invalid Reset Link</h2>
          <p style={{ color: "#94a3b8", marginBottom: 20 }}>
            This reset link is missing required parameters. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn btn-primary btn-full">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-page__glow" />

      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__logo">🔒</div>
          <h1 className="login-card__title">Set New Password</h1>
          <p className="login-card__subtitle">
            Resetting password for <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error"><span>⚠</span> {error}</div>}

          <div className="form-group">
            <label className="form-label">New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                className="form-control"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer", fontSize: 16,
                  color: "#94a3b8",
                }}
                title={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
            <p style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
              {PASSWORD_HINT}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type={showPw ? "text" : "password"}
              className="form-control"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Strength bar */}
          {newPassword.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <PasswordStrengthBar password={newPassword} />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16 }} /> Resetting…</>
            ) : (
              "Reset Password ✓"
            )}
          </button>
        </form>

        <p className="login-card__signup-link" style={{ marginTop: 20 }}>
          <Link to="/login" className="link-blue">← Back to Login</Link>
        </p>

        <p className="login-card__footer">
          DBS Dublin · CRAF Framework · Dissertation 2026
        </p>
      </div>
    </div>
  );
}

/* ── Inline Password Strength Bar ─────────────────────────────── */
function PasswordStrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()\-_=+\[\]{}|;':",.<>?/`~\\]/.test(password),
  ];
  const score  = checks.filter(Boolean).length;
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < score ? colors[score] : "#334155",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <p style={{ color: colors[score], fontSize: 11, margin: 0 }}>
        {labels[score]}
      </p>
    </div>
  );
}
