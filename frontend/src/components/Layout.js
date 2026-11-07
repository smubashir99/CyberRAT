/**
 * CyberRAT — Main Layout (Sidebar + Topbar)
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 */

import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import "./Layout.css";
// Navigation items for the sidebar, including main and admin sections. Each item has a route, icon, and label.
const NAV_ITEMS = [
  { to: "/dashboard",   icon: "⬡",  label: "Dashboard"   },
  { to: "/assessment",  icon: "📋",  label: "Assessment"  },
  { to: "/results",     icon: "📊",  label: "Results"     },
  { to: "/history",     icon: "📂",  label: "History"     },
  { to: "/benchmark",  icon: "📊",  label: "Benchmark"   },
  { to: "/profile",    icon: "👤",  label: "Profile"     },
  { to: "/crypto-demo", icon: "🔐",  label: "ECDH Demo"   },
  { to: "/case-study",  icon: "☕",  label: "Café Bríd" },
];
// Admin-only navigation items for the sidebar, including user management and audit log.
const ADMIN_ITEMS = [
  { to: "/admin/users",  icon: "👥",  label: "Users"       },
  { to: "/admin/audit",  icon: "📜",  label: "Audit Log"   },
];
// Layout component renders the main layout of the application, including the sidebar and main content area. 
// It handles user authentication, navigation, and logout functionality.
export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  // Handle user logout by calling the logout function from the auth context, displaying a success toast, 
  // and navigating to the login page.
  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch {
      navigate("/login");
    }
  };
  // Determine the appropriate badge class for the user's role to display in the sidebar.
  const roleBadge = {
    admin:   "badge badge-admin",
    analyst: "badge badge-analyst",
    viewer:  "badge badge-viewer",
  }[user?.role] || "badge badge-viewer";
  // Render the layout with a collapsible sidebar containing navigation links, user information, and a logout button.
  return (
    <div className={`layout ${collapsed ? "layout--collapsed" : ""}`}>
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">🛡</span>
          {!collapsed && (
            <div>
              <div className="sidebar__title">CyberRAT</div>
              <div className="sidebar__subtitle">v2.0 — CRAF</div>
            </div>
          )}
          <button
            className="sidebar__collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
         {/* Render the main navigation links in the sidebar, highlighting the active link and displaying icons and labels.*/}
        <nav className="sidebar__nav">
          <div className="sidebar__section-label">{!collapsed && "MAIN"}</div>
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <span className="sidebar__link-icon">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
           {/* Render the admin-only navigation links in the sidebar if the user has admin privileges,
          including user management and audit log, with appropriate icons and labels.*/}
          {isAdmin && (
            <>
              <div className="sidebar__section-label">{!collapsed && "ADMIN"}</div>
              {ADMIN_ITEMS.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <span className="sidebar__link-icon">{icon}</span>
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>
         {/* Render the user information and logout button in the sidebar footer, displaying the user's initials,*/}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <div className="sidebar__user-name">
                  {user?.first_name} {user?.last_name}
                </div>
                <span className={roleBadge}>{user?.role}</span>
              </div>
            )}
          </div>
          <button
            className="sidebar__logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            {collapsed ? "⇥" : "⇥ Logout"}
          </button>
        </div>
      </aside>
   {/* ──  Render the main content area of the layout, which displays the children components passed to the Layout component.*/}
      {/* ── Main content ─────────────────────────────── */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
