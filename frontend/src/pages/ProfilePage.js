/**
 * CyberRAT — Profile Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Allows the authenticated user to:
 *   1. Update their display name (first_name / last_name)
 *   2. Change their password (current → new, with complexity rules)
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import toast from "react-hot-toast";
import "./ProfilePage.css";

/* ── Password strength helper ──────────────────────────────── */
// Returns an object with score (0–5), label, and color based on password complexity.
function getStrength(pw) {
  let score = 0;
  if (!pw) return { score: 0, label: "", color: "" };
  if (pw.length >= 8)                       score++;
  if (pw.length >= 12)                      score++;
  if (/[A-Z]/.test(pw))                     score++;
  if (/[0-9]/.test(pw))                     score++;
  if (/[^A-Za-z0-9]/.test(pw))             score++;
  // Map score to label and color for visual feedback in the UI.
  const map = [
    { label: "Too short",  color: "#f85149" },
    { label: "Weak",       color: "#f85149" },
    { label: "Fair",       color: "#d29922" },
    { label: "Good",       color: "#3fb950" },
    { label: "Strong",     color: "#3fb950" },
    { label: "Very strong",color: "#00d4de" },
  ];
  // Ensure score is within bounds of the map array.
  return { score, ...map[score] };
}

/* ── Role badge ────────────────────────────────────────────── */
// Maps user roles to display labels and colors for the profile page.
const ROLE_META = {
  admin:   { label: "Admin",   color: "#f85149" },
  analyst: { label: "Analyst", color: "#58a6ff" },
  viewer:  { label: "Viewer",  color: "#8b949e" },
};
// The ProfilePage component allows users to manage their account details, including updating their display name 
// and changing their password. It provides real-time feedback on password strength and ensures that all fields 
// are validated before submission.
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  /* ── Name form state ──────────────────────────────────────── */
  // State for managing the user's first and last name, along with a loading state for saving changes.
  const [nameForm, setNameForm] = useState({
    first_name: user?.first_name || "",
    last_name:  user?.last_name  || "",
  });
  // State to track whether the name update is currently being saved, which can be used to disable the save button
  //  and show a loading indicator.
  const [nameSaving, setNameSaving] = useState(false);

  /* ── Password form state ──────────────────────────────────── */
  // State for managing the password change form, including current, new, and confirm password fields.
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password:     "",
    confirm_password: "",
  });
  // State to track whether the password change is currently being saved, which can be used to disable the save button
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState({
    current: false,
    new:     false,
    confirm: false,
  });
  // Calculate the strength of the new password in real-time as the user types, providing feedback on its complexity.
  const strength = getStrength(pwForm.new_password);
  const roleMeta = ROLE_META[user?.role] || ROLE_META.viewer;

  /* ── Handlers ─────────────────────────────────────────────── */
  // Handle changes to the name form fields by updating the corresponding state.
  const handleNameChange = (e) =>
    setNameForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handlePwChange = (e) =>
    setPwForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const togglePw = (field) =>
    setShowPw((s) => ({ ...s, [field]: !s[field] }));

  /* Save name */
  const handleNameSave = async (e) => {
    e.preventDefault();
    const fn = nameForm.first_name.trim();
    const ln = nameForm.last_name.trim();
    if (!fn || !ln) {
      toast.error("First and last name cannot be empty.");
      return;
    }
    setNameSaving(true);
    try {
      await authAPI.updateProfile({ first_name: fn, last_name: ln });
      await refreshUser();
      toast.success("Name updated successfully!");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update name.";
      toast.error(msg);
    } finally {
      setNameSaving(false);
    }
  };

  /* Change password */
  const handlePwSave = async (e) => {
    e.preventDefault();
    const { current_password, new_password, confirm_password } = pwForm;
    if (!current_password || !new_password || !confirm_password) {
      toast.error("All password fields are required.");
      return;
    }
    if (new_password !== confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }
    if (new_password.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await authAPI.changePassword({ current_password, new_password, confirm_password });
      toast.success("Password changed successfully!");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to change password.";
      toast.error(msg);
    } finally {
      setPwSaving(false);
    }
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="profile-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="profile-header">
        <div>
          <h1 className="profile-title">My Profile</h1>
          <p className="profile-subtitle">
            Manage your account details and security settings
          </p>
        </div>
      </div>

      {/* ── Account card ───────────────────────────────────── */}
      <div className="profile-account-card">
        <div className="profile-avatar">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div className="profile-account-info">
          <div className="profile-account-name">
            {user?.first_name} {user?.last_name}
          </div>
          <div className="profile-account-email">{user?.email}</div>
          <div className="profile-account-meta">
            <span
              className="profile-role-badge"
              style={{ background: roleMeta.color + "22", color: roleMeta.color, borderColor: roleMeta.color + "44" }}
            >
              {roleMeta.label}
            </span>
            <span className="profile-joined">
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IE", { year: "numeric", month: "long" }) : "—"}
            </span>
            {user?.last_login && (
              <span className="profile-last-login">
                Last login: {new Date(user.last_login).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-grid">

        {/* ── Update name ────────────────────────────────────── */}
        <section className="profile-card">
          <div className="profile-card__header">
            <span className="profile-card__icon">✏️</span>
            <div>
              <div className="profile-card__title">Display Name</div>
              <div className="profile-card__desc">Update how your name appears across the system</div>
            </div>
          </div>

          <form onSubmit={handleNameSave} className="profile-form" noValidate>
            <div className="profile-form__row">
              <div className="profile-field">
                <label className="profile-label" htmlFor="first_name">First Name</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  className="profile-input"
                  value={nameForm.first_name}
                  onChange={handleNameChange}
                  maxLength={100}
                  autoComplete="given-name"
                />
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="last_name">Last Name</label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  className="profile-input"
                  value={nameForm.last_name}
                  onChange={handleNameChange}
                  maxLength={100}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="profile-field">
              <label className="profile-label">Email Address</label>
              <input
                type="email"
                className="profile-input profile-input--readonly"
                value={user?.email || ""}
                readOnly
                title="Email cannot be changed"
              />
              <span className="profile-field-hint">Email address is fixed and cannot be changed</span>
            </div>

            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={nameSaving}
            >
              {nameSaving ? (
                <><span className="spinner spinner--sm" /> Saving…</>
              ) : "Save Changes"}
            </button>
          </form>
        </section>

        {/* ── Change password ─────────────────────────────────── */}
        <section className="profile-card">
          <div className="profile-card__header">
            <span className="profile-card__icon">🔒</span>
            <div>
              <div className="profile-card__title">Change Password</div>
              <div className="profile-card__desc">Choose a strong password to protect your account</div>
            </div>
          </div>

          <form onSubmit={handlePwSave} className="profile-form" noValidate>
            {/* Current password */}
            <div className="profile-field">
              <label className="profile-label" htmlFor="current_password">Current Password</label>
              <div className="profile-pw-wrap">
                <input
                  id="current_password"
                  name="current_password"
                  type={showPw.current ? "text" : "password"}
                  className="profile-input"
                  value={pwForm.current_password}
                  onChange={handlePwChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="profile-pw-toggle"
                  onClick={() => togglePw("current")}
                  tabIndex={-1}
                  aria-label={showPw.current ? "Hide password" : "Show password"}
                >
                  {showPw.current ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="profile-field">
              <label className="profile-label" htmlFor="new_password">New Password</label>
              <div className="profile-pw-wrap">
                <input
                  id="new_password"
                  name="new_password"
                  type={showPw.new ? "text" : "password"}
                  className="profile-input"
                  value={pwForm.new_password}
                  onChange={handlePwChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="profile-pw-toggle"
                  onClick={() => togglePw("new")}
                  tabIndex={-1}
                  aria-label={showPw.new ? "Hide password" : "Show password"}
                >
                  {showPw.new ? "🙈" : "👁"}
                </button>
              </div>

              {/* Strength bar */}
              {pwForm.new_password && (
                <div className="profile-strength">
                  <div className="profile-strength__bar">
                    {[0,1,2,3,4].map((i) => (
                      <div
                        key={i}
                        className="profile-strength__seg"
                        style={{ background: i < strength.score ? strength.color : "#21262d" }}
                      />
                    ))}
                  </div>
                  <span className="profile-strength__label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}

              {/* Rules */}
              <div className="profile-pw-rules">
                <PasswordRule met={pwForm.new_password.length >= 8}       label="At least 8 characters" />
                <PasswordRule met={/[A-Z]/.test(pwForm.new_password)}     label="One uppercase letter (A–Z)" />
                <PasswordRule met={/[0-9]/.test(pwForm.new_password)}     label="One number (0–9)" />
                <PasswordRule met={/[^A-Za-z0-9]/.test(pwForm.new_password)} label="One special character (!@#…)" />
              </div>
            </div>

            {/* Confirm password */}
            <div className="profile-field">
              <label className="profile-label" htmlFor="confirm_password">Confirm New Password</label>
              <div className="profile-pw-wrap">
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type={showPw.confirm ? "text" : "password"}
                  className={`profile-input ${
                    pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password
                      ? "profile-input--error"
                      : pwForm.confirm_password && pwForm.new_password === pwForm.confirm_password
                      ? "profile-input--ok"
                      : ""
                  }`}
                  value={pwForm.confirm_password}
                  onChange={handlePwChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="profile-pw-toggle"
                  onClick={() => togglePw("confirm")}
                  tabIndex={-1}
                  aria-label={showPw.confirm ? "Hide password" : "Show password"}
                >
                  {showPw.confirm ? "🙈" : "👁"}
                </button>
              </div>
              {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                <span className="profile-field-error">Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={pwSaving}
            >
              {pwSaving ? (
                <><span className="spinner spinner--sm" /> Changing…</>
              ) : "Change Password"}
            </button>
          </form>
        </section>
      </div>

      {/* ── Account info strip ─────────────────────────────── */}
      <div className="profile-info-strip">
        <div className="profile-info-item">
          <span className="profile-info-label">User ID</span>
          <span className="profile-info-val">#{user?.id}</span>
        </div>
        <div className="profile-info-item">
          <span className="profile-info-label">Account Role</span>
          <span className="profile-info-val" style={{ color: roleMeta.color }}>{roleMeta.label}</span>
        </div>
        <div className="profile-info-item">
          <span className="profile-info-label">Account Status</span>
          <span className="profile-info-val profile-status--active">● Active</span>
        </div>
        <div className="profile-info-item">
          <span className="profile-info-label">Security</span>
          <span className="profile-info-val">bcrypt · JWT · 2FA</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-component: single password rule row ───────────────── */
function PasswordRule({ met, label }) {
  return (
    <div className={`profile-pw-rule ${met ? "profile-pw-rule--met" : ""}`}>
      <span className="profile-pw-rule__icon">{met ? "✓" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}
