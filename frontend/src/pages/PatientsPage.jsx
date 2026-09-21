import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  FileText, 
  Sparkles, 
  UserPlus, 
  HeartPulse, 
  RefreshCw, 
  QrCode,
  Camera,
  Upload,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { AISummaryModal } from '../components/AISummaryModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { PasswordInput } from '../components/PasswordInput';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { useTableState } from '../hooks/useTableState';
import { api } from '../services/api';

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'code', label: 'Patient Code' }
];

const SORT_FUNCTIONS = {
  name_asc: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
  name_desc: (a, b) => (b.full_name || '').localeCompare(a.full_name || ''),
  newest: (a, b) => (b.id || 0) - (a.id || 0),
  oldest: (a, b) => (a.id || 0) - (b.id || 0),
  code: (a, b) => (a.patient_code || '').localeCompare(b.patient_code || '')
};

const FILTER_FUNCTIONS = {
  gender: (p, val) => (p.gender || '').toLowerCase() === val.toLowerCase(),
  blood_group: (p, val) => (p.blood_group || '').toLowerCase() === val.toLowerCase(),
  allergies: (p, val) => val === 'HAS_ALLERGIES' ? Boolean(p.known_allergies && p.known_allergies.trim()) : (!p.known_allergies || !p.known_allergies.trim())
};

