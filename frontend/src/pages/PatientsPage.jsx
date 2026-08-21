import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Mail, FileText, Sparkles, UserPlus, HeartPulse, RefreshCw, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { AISummaryModal } from '../components/AISummaryModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { PasswordInput } from '../components/PasswordInput';
import { api } from '../services/api';

export const PatientsPage = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // AI Summary Modal
  const [selectedPatientForAI, setSelectedPatientForAI] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);

  // Add Patient Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRPatientModal, setShowQRPatientModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'Patient@123',
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

  const loadPatients = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const data = await api.getPatients(search);
      setPatients(data);
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
  }, [search]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      await api.createPatient(formData);
      alert('Patient registered successfully!');
      setShowAddModal(false);
      await loadPatients(true);
    } catch (err) {
      alert(err.message || 'Failed to register patient.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Patient Directory & Management</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Search profiles, view allergy alerts, and generate AI clinical summaries</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {user?.role !== 'PATIENT' && (
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
          {user?.role !== 'PATIENT' && (
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

      {/* Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search by name, patient code, phone, or blood group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="card">
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
              {patients.map((p) => (
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
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        onClose={() => setShowAddModal(false)}
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
              label="Portal Password *"
              name="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
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
