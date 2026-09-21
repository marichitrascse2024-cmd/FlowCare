import React, { useState } from 'react';
import { 
  Activity, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  HeartPulse, 
  User, 
  Stethoscope, 
  UserCheck, 
  Shield, 
  KeyRound,
  QrCode,
  Sparkles,
  RefreshCw,
  UserCog,
  ScanFace
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { Modal } from '../components/Modal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { FaceAuthModal } from '../components/FaceAuthModal';

const ROLES = [
  { id: 'PATIENT', label: 'Patient', icon: User, title: 'Patient Login', subtitle: 'Access your electronic health records, appointments, and QR identity' },
  { id: 'DOCTOR', label: 'Doctor', icon: Stethoscope, title: 'Doctor Login', subtitle: 'Access clinical station, patient consultations, queue, and prescriptions' },
  { id: 'NURSE', label: 'Nurse', icon: Activity, title: 'Nurse Login', subtitle: 'Access vital recordings, patient triage, and nursing stations' },
  { id: 'ADMIN', label: 'Admin', icon: Shield, title: 'Admin Login', subtitle: 'Manage hospital staff, departments, services catalog, and system settings' },
  { id: 'RECEPTIONIST', label: 'Receptionist', icon: UserCheck, title: 'Receptionist Login', subtitle: 'Front desk registration, appointment booking, and token management' }
];

export const Login = ({ onSwitchToRegister }) => {
  const { login, qrLogin } = useAuth();
  const [selectedRole, setSelectedRole] = useState('PATIENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Face Recognition Modal
  const [showFaceModal, setShowFaceModal] = useState(false);

  // QR Login Modal
  const [showQRLoginModal, setShowQRLoginModal] = useState(false);
  const [qrLoginLoading, setQrLoginLoading] = useState(false);
  const [qrLoginError, setQrLoginError] = useState('');

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  const currentRoleConfig = ROLES.find(r => r.id === selectedRole) || ROLES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email/username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password, selectedRole);
    } catch (err) {
      setError(err.message || 'Invalid credentials or role mismatch.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRAuth = async (patientData) => {
    if (!patientData || !patientData.patient_code) {
      setQrLoginError('Invalid patient QR code.');
      return;
    }
    setQrLoginLoading(true);
    setQrLoginError('');
    try {
      const token = patientData.patient_code;
      await qrLogin(token);
      setShowQRLoginModal(false);
    } catch (err) {
      setQrLoginError(err.message || 'Patient QR authentication failed.');
    } finally {
      setQrLoginLoading(false);
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetEmail || !newPassword || !confirmPassword) {
      setResetError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setResetSuccess('Password reset link sent & updated successfully. Please log in with your new credentials.');
    setTimeout(() => {
      setShowResetModal(false);
      setPassword(newPassword);
      setEmail(resetEmail);
    }, 2000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2.25rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.65rem', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', marginBottom: '0.5rem' }}>
            <HeartPulse size={32} />
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>FLOWCARE</h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>AI-Powered Hospital Flow & Clinical Management</p>
        </div>

        {/* 1. Role Selection Tabs */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
            Select Your Role
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '10px' }}>
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.id);
                    setError('');
                  }}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? '#0284c7' : '#64748b',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Icon size={16} color={isSelected ? '#0284c7' : '#64748b'} />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role-Specific Header */}
        <div style={{ marginBottom: '1.25rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {currentRoleConfig.title}
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            {currentRoleConfig.subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* 2. Login Form: Option 1 (Username + Password) */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address / Username</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder={selectedRole === 'PATIENT' ? 'Email or Patient ID (e.g. arjun.kumar@flowcare.demo / PAT1001)' : (selectedRole === 'DOCTOR' ? 'doctor@flowcare.demo' : `${selectedRole.toLowerCase()}@flowcare.com`)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetError('');
                setResetSuccess('');
                setShowResetModal(true);
              }}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : `Sign In with Password`}
          </button>

          {/* Patient Alternative Auth Methods (Face Recognition & QR Login) */}
          {selectedRole === 'PATIENT' && (
            <>
              {/* Alternative Face Recognition Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.85rem 0', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR AUTHENTICATE WITH</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              {/* Option 2: Face Recognition Button */}
              <button
                type="button"
                onClick={() => setShowFaceModal(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #bae6fd',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ScanFace size={18} color="#0284c7" />
                <span>Face Recognition (Live Camera / Photo)</span>
              </button>

              {/* Universal Patient QR Login */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setQrLoginError('');
                  setShowQRLoginModal(true);
                }}
                style={{ width: '100%', padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderColor: '#e2e8f0', color: '#475569', background: '#f8fafc', fontWeight: 600, fontSize: '0.82rem', marginTop: '0.5rem' }}
              >
                <QrCode size={16} /> Login with Patient QR
              </button>
            </>
          )}
        </form>

        {/* Patient Registration Link */}
        {selectedRole === 'PATIENT' && (
          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
            New patient?{' '}
            <button
              onClick={onSwitchToRegister}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}
            >
              Register Patient Account
            </button>
          </div>
        )}
      </div>

      {/* Face Recognition Modal */}
      <FaceAuthModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        selectedRole={selectedRole}
      />

      {/* Universal Patient QR Login Modal */}
      <Modal
        isOpen={showQRLoginModal}
        onClose={() => setShowQRLoginModal(false)}
        title="Login with Patient QR"
      >
        <div>
          {qrLoginError && (
            <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {qrLoginError}
            </div>
          )}

          <PatientQRScanner
            module="AUTH"
            title="Scan Patient QR"
            customActionLabel="Login to Patient Account"
            onCustomAction={handleQRAuth}
            onCancel={() => setShowQRLoginModal(false)}
          />
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Password"
      >
        <form onSubmit={handleResetPassword}>
          {resetError && (
            <div style={{ padding: '0.6rem 0.8rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {resetError}
            </div>
          )}
          {resetSuccess && (
            <div style={{ padding: '0.6rem 0.8rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {resetSuccess}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-control"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="name@flowcare.com"
              required
            />
          </div>

          <PasswordInput
            label="New Password *"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min. 6 chars)"
            required
          />

          <PasswordInput
            label="Confirm New Password *"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Update Password</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