export const PatientsPage = () => {
  const { user } = useAuth();
  const [rawPatients, setRawPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // AI Summary Modal
  const [selectedPatientForAI, setSelectedPatientForAI] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);

  // Add Patient Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRPatientModal, setShowQRPatientModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    gender: 'Male',
    blood_group: 'O+',
    known_allergies: '',
    medical_history_notes: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    insurance_provider: '',
    insurance_policy_number: ''
  });

  // Face Recognition Enrollment State
  const [faceImage, setFaceImage] = useState(null);
  const [faceMode, setFaceMode] = useState('upload'); // 'upload' | 'camera'
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [faceError, setFaceError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.log('Video play error:', e));
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.warn('Webcam access error:', err);
      setCameraError('Camera access unavailable or hardware issue detected. Please use "Upload from Computer".');
      setFaceMode('upload');
      setCameraReady(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraReady(false);
  };

  useEffect(() => {
    if (showAddModal && faceMode === 'camera' && !faceImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showAddModal, faceMode, faceImage]);

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFaceImage(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      setFaceError('PDF files are not supported for Face Recognition. Please upload a JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      setFaceError('Please upload a valid JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    setFaceError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFaceImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    stopCamera();
    setFaceImage(null);
    setFaceError('');
    setCameraError('');
    setPasswordError('');
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      date_of_birth: '',
      gender: 'Male',
      blood_group: 'O+',
      known_allergies: '',
      medical_history_notes: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      insurance_provider: '',
      insurance_policy_number: ''
    });
  };

  const {
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedItems
  } = useTableState(rawPatients, {
    searchFields: ['full_name', 'patient_code', 'phone', 'email', 'blood_group', 'known_allergies'],
    defaultSort: 'name_asc',
    sortFunctions: SORT_FUNCTIONS,
    filterFunctions: FILTER_FUNCTIONS,
    initialPageSize: 10
  });

  const loadPatients = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
    }
    try {
      const data = await api.getPatients();
      setRawPatients(data);
    } catch (err) {
      console.error('Failed to load patients:', err);
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
    loadPatients();
  }, []);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Password validation
    if (!formData.password || formData.password.trim() === '') {
      setPasswordError('Please enter a password for the patient.');
      return;
    }

    if (formData.password.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setPasswordError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    try {
      const payload = { ...formData };
      delete payload.confirm_password;
      if (faceImage) {
        payload.face_image = faceImage;
      }
      await api.createPatient(payload);
      alert('Patient registered successfully' + (faceImage ? ' with Face Recognition enabled!' : '!'));
      handleCloseAddModal();
      await loadPatients(true);
    } catch (err) {
      alert(err.message || 'Failed to register patient.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Patient Directory & Management</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Search profiles, filter demographics, view allergy alerts, and generate AI clinical summaries</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {(user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowQRPatientModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7' }}
            >
              <QrCode size={14} /> Scan Patient QR
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadPatients(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Patients'}
          </button>
          {(user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <UserPlus size={14} /> Register New Patient
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Unified Search | Filter | Sort Toolbar */}
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, patient code, phone, email, blood group..."
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={SORT_OPTIONS}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterControls={
          <>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Gender</label>
              <select
                className="form-control"
                style={{ height: '36px', fontSize: '0.825rem' }}
                value={filters.gender || 'ALL'}
                onChange={(e) => setFilter('gender', e.target.value)}
              >
                <option value="ALL">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Blood Group</label>
              <select
                className="form-control"
                style={{ height: '36px', fontSize: '0.825rem' }}
                value={filters.blood_group || 'ALL'}
                onChange={(e) => setFilter('blood_group', e.target.value)}
              >
                <option value="ALL">All Blood Groups</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Allergy Status</label>
              <select
                className="form-control"
                style={{ height: '36px', fontSize: '0.825rem' }}
                value={filters.allergies || 'ALL'}
                onChange={(e) => setFilter('allergies', e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="HAS_ALLERGIES">Has Known Allergies</option>
                <option value="NO_ALLERGIES">No Known Allergies</option>
              </select>
            </div>
          </>
        }
      />

      {/* Patients Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Patient Code</th>
                <th>Full Name</th>
                <th>Contact Info</th>
                <th>Gender / Age</th>
                <th>Blood Group</th>
                <th>Known Allergies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={16} className="spin" /> Loading patient records...
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((p) => (
                  <tr key={p.id}>
                    <td><strong style={{ color: '#0284c7' }}>{p.patient_code}</strong></td>
                    <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                    <td>
                      <div>{p.email}</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.phone || '—'}</span>
                    </td>
                    <td>{p.gender || '—'} ({p.date_of_birth ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs` : 'N/A'})</td>
                    <td><span className="badge badge-primary">{p.blood_group || 'N/A'}</span></td>
                    <td>
                      {p.known_allergies ? (
                        <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.8rem' }}>⚠️ {p.known_allergies}</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>No known allergies</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => {
                          setSelectedPatientForAI(p);
                          setShowAIModal(true);
                        }}
                      >
                        <Sparkles size={12} color="#6366f1" /> AI Summary
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemName="patients"
        />
      </div>

      {/* AI Summary Modal */}
      {selectedPatientForAI && (
        <AISummaryModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          patientId={selectedPatientForAI.id}
          patientName={selectedPatientForAI.full_name}
        />
      )}

      {/* Add Patient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        title="Register New Hospital Patient"
        size="lg"
      >
        <form onSubmit={handleCreatePatient}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-control" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-control" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-control" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>

            <PasswordInput
              label="Patient Password *"
              name="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({...formData, password: e.target.value});
                if (passwordError) setPasswordError('');
              }}
              placeholder="Enter patient login password"
              required
            />

            <PasswordInput
              label="Confirm Password *"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={(e) => {
                setFormData({...formData, confirm_password: e.target.value});
                if (passwordError) setPasswordError('');
              }}
              placeholder="Re-enter patient password"
              required
            />

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-control" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-control" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Blood Group</label>
              <select className="form-control" value={formData.blood_group} onChange={(e) => setFormData({...formData, blood_group: e.target.value})}>
                <option value="A+">A+</option>
                <option value="B+">B+</option>
                <option value="O+">O+</option>
                <option value="AB+">AB+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Known Allergies (if any)</label>
            <input type="text" className="form-control" placeholder="e.g. Penicillin, Peanuts" value={formData.known_allergies} onChange={(e) => setFormData({...formData, known_allergies: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="form-label">Medical History</label>
            <textarea className="form-control" rows="2" value={formData.medical_history_notes} onChange={(e) => setFormData({...formData, medical_history_notes: e.target.value})}></textarea>
          </div>

          {/* Password Validation Error Banner */}
          {passwordError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{passwordError}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          {/* Face Recognition Enrollment Section */}
          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          <div style={{
            margin: '1.25rem 0',
            border: '1px solid #bae6fd',
            background: '#f0f9ff',
            borderRadius: '12px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ScanFace size={20} color="#0284c7" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0369a1' }}>
                  Face Recognition Enrollment (Optional)
                </span>
              </div>
              {faceImage && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#166534',
                  background: '#dcfce7',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <CheckCircle2 size={12} /> Face Photo Ready
                </span>
              )}
            </div>
            
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 1rem 0' }}>
              Enroll the patient's face for biometric recognition and 1-click Face Login.
            </p>

            {/* Option Tabs: 1. Live Camera | 2. Upload from Computer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', background: '#ffffff', padding: '0.3rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => {
                  setFaceMode('camera');
                  setFaceImage(null);
                  setFaceError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: faceMode === 'camera' ? '#0284c7' : 'transparent',
                  color: faceMode === 'camera' ? '#ffffff' : '#64748b',
                  fontWeight: faceMode === 'camera' ? 700 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                <Camera size={15} /> Live Camera
              </button>
              <button
                type="button"
                onClick={() => {
                  setFaceMode('upload');
                  setFaceImage(null);
                  setFaceError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: faceMode === 'upload' ? '#0284c7' : 'transparent',
                  color: faceMode === 'upload' ? '#ffffff' : '#64748b',
                  fontWeight: faceMode === 'upload' ? 700 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                <Upload size={15} /> Upload from Computer
              </button>
            </div>

            {/* Error Message */}
            {faceError && (
              <div style={{ padding: '0.65rem 0.85rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {faceError}
              </div>
            )}

            {/* Camera Error / Fallback Banner */}
            {cameraError && faceMode === 'upload' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                color: '#92400e',
                fontSize: '0.8rem',
                marginBottom: '1rem'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{cameraError}</span>
              </div>
            )}

            {/* 1. Live Camera Mode View */}
            {faceMode === 'camera' && !faceImage && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '220px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    border: '2px dashed rgba(56, 189, 248, 0.7)',
                    borderRadius: '50%',
                    width: '140px',
                    height: '180px'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px'
                  }}>
                    Align patient face within frame
                  </div>
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={!cameraReady}
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Camera size={16} /> Capture Face Photo
                </button>
              </div>
            )}

            {/* 2. Photo Upload Mode View */}
            {faceMode === 'upload' && !faceImage && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg, image/jpg, image/png, image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #0284c7',
                    borderRadius: '10px',
                    padding: '1.75rem 1rem',
                    textAlign: 'center',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={24} color="#0284c7" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                    Click to upload patient face photo from computer
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Supports JPG, JPEG, PNG, or WEBP
                  </div>
                </div>
              </div>
            )}

            {/* 3. Photo Captured / Uploaded Preview */}
            {faceImage && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '100%',
                  height: '200px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <img src={faceImage} alt="Patient Face Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFaceImage(null);
                      if (faceMode === 'camera') startCamera();
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <RefreshCw size={14} /> Retake / Choose Different Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaceImage(null)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      background: '#fff1f2',
                      color: '#e11d48',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <X size={14} /> Remove Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCloseAddModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Register Patient</button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Directory Lookup */}
      <Modal
        isOpen={showQRPatientModal}
        onClose={() => setShowQRPatientModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="RECEPTION"
          title="Scan Patient QR"
          customActionLabel="Locate & Filter in Directory"
          onCustomAction={(patientData) => {
            setSearch(patientData.patient_code);
            setShowQRPatientModal(false);
          }}
          onCancel={() => setShowQRPatientModal(false)}
        />
      </Modal>
    </div>
  );
};
