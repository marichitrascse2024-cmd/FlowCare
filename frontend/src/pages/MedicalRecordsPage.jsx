import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Plus, Search, Calendar, HeartPulse, Activity, ChevronRight, User, RefreshCw, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { AISummaryModal } from '../components/AISummaryModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { Badge } from '../components/Badge';
import { api } from '../services/api';

export const MedicalRecordsPage = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(user?.patient_id || '');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // Selected Record View Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  // AI Summary Modal
  const [showAIModal, setShowAIModal] = useState(false);

  // New Record Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRRecordModal, setShowQRRecordModal] = useState(false);
  const [newRecordForm, setNewRecordForm] = useState({
    patient_id: '',
    symptoms: '',
    diagnosis: '',
    chief_complaint: '',
    doctor_notes: '',
    treatment_plan: '',
    blood_pressure: '120/80',
    heart_rate: 72,
    temperature: 98.6,
    oxygen_saturation: 98,
    weight_kg: 70
  });

  const loadPatients = async () => {
    if (user?.role !== 'PATIENT') {
      try {
        const pats = await api.getPatients();
        setPatients(pats);
        if (pats.length > 0 && !selectedPatientId) {
          setSelectedPatientId(pats[0].id);
        }
      } catch (err) {
        console.error('Failed to load patients for records:', err);
      }
    } else {
      setSelectedPatientId(user.patient_id);
    }
  };

  const loadRecords = async (isManualRefresh = false) => {
    if (!selectedPatientId) return;
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
    }
    try {
      const recs = await api.getPatientMedicalRecords(selectedPatientId);
      setRecords(recs);
    } catch (err) {
      console.error('Failed to load medical records:', err);
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
  }, [user]);

  useEffect(() => {
    if (selectedPatientId) {
      loadRecords();
    }
  }, [selectedPatientId]);

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    try {
      await api.createMedicalRecord({
        ...newRecordForm,
        patient_id: parseInt(newRecordForm.patient_id || selectedPatientId),
        heart_rate: parseInt(newRecordForm.heart_rate),
        temperature: parseFloat(newRecordForm.temperature),
        oxygen_saturation: parseInt(newRecordForm.oxygen_saturation),
        weight_kg: parseFloat(newRecordForm.weight_kg)
      });
      alert('Medical record created successfully!');
      setShowAddModal(false);
      await loadRecords(true);
    } catch (err) {
      alert(err.message || 'Failed to create record.');
    }
  };

  const selectedPatientObj = patients.find(p => p.id === parseInt(selectedPatientId));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Electronic Health Records (EHR)</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Clinical visit notes, vital measurements, lab reports, and AI diagnostic insights</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {user?.role !== 'PATIENT' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowQRRecordModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7' }}
            >
              <QrCode size={14} /> Scan Patient QR
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadRecords(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Records'}
          </button>
          {selectedPatientId && (
            <button className="btn btn-ai btn-sm" onClick={() => setShowAIModal(true)}>
              <Sparkles size={14} /> AI Clinical Summary
            </button>
          )}
          {user?.role !== 'PATIENT' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> New Consultation Note
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Patient Selector for Medical Staff */}
      {user?.role !== 'PATIENT' && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Select Patient Case:</label>
            <select
              className="form-control"
              style={{ maxWidth: '340px' }}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_code}) — {p.blood_group || 'No blood group'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Timeline of Records */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {records.map((r) => (
          <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.record_number}</span>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{r.diagnosis || 'General Consultation'}</h4>
                </div>
                <span className="badge badge-primary">
                  {new Date(r.visit_date).toLocaleDateString()}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
                <strong>Attending:</strong> {r.doctor_name} ({r.doctor_specialization || 'Attending Physician'})
              </div>

              <p style={{ fontSize: '0.825rem', color: '#334155', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <strong>Chief Complaint:</strong> {r.chief_complaint || 'Routine review'}
              </p>

              {/* Vitals Ribbon */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', background: '#f0f9ff', padding: '0.6rem', borderRadius: '6px', fontSize: '0.75rem', color: '#0369a1', marginBottom: '1rem', textAlign: 'center' }}>
                <div>
                  <div style={{ color: '#64748b' }}>BP</div>
                  <strong>{r.blood_pressure || '—'}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>HR</div>
                  <strong>{r.heart_rate ? `${r.heart_rate} bpm` : '—'}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>SpO2</div>
                  <strong>{r.oxygen_saturation ? `${r.oxygen_saturation}%` : '—'}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Temp</div>
                  <strong>{r.temperature ? `${r.temperature}°F` : '—'}</strong>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedRecord(r)}
              >
                View Full Consultation Details <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {records.length === 0 && !loading && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1.5rem', color: '#94a3b8' }}>
            <FileText size={44} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ color: '#475569', fontWeight: 600 }}>No medical records on file</h4>
            <p style={{ fontSize: '0.85rem' }}>There are no consultation notes or verified visits for this patient.</p>
          </div>
        )}
      </div>

      {/* Record View Modal */}
      {selectedRecord && (
        <Modal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title={`Consultation Note: ${selectedRecord.record_number}`}
          size="lg"
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedRecord.patient_name}</h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Doctor: {selectedRecord.doctor_name} ({selectedRecord.doctor_specialization})</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-primary">{new Date(selectedRecord.visit_date).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
              <div>
                <strong style={{ color: '#0f172a' }}>Chief Complaint & Symptoms:</strong>
                <p style={{ color: '#334155', marginTop: '0.2rem' }}>{selectedRecord.chief_complaint || selectedRecord.symptoms || 'None recorded'}</p>
              </div>

              <div>
                <strong style={{ color: '#0f172a' }}>Clinical Diagnosis:</strong>
                <p style={{ color: '#0369a1', fontWeight: 600, marginTop: '0.2rem' }}>{selectedRecord.diagnosis}</p>
              </div>

              <div>
                <strong style={{ color: '#0f172a' }}>Physician Clinical Notes:</strong>
                <p style={{ color: '#334155', marginTop: '0.2rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>{selectedRecord.doctor_notes || 'None'}</p>
              </div>

              <div>
                <strong style={{ color: '#0f172a' }}>Treatment Plan & Advice:</strong>
                <p style={{ color: '#334155', marginTop: '0.2rem' }}>{selectedRecord.treatment_plan || 'Standard observation'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRecord(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* AI Summary Modal */}
      {selectedPatientId && (
        <AISummaryModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          patientId={selectedPatientId}
          patientName={selectedPatientObj?.full_name || 'Patient'}
        />
      )}

      {/* Add Record Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Clinical Consultation Note"
        size="lg"
      >
        <form onSubmit={handleCreateRecord}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Patient *</label>
              <select
                className="form-control"
                value={newRecordForm.patient_id || selectedPatientId}
                onChange={(e) => setNewRecordForm({...newRecordForm, patient_id: e.target.value})}
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.patient_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Clinical Diagnosis *</label>
              <input type="text" className="form-control" placeholder="e.g. Essential Hypertension, Acute Bronchitis" value={newRecordForm.diagnosis} onChange={(e) => setNewRecordForm({...newRecordForm, diagnosis: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Chief Complaint</label>
              <input type="text" className="form-control" value={newRecordForm.chief_complaint} onChange={(e) => setNewRecordForm({...newRecordForm, chief_complaint: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Symptoms</label>
              <input type="text" className="form-control" value={newRecordForm.symptoms} onChange={(e) => setNewRecordForm({...newRecordForm, symptoms: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Blood Pressure</label>
              <input type="text" className="form-control" placeholder="120/80" value={newRecordForm.blood_pressure} onChange={(e) => setNewRecordForm({...newRecordForm, blood_pressure: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Heart Rate (bpm)</label>
              <input type="number" className="form-control" value={newRecordForm.heart_rate} onChange={(e) => setNewRecordForm({...newRecordForm, heart_rate: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Physician Notes</label>
            <textarea className="form-control" rows="2" value={newRecordForm.doctor_notes} onChange={(e) => setNewRecordForm({...newRecordForm, doctor_notes: e.target.value})}></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Treatment Plan</label>
            <textarea className="form-control" rows="2" value={newRecordForm.treatment_plan} onChange={(e) => setNewRecordForm({...newRecordForm, treatment_plan: e.target.value})}></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Consultation Record</button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Medical Records */}
      <Modal
        isOpen={showQRRecordModal}
        onClose={() => setShowQRRecordModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="MEDICAL_RECORDS"
          title="Scan Patient QR"
          customActionLabel="Load & View Patient Records"
          onCustomAction={(patientData) => {
            setSelectedPatientId(patientData.patient_id);
            setShowQRRecordModal(false);
          }}
          onCancel={() => setShowQRRecordModal(false)}
        />
      </Modal>
    </div>
  );
};
