/**
 * CyberRAT v2 — Auth Context
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Global authentication state using React Context API.
 * Provides: user, isAuthenticated, login(), verifyOtp(), logout(), loading
 *
 * Login is now a 2-step process:
 *   1. login(email, password) → validates credentials, returns { user_id, debug_otp }
 *   2. verifyOtp(userId, otp) → verifies OTP, stores tokens, sets user
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";

// Create a context for authentication state and actions
const AuthContext = createContext(null);
// Create a provider component that wraps the application and provides authentication state and actions
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    // If a token exists, fetch the current user from the API
    if (token) {
      authAPI.me()
        .then((res) => setUser(res.data.user))
        .catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
          }
        })
        // Finally, set loading to false after the API call is complete, regardless of success or failure
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Step 1: Validate email + password.
   * Returns { user_id, debug_otp } — client must then call verifyOtp().
   * Does NOT store any tokens — OTP step is still required.
   */
  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password);
    // Returns { user_id, otp_required: true, debug_otp? }
    return res.data;
  }, []);

  /**
   * Step 2: Verify the OTP code.
   * On success: stores JWT tokens and sets the authenticated user.
   * Returns the authenticated user object.
   */
  // Note: This function is called after the user has received the OTP (e.g., via email or SMS) and entered it in the UI.
  const verifyOtp = useCallback(async (userId, otp) => {
    const res = await authAPI.verifyOtp(userId, otp);
    const { access_token, refresh_token, user: userData } = res.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    setUser(userData);
    return userData;
  }, []);
  // Logout function: clears tokens and resets user state
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore errors — clear tokens regardless
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  /** Re-fetch the current user from /api/auth/me (e.g. after profile update) */
  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data.user);
    } catch {
      // Silently fail — user state stays as-is
    }
  }, []);
  // Derived state: isAuthenticated, isAdmin, isAnalyst
  const isAuthenticated = !!user;
  const isAdmin   = user?.role === "admin";
  const isAnalyst = user?.role === "analyst" || user?.role === "admin";
  // Provide the authentication state and actions to child components via context
  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isAdmin, isAnalyst, login, verifyOtp, logout, refreshUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to access the authentication context
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
