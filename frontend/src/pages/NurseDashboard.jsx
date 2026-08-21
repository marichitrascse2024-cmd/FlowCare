import React, { useState, useEffect } from 'react';
import { Activity, Clock, HeartPulse, UserCheck, CheckCircle2, FileText, Sparkles, RefreshCw } from 'lucide-react';
import { DashboardCard } from '../components/DashboardCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { AISummaryModal } from '../components/AISummaryModal';
import { api } from '../services/api';

export const NurseDashboard = ({ onNavigate }) => {
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [selectedPatientForAI, setSelectedPatientForAI] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);

  // Vitals recording modal
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [vitals, setVitals] = useState({
    blood_pressure: '120/80',
    heart_rate: 72,
    temperature: 98.6,
    oxygen_saturation: 98,
    weight_kg: 70
  });

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const [queueData, patData] = await Promise.all([
        api.getQueue(),
        api.getPatients()
      ]);
      setQueue(queueData);
      setPatients(patData);
    } catch (err) {
      console.error('Failed to load nurse station:', err);
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
    loadData();
    const interval = setInterval(() => loadData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenVitals = (entry) => {
    setSelectedEntry(entry);
    setShowVitalsModal(true);
  };

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    if (!selectedEntry) return;
    try {
      await api.createMedicalRecord({
        patient_id: selectedEntry.patient_id,
        appointment_id: selectedEntry.appointment_id,
        symptoms: 'Nurse Vitals & Triage Intake',
        diagnosis: 'Vitals Checked & Recorded for Attending Physician',
        chief_complaint: 'Pre-consultation vital assessment',
        doctor_notes: 'Triage vitals recorded by nurse on duty.',
        treatment_plan: 'Awaiting physician clinical review.',
        blood_pressure: vitals.blood_pressure,
        heart_rate: parseInt(vitals.heart_rate),
        temperature: parseFloat(vitals.temperature),
        oxygen_saturation: parseInt(vitals.oxygen_saturation),
        weight_kg: parseFloat(vitals.weight_kg)
      });
      alert('Patient vitals recorded successfully!');
      setShowVitalsModal(false);
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to record vitals.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Nurse & Triage Station</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Vital signs intake, allergy verification, and triage priority escalation</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Station'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('queue')}>
            <Activity size={14} /> View Queue Board
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <DashboardCard
          title="Patients Awaiting Vitals"
          value={queue.filter(q => q.status === 'WAITING').length}
          subtitle="In triage queue"
          icon={HeartPulse}
          color="primary"
        />
        <DashboardCard
          title="Urgent Cases"
          value={queue.filter(q => q.priority === 'URGENT' || q.priority === 'EMERGENCY').length}
          subtitle="Triage priority flags"
          icon={Activity}
          color="danger"
        />
        <DashboardCard
          title="Inside Consultation"
          value={queue.filter(q => q.status === 'IN_CONSULTATION').length}
          subtitle="With attending physician"
          icon={UserCheck}
          color="success"
        />
        <DashboardCard
          title="Total Registered Patients"
          value={patients.length}
          subtitle="Active profiles"
          icon={FileText}
          color="info"
        />
      </div>

      {/* Live Queue Table for Nurse Intake */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <HeartPulse size={18} color="#0284c7" />
            Triage & Vital Signs Queue
          </h3>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Doctor & Dept</th>
                <th>Priority</th>
                <th>Position</th>
                <th>Status</th>
                <th>Nurse Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id}>
                  <td><strong style={{ color: '#0284c7', fontSize: '1.05rem' }}>{q.token_number}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.patient_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{q.patient_code}</span>
                  </td>
                  <td>
                    <div>{q.doctor_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{q.department || q.doctor_specialization}</span>
                  </td>
                  <td><Badge status={q.priority} /></td>
                  <td>#{q.queue_position}</td>
                  <td><Badge status={q.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => handleOpenVitals(q)}
                      >
                        <HeartPulse size={12} /> Record Vitals
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => {
                          setSelectedPatientForAI({ id: q.patient_id, name: q.patient_name });
                          setShowAIModal(true);
                        }}
                      >
                        <Sparkles size={12} color="#6366f1" /> AI Summary
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    No patients currently waiting in triage queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Vitals Modal */}
      <Modal
        isOpen={showVitalsModal}
        onClose={() => setShowVitalsModal(false)}
        title={`Record Vitals: ${selectedEntry?.patient_name} (${selectedEntry?.token_number})`}
      >
        <form onSubmit={handleSaveVitals}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Blood Pressure (mmHg) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="120/80"
                value={vitals.blood_pressure}
                onChange={(e) => setVitals({...vitals, blood_pressure: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Heart Rate (bpm) *</label>
              <input
                type="number"
                className="form-control"
                placeholder="72"
                value={vitals.heart_rate}
                onChange={(e) => setVitals({...vitals, heart_rate: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Body Temperature (°F) *</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                placeholder="98.6"
                value={vitals.temperature}
                onChange={(e) => setVitals({...vitals, temperature: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Oxygen Saturation (%) *</label>
              <input
                type="number"
                className="form-control"
                placeholder="98"
                value={vitals.oxygen_saturation}
                onChange={(e) => setVitals({...vitals, oxygen_saturation: e.target.value})}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                placeholder="70"
                value={vitals.weight_kg}
                onChange={(e) => setVitals({...vitals, weight_kg: e.target.value})}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowVitalsModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Vitals to Medical Record</button>
          </div>
        </form>
      </Modal>

      {/* AI Summary Modal */}
      {selectedPatientForAI && (
        <AISummaryModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          patientId={selectedPatientForAI.id}
          patientName={selectedPatientForAI.name}
        />
      )}
    </div>
  );
};
