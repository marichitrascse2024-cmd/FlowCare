import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, UserCheck, UserX, Mail, Phone, Lock, Filter, KeyRound, RefreshCw } from 'lucide-react';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { PasswordInput } from '../components/PasswordInput';
import { api } from '../services/api';

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // Create User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'DOCTOR'
  });

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const data = await api.getUsers(params);
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      if (isManualRefresh) {
        setRefreshError('Unable to refresh data. Please try again.');
      }
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, search]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(userForm);
      alert('User created successfully!');
      setShowAddModal(false);
      setUserForm({ full_name: '', email: '', phone: '', password: '', role: 'DOCTOR' });
      await loadUsers(true);
    } catch (err) {
      alert(err.message || 'Failed to create user.');
    }
  };

  const handleToggleStatus = async (userObj) => {
    try {
      await api.updateUserStatus(userObj.id, userObj.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await loadUsers(true);
    } catch (err) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    try {
      await api.resetUserPassword(selectedUser.id, newPassword);
      alert(`Password updated successfully for ${selectedUser.full_name}!`);
      setShowResetModal(false);
      setNewPassword('');
    } catch (err) {
      alert(err.message || 'Failed to reset password.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>System User Administration</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Manage role-based authentication, staff accounts, and access security</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Users'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Create System Account
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Search User</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Filter by Role</label>
            <select
              className="form-control"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="DOCTOR">Doctor</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="NURSE">Nurse</option>
              <option value="PATIENT">Patient</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email / Username</th>
                <th>Phone</th>
                <th>System Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td><span className="badge badge-primary">{u.role}</span></td>
                  <td><Badge status={u.status} /></td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => {
                          setSelectedUser(u);
                          setShowResetModal(true);
                        }}
                      >
                        <KeyRound size={12} /> Reset PW
                      </button>
                      <button
                        className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.status === 'ACTIVE' ? <UserX size={12} /> : <UserCheck size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                    No users found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New System User Account"
      >
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-control"
              value={userForm.full_name}
              onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address / Login ID *</label>
            <input
              type="email"
              className="form-control"
              value={userForm.email}
              onChange={(e) => setUserForm({...userForm, email: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="text"
              className="form-control"
              value={userForm.phone}
              onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
            />
          </div>

          <PasswordInput
            label="Initial Password *"
            name="password"
            value={userForm.password}
            onChange={(e) => setUserForm({...userForm, password: e.target.value})}
            placeholder="••••••••"
            required
          />

          <div className="form-group">
            <label className="form-label">System Role *</label>
            <select
              className="form-control"
              value={userForm.role}
              onChange={(e) => setUserForm({...userForm, role: e.target.value})}
            >
              <option value="ADMIN">Administrator</option>
              <option value="DOCTOR">Doctor</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="NURSE">Nurse</option>
              <option value="PATIENT">Patient</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Account</button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title={`Reset Password for ${selectedUser?.full_name}`}
      >
        <form onSubmit={handleResetPassword}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            Enter a new password for account <strong>{selectedUser?.email}</strong>.
          </p>

          <PasswordInput
            label="New Password *"
            name="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save New Password</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
