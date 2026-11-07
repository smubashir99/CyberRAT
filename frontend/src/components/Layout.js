/**
 * CyberRAT v2 — Main Layout (Sidebar + Topbar)
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 */

import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import "./Layout.css";

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

const ADMIN_ITEMS = [
  { to: "/admin/users",  icon: "👥",  label: "Users"       },
  { to: "/admin/audit",  icon: "📜",  label: "Audit Log"   },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch {
      navigate("/login");
    }
  };

  const roleBadge = {
    admin:   "badge badge-admin",
    analyst: "badge badge-analyst",
    viewer:  "badge badge-viewer",
  }[user?.role] || "badge badge-viewer";

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

      {/* ── Main content ─────────────────────────────── */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
