/**
 * CyberRAT — React Router + Protected Routes
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Route structure:
 *   /              → redirect to /dashboard
 *   /login         → LoginPage (public)
 *   /dashboard     → DashboardPage  (auth required)
 *   /assessment    → AssessmentPage (Analyst or Admin)
 *   /results       → ResultsPage list (auth required)
 *   /results/:id   → ResultsPage detail (auth required)
 *   /history       → HistoryPage — all past assessments with filter/sort (auth required)
 *   /benchmark     → BenchmarkPage — score vs Irish SME sector averages (auth required)
 *   /profile       → ProfilePage — update name and change password (auth required)
 *   /crypto-demo   → CryptoDemoPage (auth required)
 *   /case-study    → InsomniaCasePage — Café Bríd hypothetical case study A001/A002/A003 (auth required)
 *   /admin/users   → AdminUsersPage (Admin only)
 *   /admin/audit   → AdminAuditPage (Admin only)
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";

/* ── Pages ── */
import LoginPage          from "./pages/LoginPage";
import SignupPage         from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage  from "./pages/ResetPasswordPage";
import DashboardPage      from "./pages/DashboardPage";
import AssessmentPage     from "./pages/AssessmentPage";
import ResultsPage        from "./pages/ResultsPage";
import CryptoDemoPage     from "./pages/CryptoDemoPage";
import InsomniaCasePage   from "./pages/InsomniaCasePage";
import AdminUsersPage     from "./pages/AdminUsersPage";
import AdminAuditPage     from "./pages/AdminAuditPage";
import HistoryPage        from "./pages/HistoryPage";
import BenchmarkPage      from "./pages/BenchmarkPage";
import ProfilePage        from "./pages/ProfilePage";

/* ────────────────────────────────────────────────────────────── */
/*  Guard components                                               */
/* ────────────────────────────────────────────────────────────── */

/** Redirect to /login if not authenticated */
// If authenticated, render the Layout component with the child routes (Outlet).
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, color: "#8b949e" }}>
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/** Redirect to /dashboard if not admin */
// If authenticated and admin, render the child routes (Outlet).
function RequireAdmin() {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Redirect to /dashboard if not analyst or admin */
// If authenticated and analyst or admin, render the child routes (Outlet).
function RequireAnalyst() {
  const { user, isAnalyst } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAnalyst) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/* ────────────────────────────────────────────────────────────── */
/*  App                                                            */
/* ────────────────────────────────────────────────────────────── */

// Define the main application routes using React Router, including public routes (login, signup, forgot/reset password) 
// and authenticated routes (dashboard, assessment, results, history, benchmark, profile, crypto demo, case study). 
// Admin-only and analyst/admin routes are protected with guard components.
function AppRoutes() {
  const { user } = useAuth();
  // Render the routes using React Router's Routes and Route components, with appropriate guards for authentication and 
  // role-based access control.
  return (
    <Routes>
      {/* ── Public ── */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* ── Authenticated ── */}
      {/* All routes below require authentication, enforced by the RequireAuth guard component.*/}
      <Route element={<RequireAuth />}>
        <Route path="/"           element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/results"     element={<ResultsPage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/history"     element={<HistoryPage />} />
        <Route path="/benchmark"   element={<BenchmarkPage />} />
        <Route path="/profile"     element={<ProfilePage />} />
        <Route path="/crypto-demo"  element={<CryptoDemoPage />} />
        <Route path="/case-study"   element={<InsomniaCasePage />} />
      
       { /* The assessment route is protected by the RequireAnalyst guard component, allowing access only to users with analyst
         or admin roles.*/}
        {/* Analyst + Admin */}
        
        <Route element={<RequireAnalyst />}>
          <Route path="/assessment" element={<AssessmentPage />} />
        </Route>

        {/* Admin only */}
        <Route element={<RequireAdmin />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#21262d",
              color:      "#e6edf3",
              border:     "1px solid #30363d",
              fontSize:   "13px",
            },
            success: { iconTheme: { primary: "#3fb950", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#f85149", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
