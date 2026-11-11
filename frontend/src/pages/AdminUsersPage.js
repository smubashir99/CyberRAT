/**
 * CyberRAT — Admin: User Management Page
 * Author: Syed Mubashir Ahmed Hashmi (20089221)
 *
 * Admin-only: list all users, change roles, activate/deactivate accounts.
 * Uses PUT /api/auth/users/:id
 */

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./AdminUsersPage.css";
// Roles available in the system
const ROLES = ["admin", "analyst", "viewer"];

export default function AdminUsersPage() {
  const { user: me }              = useAuth();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(null);   // id of user being saved
  const [deleting,  setDeleting]  = useState(null);   // id of user being deleted
  const [confirmId, setConfirmId] = useState(null);   // id awaiting delete confirm
  // Load users from the API
  const loadUsers = () => {
    setLoading(true);
    authAPI.listUsers()
      .then((r)  => setUsers(r.data.users || []))
      .catch(()  => toast.error("Failed to load users."))
      .finally(() => setLoading(false));
  };
  // Load users on mount
  useEffect(loadUsers, []);
  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    if (userId === me?.id) { toast.error("Cannot change your own role."); return; }
    setSaving(userId);
    try {
      await authAPI.updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("Role updated.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update role.");
    } finally {
      setSaving(null);
    }
  };
  // Handle user deletion
  const handleDelete = async (userId) => {
    setConfirmId(null);
    setDeleting(userId);
    try {
      await authAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User permanently deleted.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to delete user.");
    } finally {
      setDeleting(null);
    }
  };
  // Handle account activation/deactivation
  const handleStatusToggle = async (userId, currentStatus) => {
    if (userId === me?.id) { toast.error("Cannot deactivate your own account."); return; }
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    setSaving(userId);
    try {
      await authAPI.updateUser(userId, { status: newStatus });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
      toast.success(`Account ${newStatus === "active" ? "activated" : "suspended"}.`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update status.");
    } finally {
      setSaving(null);
    }
  };
  // Render the page
  return (
    <div className="page">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            Role-Based Access Control — {users.length} user(s) in the system
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadUsers}>↻ Refresh</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="page-loader"><div className="spinner" /> Loading users…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Failed Logins</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <div>
                          <strong>{u.first_name} {u.last_name}</strong>
                          {u.id === me?.id && <span className="you-badge">You</span>}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={saving === u.id || u.id === me?.id}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.status === "active" ? "badge-low" : "badge-critical"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <span className={u.failed_login_attempts > 0 ? "text-warning" : "text-muted"}>
                        {u.failed_login_attempts}
                      </span>
                    </td>
                    <td className="text-muted">
                      {new Date(u.created_at).toLocaleDateString("en-IE")}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className={`btn btn-sm ${u.status === "active" ? "btn-warning" : "btn-success"}`}
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          disabled={saving === u.id || u.id === me?.id}
                          title={u.status === "active" ? "Suspend account" : "Activate account"}
                        >
                          {saving === u.id ? (
                            <div className="spinner" style={{ width: 12, height: 12 }} />
                          ) : (
                            u.status === "active" ? "Suspend" : "Activate"
                          )}
                        </button>

                        {/* Delete — disabled for own account */}
                        {u.id !== me?.id && (
                          confirmId === u.id ? (
                            <span className="confirm-delete-inline">
                              Delete?&nbsp;
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(u.id)}
                                disabled={deleting === u.id}
                              >
                                {deleting === u.id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "Yes"}
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setConfirmId(null)}
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => setConfirmId(u.id)}
                              title="Permanently delete user"
                            >
                              🗑 Delete
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RBAC explanation */}
      <div className="card rbac-info">
        <h3 className="dash-section-title">Role Permissions</h3>
        <div className="rbac-grid">
          <div className="rbac-role">
            <span className="badge badge-admin">Admin</span>
            <ul>
              <li>Full system access</li>
              <li>Create and manage users</li>
              <li>View all assessments</li>
              <li>Access audit logs</li>
              <li>View aggregate statistics</li>
            </ul>
          </div>
          <div className="rbac-role">
            <span className="badge badge-analyst">Analyst</span>
            <ul>
              <li>Submit new assessments</li>
              <li>View own results</li>
              <li>Access ECDH demo</li>
            </ul>
          </div>
          <div className="rbac-role">
            <span className="badge badge-viewer">Viewer</span>
            <ul>
              <li>View own assessments (read-only)</li>
              <li>Cannot submit assessments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
