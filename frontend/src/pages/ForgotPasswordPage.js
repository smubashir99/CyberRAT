/**
 * CyberRAT — Forgot Password Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Sends a password-reset email to the user.
 * In dev/debug mode the reset link is returned in the API response and shown on screen.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "./LoginPage.css"; // reuse login styles

//  ForgotPasswordPage component allows users to request a password reset by entering their email address.
export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [debugUrl,  setDebugUrl]  = useState(null);
  const [error,     setError]     = useState("");
// Handle form submission for requesting a password reset. Sends a POST request to the backend and provides feedback to the user.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Send a POST request to the backend API to initiate the password reset process. If successful, display a success 
    // message and, in dev mode, show the reset link. If there's an error, display an error message.
    try {
      const res = await axios.post("/api/auth/forgot-password", { email });
      setSent(true);
      if (res.data.debug_reset_url) {
        setDebugUrl(res.data.debug_reset_url);
        toast.success("Dev mode: reset link shown below.");
      } else {
        toast.success("Reset link sent! Check your inbox.");
      }// Handle errors by displaying an error message to the user.
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
// Render the ForgotPasswordPage component with a form for entering the email address, displaying feedback messages, 
// and providing a link back to the login page.
  return (
    <div className="login-page">
      <div className="login-page__glow" />

      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__logo">🔑</div>
          <h1 className="login-card__title">Forgot Password</h1>
          <p className="login-card__subtitle">
            Enter your email — we'll send a reset link
          </p>
        </div>    
{/* If the reset link has not been sent yet, display the form for entering the email address. If the link has been sent,
 display a confirmation message and, in dev mode, show the reset link */}
        {!sent ? (
          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="login-error"><span>⚠</span> {error}</div>}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || !email}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Sending…</>
              ) : (
                "Send Reset Link →"
              )}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <p style={{ color: "#22c55e", fontWeight: 600, marginBottom: 8 }}>
              Reset link sent!
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              Check your inbox at <strong>{email}</strong> and click the link within 1 hour.
            </p>

            {debugUrl && (
              <div className="login-debug-otp" style={{ textAlign: "left" }}>
                <span>🛠</span>
                <span>
                  <strong>Dev Mode:</strong>{" "}
                  <a href={debugUrl} style={{ color: "#60a5fa", wordBreak: "break-all" }}>
                    {debugUrl}
                  </a>
                </span>
              </div>
            )}
          </div>
        )}

        <p className="login-card__signup-link" style={{ marginTop: 20 }}>
          Remember your password?{" "}
          <Link to="/login" className="link-blue">Back to Login</Link>
        </p>

        <p className="login-card__footer">
          DBS Dublin · CRAF Framework · Dissertation 2026
        </p>
      </div>
    </div>
  );
}
