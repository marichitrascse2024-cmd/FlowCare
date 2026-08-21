import React, { useState } from 'react';
import { 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Sparkles, 
  CheckCheck, 
  Activity,
  KeyRound,
  QrCode,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { PasswordInput } from './PasswordInput';
import { PatientQRScanner } from './PatientQRScanner';
import { api } from '../services/api';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead, refreshNotifications } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showEmergencyQRModal, setShowEmergencyQRModal] = useState(false);

  // Change Password Modal
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }

    setPwLoading(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setPwSuccess('Password changed successfully!');
      setTimeout(() => {
        setShowChangePwModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwSuccess('');
      }, 1500);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Activity size={24} color="#0ea5e9" />
        <span>FLOWCARE</span>
        <span className="brand-badge">AI Hospital OS</span>
      </div>

      <div className="navbar-actions">
        {/* Universal Patient QR Scanner Access */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowEmergencyQRModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0ea5e9', color: '#0284c7', background: '#f0f9ff', fontSize: '0.8rem', fontWeight: 700 }}
          title="Scan Patient QR"
        >
          <QrCode size={14} color="#0284c7" />
          <span>Scan Patient QR</span>
        </button>

        {/* Current Authenticated Role Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', color: '#334155' }}>
          <span>Role:</span>
          <strong style={{ color: '#0284c7' }}>{user?.role || 'User'}</strong>
        </div>

        {/* Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              position: 'relative',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '0.1rem 0.35rem',
                  lineHeight: 1
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="notification-dropdown">
              <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Notifications ({unreadCount})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    onClick={() => refreshNotifications && refreshNotifications()}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Refresh notifications"
                  >
                    <Activity size={13} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #f1f5f9',
                        background: n.is_read ? '#ffffff' : '#f0f9ff',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{n.title}</strong>
                        {!n.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', marginTop: '4px' }}></span>}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.3 }}>{n.message}</p>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', display: 'block' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Change Password Trigger */}
        <button
          onClick={() => {
            setPwError('');
            setPwSuccess('');
            setShowChangePwModal(true);
          }}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
          title="Change Password"
        >
          <KeyRound size={14} color="#0284c7" />
          <span>Security</span>
        </button>

        {/* User Profile Pill */}
        <div className="user-profile-pill">
          <div className="user-avatar">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{user?.full_name || 'User'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user?.role}</div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.45rem', borderRadius: '50%' }}
          title="Logout"
        >
          <LogOut size={16} color="#64748b" />
        </button>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePwModal}
        onClose={() => setShowChangePwModal(false)}
        title="Change Account Password"
      >
        <form onSubmit={handleChangePasswordSubmit}>
          {pwError && (
            <div style={{ padding: '0.6rem 0.8rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div style={{ padding: '0.6rem 0.8rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {pwSuccess}
            </div>
          )}

          <PasswordInput
            label="Current Password *"
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            required
          />

          <PasswordInput
            label="New Password *"
            name="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min. 6 chars)"
            required
          />

          <PasswordInput
            label="Confirm New Password *"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowChangePwModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pwLoading}>
              {pwLoading ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal */}
      <Modal
        isOpen={showEmergencyQRModal}
        onClose={() => setShowEmergencyQRModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="EMERGENCY"
          title="Scan Patient QR"
          onCancel={() => setShowEmergencyQRModal(false)}
        />
      </Modal>
    </nav>
  );
};
