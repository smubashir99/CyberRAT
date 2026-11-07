/**
 * CyberRAT— Signup Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Public self-registration form.
 * Allows anyone to create an Analyst or Viewer account.
 * Admin accounts can only be created by an existing admin.
 *
 * Password complexity enforced client-side (mirrors backend rules):
 *   - Min 8 characters
 *   - At least one uppercase letter
 *   - At least one digit
 *   - At least one special character
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../services/api";
import toast from "react-hot-toast";
import "./LoginPage.css";      // reuse login styles
import "./SignupPage.css";

/* Password strength rules */
const RULES = [
  { id: "len",  label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { id: "upper",label: "One uppercase letter (A–Z)",   test: (p) => /[A-Z]/.test(p) },
  { id: "digit",label: "One digit (0–9)",              test: (p) => /\d/.test(p) },
  { id: "spec", label: "One special character (!@#…)", test: (p) => /[!@#$%^&*()\-_=+\[\]{}|;':",.<>?/`~\\]/.test(p) },
];
// PasswordRule component displays a single password rule with a checkmark if met, or an empty circle if not met.
function PasswordRule({ met, label }) {
  return (
    <li className={`pw-rule ${met ? "pw-rule--met" : ""}`}>
      <span className="pw-rule-icon">{met ? "✓" : "○"}</span>
      {label}
    </li>
  );
}
// SignupPage component renders the signup form and handles form submission, validation, and API interaction.
export default function SignupPage() {
  const navigate = useNavigate();
  // Form state for first name, last name, email, password, confirm password, and role selection.
  const [form, setForm] = useState({
    first_name: "",
    last_name:  "",
    email:      "",
    password:   "",
    confirm:    "",
    role:       "analyst",
  });
  // State variables for loading state, error messages, and password visibility toggle.
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);
  // Helper function to update form state based on input field changes.
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  // Compute password rules and check if all rules are met for validation feedback.
  const passwordRules = RULES.map((r) => ({ ...r, met: r.test(form.password) }));
  const allRulesMet   = passwordRules.every((r) => r.met);
  // Handle form submission, validate inputs, and call the signup API endpoint. Display success or error messages accordingly.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Validate password rules and confirm password match before proceeding with API call.
    if (!allRulesMet) {
      setError("Please meet all password requirements below.");
      return;
    }
    // Check if password and confirm password fields match
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    // Set loading state and attempt to call the signup API endpoint with the form data.
    setLoading(true);
    try {
      await authAPI.signup({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        email:      form.email.trim().toLowerCase(),
        password:   form.password,
        role:       form.role,
      });
      // On successful signup, display a success toast and navigate to the login page.
      toast.success("Account created! You can now log in.");
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "Signup failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  // Render the signup form with input fields for first name, last name, email, password, confirm password, 
  // and role selection. Display validation feedback and handle form submission.
  return (
    <div className="login-page">
      <div className="login-page__glow" />

      <div className="login-card signup-card">
        {/* Header */}
        <div className="login-card__header">
          <div className="login-card__logo">🛡</div>
          <h1 className="login-card__title">Create Account</h1>
          <p className="login-card__subtitle">
            CyberRAT — Cybersecurity Risk Assessment Framework
          </p>
        </div>
        // Signup form with input fields for user details, password rules, and submission button. 
        //Displays error messages and validation feedback.
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Name row */}
          <div className="signup-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Jane"
                value={form.first_name}
                onChange={set("first_name")}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Doe"
                value={form.last_name}
                onChange={set("last_name")}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="jane@example.ie"
              value={form.email}
              onChange={set("email")}
              required
            />
          </div>

          {/* Role */}
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-control"
              value={form.role}
              onChange={set("role")}
            >
              <option value="analyst">
                Analyst — Submit and view own assessments
              </option>
              <option value="viewer">
                Viewer — Read-only access to own results
              </option>
            </select>
            <small className="form-hint">
              Admin accounts can only be created by an existing administrator.
            </small>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-toggle">
              <input
                type={showPass ? "text" : "password"}
                className="form-control"
                placeholder="Create a strong password"
                value={form.password}
                onChange={set("password")}
                required
              />
              <button
                type="button"
                className="input-toggle-btn"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>

            {/* Password rules */}
            {form.password.length > 0 && (
              <ul className="pw-rules">
                {passwordRules.map((r) => (
                  <PasswordRule key={r.id} met={r.met} label={r.label} />
                ))}
              </ul>
            )}
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type={showPass ? "text" : "password"}
              className={`form-control ${
                form.confirm && form.confirm !== form.password
                  ? "form-control--error"
                  : ""
              }`}
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={set("confirm")}
              required
            />
            {form.confirm && form.confirm !== form.password && (
              <small className="form-error-text">Passwords do not match.</small>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={
              loading ||
              !form.email ||
              !form.first_name ||
              !form.last_name ||
              !allRulesMet ||
              form.password !== form.confirm
            }
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating…</>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="login-card__signup-link">
          Already have an account?{" "}
          <Link to="/login" className="link-blue">Sign in here</Link>
        </p>

        <p className="login-card__footer">
          DBS Dublin · CRAF Framework · Dissertation 2026
        </p>
      </div>
    </div>
  );
}
