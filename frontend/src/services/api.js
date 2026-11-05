/**
 * CyberRAT v2 — API Service Layer
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Centralised Axios instance with JWT interceptors.
 * - Attaches Bearer token to every request automatically
 * - Handles 401 responses (token expired) by redirecting to login
 * - All API calls go through this service (no raw fetch/axios elsewhere)
 */

import axios from "axios";
// Base URL for the API, configurable via environment variable
const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/// Note: In production, ensure that REACT_APP_API_URL is set to the correct backend URL.
// ── Axios instance ────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ── Request interceptor: attach JWT ──────────────────────────
// This interceptor runs before every request and adds the Authorization header with the Bearer token 
// if it exists in localStorage.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ─────────────────────────
// This interceptor runs after every response and checks for 401 Unauthorized errors.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Flask-JWT returns 401 with msg "Token has expired" or code "TOKEN_EXPIRED"
    const isExpired =
      error.response?.data?.code === "TOKEN_EXPIRED" ||
      error.response?.data?.msg === "Token has expired" ||
      error.response?.data?.message === "Token has expired";
    
    // If the token is expired and we haven't retried yet, attempt to refresh the token
    if (
      error.response?.status === 401 &&
      isExpired &&
      !originalRequest._retry
    ) {
      // Mark the request as retried to avoid infinite loops
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      // If a refresh token exists, attempt to get a new access token
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          // Store the new access token and retry the original request with it
          const newToken = res.data.access_token;
          localStorage.setItem("access_token", newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ──────────────────────────────────────────────────
export const authAPI = {
  /** Step 1: validate credentials → returns { user_id, debug_otp? } */
  login: (email, password) =>
    api.post("/api/auth/login", { email, password }),

  /** Step 2: verify OTP → returns { access_token, refresh_token, user } */
  verifyOtp: (userId, otp) =>
    api.post("/api/auth/verify-otp", { user_id: userId, otp }),

  me: () => api.get("/api/auth/me"),

  /** Update own first_name / last_name */
  updateProfile: (data) => api.patch("/api/auth/profile", data),

  /** Change own password */
  changePassword: (data) => api.post("/api/auth/change-password", data),

  logout: () => api.post("/api/auth/logout"),

  /** Public self-registration (analyst or viewer) */
  signup: (data) => api.post("/api/auth/signup", data),

  /** Admin-only: create any-role user */
  register: (data) => api.post("/api/auth/register", data),

  listUsers: () => api.get("/api/auth/users"),

  updateUser: (id, data) => api.put(`/api/auth/users/${id}`, data),

  /** Admin-only: permanently delete a user */
  deleteUser: (id) => api.delete(`/api/auth/users/${id}`),
};

// ── Assessment API ────────────────────────────────────────────
export const assessmentAPI = {
  submit: (data) => api.post("/api/assessment/submit", data),

  list: () => api.get("/api/assessment/list"),

  delete: (id) => api.delete(`/api/assessment/${id}`),
};

// ── Results API ───────────────────────────────────────────────
export const resultsAPI = {
  getResult: (id) => api.get(`/api/results/${id}`),

  /** Admin: update metadata of an existing assessment */
  updateResult: (id, data) => api.put(`/api/results/${id}`, data),

  /** Delete assessment (admin: any; analyst/viewer: own only) */
  deleteResult: (id) => api.delete(`/api/results/${id}`),

  getAll: () => api.get("/api/results/all"),

  getStats: () => api.get("/api/results/stats"),

  getAuditLog: (params) => api.get("/api/results/audit", { params }),

  /** Export assessment as a PDF report (blob response) */
  exportPdf: (id) =>
    api.get(`/api/export/assessment/${id}/pdf`, { responseType: "blob", timeout: 30000 }),

  /** Assessment history for a company name (for score trend comparison) */
  getCompanyHistory: (companyName) =>
    api.get("/api/results/company-history", { params: { company: companyName } }),
};

// ── Crypto API ────────────────────────────────────────────────
// This API is used for secure key exchange and encryption-related operations.
export const cryptoAPI = {
  getServerKey: () => api.get("/api/crypto/server-key"),

  // Exchange client public key for a session key (used for encrypting sensitive data)
  exchange: (clientPublicKey) =>
    api.post("/api/crypto/exchange", { client_public_key: clientPublicKey }),
};

// ── Health ────────────────────────────────────────────────────
export const healthCheck = () => api.get("/api/health");

export default api;
