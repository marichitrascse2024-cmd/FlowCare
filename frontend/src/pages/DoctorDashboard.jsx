import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  UserCheck, 
  AlertTriangle,
  ClipboardList,
  Plus,
  RefreshCw,
  QrCode,
  HeartPulse,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardCard } from '../components/DashboardCard';
import { Badge } from '../components/Badge';
import { AISummaryModal } from '../components/AISummaryModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import RiskAssessmentModal from '../components/RiskAssessmentModal';
import { Modal } from '../components/Modal';
import { api } from '../services/api';

export const DoctorDashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activeConsultation, setActiveConsultation] = useState(null);
  const [selectedPatientForAI, setSelectedPatientForAI] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [targetPatientForRisk, setTargetPatientForRisk] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  // Consultation Record Modal
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({
    symptoms: '',
    diagnosis: '',
    chief_complaint: '',
    doctor_notes: '',
    treatment_plan: '',
    blood_pressure: '120/80',
    heart_rate: 72,
    temperature: 98.6,
    oxygen_saturation: 98
  });

  const loadDoctorData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const [queueData, apptsData] = await Promise.all([
        api.getQueue(),
        api.getAppointments({ appointment_date: new Date().toISOString().split('T')[0] })
      ]);
      setQueue(queueData);
      setAppointments(apptsData);
      const active = queueData.find(q => q.status === 'IN_CONSULTATION');
      setActiveConsultation(active || null);
    } catch (err) {
      console.error('Failed to load doctor dashboard:', err);
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
    loadDoctorData();
    const interval = setInterval(() => loadDoctorData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdvanceQueue = async () => {
    if (!user?.doctor_id) return;
    setAdvancing(true);
    try {
      await api.advanceQueue(user.doctor_id);
      await loadDoctorData(true);
    } catch (err) {
      alert(err.message || 'Failed to advance queue.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleOpenAISummary = (patientId, patientName) => {
    setSelectedPatientForAI({ id: patientId, name: patientName });
    setShowAIModal(true);
  };

  const handleOpenRiskAssessment = (patientId, patientName) => {
    setTargetPatientForRisk({ id: patientId, name: patientName });
    setShowRiskModal(true);
  };

  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!activeConsultation) return;
    try {
      await api.createMedicalRecord({
        patient_id: activeConsultation.patient_id,
        appointment_id: activeConsultation.appointment_id,
        ...consultForm
      });
      alert('Consultation record encrypted & saved successfully with AES-256-GCM + RSA-2048 hybrid protection!');
      setShowConsultModal(false);
      // Auto-advance to next patient
      handleAdvanceQueue();
    } catch (err) {
      alert(err.message || 'Failed to save medical record.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Doctor Clinical Station</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Welcome, <strong>{user?.full_name}</strong> • Department: <strong style={{ color: '#0284c7' }}>{user?.doctor_specialization || user?.department || 'Specialist'}</strong> • Doctor ID: <strong style={{ color: '#0f172a' }}>{user?.doctor_code || `DOC${user?.doctor_id}`}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setShowQRScanner(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0d9488', color: '#0d9488' }}
          >
            <QrCode size={14} /> Scan Patient QR
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const pid = activeConsultation?.patient_id || (queue[0]?.patient_id);
              const pname = activeConsultation?.patient_name || (queue[0]?.patient_name);
              handleOpenRiskAssessment(pid, pname);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            <HeartPulse size={14} /> AI Disease Risk
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadDoctorData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Station'}
          </button>
          <button 
            className="btn btn-ai btn-sm"
            onClick={() => {
              if (activeConsultation) {
                handleOpenAISummary(activeConsultation.patient_id, activeConsultation.patient_name);
              } else if (queue.length > 0) {
                handleOpenAISummary(queue[0].patient_id, queue[0].patient_name);
              } else {
                alert('No patients in queue to summarize.');
              }
            }}
          >
            <Sparkles size={14} /> AI Medical Summarizer
          </button>
          <button 
            className="btn btn-success btn-sm"
            onClick={handleAdvanceQueue}
            disabled={advancing}
          >
            <UserCheck size={14} /> {advancing ? 'Calling...' : 'Call Next Patient'}
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Active Patient In Consultation Card */}
      {activeConsultation ? (
        <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff, #f0fdf4)', borderColor: '#bbf7d0', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }}></span>
                CURRENTLY IN CONSULTATION
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                {activeConsultation.patient_name} <span style={{ color: '#0284c7', fontSize: '1.25rem' }}>[{activeConsultation.token_number}]</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#475569' }}>
                Patient Code: <strong>{activeConsultation.patient_code}</strong> • Room: <strong>{activeConsultation.room_number || 'Room 101'}</strong> • Priority: <Badge status={activeConsultation.priority} />
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenAISummary(activeConsultation.patient_id, activeConsultation.patient_name)}
              >
                <Sparkles size={14} /> AI History Summary
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenRiskAssessment(activeConsultation.patient_id, activeConsultation.patient_name)}
                style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
              >
                <HeartPulse size={14} /> Assess Disease Risk
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowConsultModal(true)}
              >
                <FileText size={14} /> Complete Consultation (Hybrid Encrypted)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ background: '#f8fafc', borderColor: '#e2e8f0', marginBottom: '2rem', textAlign: 'center', padding: '2rem' }}>
          <UserCheck size={36} color="#64748b" style={{ margin: '0 auto 0.5rem auto' }} />
          <h4 style={{ color: '#0f172a', fontWeight: 700 }}>No Active Consultation in Progress</h4>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {queue.length > 0 ? `There are ${queue.length} patient(s) waiting in your department queue.` : 'No patients currently waiting in your queue.'}
          </p>
          {queue.length > 0 && (
            <button className="btn btn-success" onClick={handleAdvanceQueue} disabled={advancing}>
              <UserCheck size={16} /> Call Next Patient ({queue[0].token_number} - {queue[0].patient_name})
            </button>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <DashboardCard
          title="Patients in Queue"
          value={queue.filter(q => q.status === 'WAITING' || q.status === 'CALLED').length}
          subtitle="Waiting for consultation"
          icon={Users}
          color="warning"
        />
        <DashboardCard
          title="Assigned Appointments"
          value={appointments.length}
          subtitle="Scheduled for today"
          icon={Calendar}
          color="primary"
        />
        <DashboardCard
          title="Avg Consultation Time"
          value="15 mins"
          subtitle="AI queue calibration"
          icon={Clock}
          color="info"
        />
        <DashboardCard
          title="Data Security Tier"
          value="AES-256 + RSA"
          subtitle="Hybrid Cryptography Active"
          icon={ShieldCheck}
          color="success"
        />
      </div>

      {/* Main Grid: Live Assigned Queue + Appointments Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Live Queue Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Users size={18} color="#0284c7" />
              Live Assigned Queue Lineup
            </h3>
            <span className="badge badge-primary">{queue.length} Total</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Priority</th>
                  <th>Est. Wait</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id} style={q.status === 'IN_CONSULTATION' ? { background: '#f0fdf4', fontWeight: 600 } : {}}>
                    <td><strong style={{ color: '#0284c7' }}>{q.token_number}</strong></td>
                    <td>
                      <div>{q.patient_name}</div>
                      <small style={{ color: '#64748b' }}>{q.patient_code}</small>
                    </td>
                    <td><Badge status={q.priority} /></td>
                    <td>{q.status === 'IN_CONSULTATION' ? 'Inside' : `~${q.estimated_wait_time ?? q.estimated_wait_minutes} min`}</td>
                    <td><Badge status={q.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button 
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.25rem 0.5rem' }}
                          title="AI Summary"
                          onClick={() => handleOpenAISummary(q.patient_id, q.patient_name)}
                        >
                          <Sparkles size={13} />
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.25rem 0.5rem', borderColor: '#7c3aed', color: '#7c3aed' }}
                          title="AI Disease Risk"
                          onClick={() => handleOpenRiskAssessment(q.patient_id, q.patient_name)}
                        >
                          <HeartPulse size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      No patients in queue for your department today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assigned Appointments Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Calendar size={18} color="#10b981" />
              Today's Assigned Appointments
            </h3>
            <span className="badge badge-success">{appointments.length} Booked</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time Slot</th>
                  <th>Patient</th>
                  <th>Complaint</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.time_slot}</strong></td>
                    <td>
                      <div>{a.patient_name}</div>
                      <small style={{ color: '#64748b' }}>{a.patient_code}</small>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {a.chief_complaint || 'Routine consultation'}
                    </td>
                    <td><Badge status={a.status} /></td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      No assigned appointments scheduled for today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Summary Modal */}
      <AISummaryModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        patientId={selectedPatientForAI?.id}
        patientName={selectedPatientForAI?.name}
      />

      {/* AI Disease Risk Modal */}
      <RiskAssessmentModal
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        initialPatientId={targetPatientForRisk?.id}
        initialPatientName={targetPatientForRisk?.name}
      />

      {/* Consultation Record Modal */}
      <Modal
        isOpen={showConsultModal}
        onClose={() => setShowConsultModal(false)}
        title={`Record Consultation (Hybrid AES-256-GCM + RSA Protected) — ${activeConsultation?.patient_name}`}
      >
        <form onSubmit={handleSaveConsultation}>
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '0.65rem 0.85rem',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Lock size={16} />
            <span><strong>Hybrid Encryption Notice:</strong> Clinical diagnoses, notes, and treatment plans are encrypted using AES-256-GCM and enveloped with RSA-2048 keys.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Chief Complaint</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Chest pain and dyspnea on walking"
              value={consultForm.chief_complaint}
              onChange={(e) => setConsultForm({ ...consultForm, chief_complaint: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Symptoms *</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Detailed symptom history..."
              value={consultForm.symptoms}
              onChange={(e) => setConsultForm({ ...consultForm, symptoms: e.target.value })}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Diagnosis *</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Clinical diagnosis & ICD-11 classification..."
              value={consultForm.diagnosis}
              onChange={(e) => setConsultForm({ ...consultForm, diagnosis: e.target.value })}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Treatment Plan & Prescription</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Medications, dosage, diet, and clinical guidance..."
              value={consultForm.treatment_plan}
              onChange={(e) => setConsultForm({ ...consultForm, treatment_plan: e.target.value })}
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Doctor Clinical Notes</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Observations and confidential physician remarks..."
              value={consultForm.doctor_notes}
              onChange={(e) => setConsultForm({ ...consultForm, doctor_notes: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>BP</label>
              <input
                type="text"
                className="form-control"
                value={consultForm.blood_pressure}
                onChange={(e) => setConsultForm({ ...consultForm, blood_pressure: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Pulse (bpm)</label>
              <input
                type="number"
                className="form-control"
                value={consultForm.heart_rate}
                onChange={(e) => setConsultForm({ ...consultForm, heart_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={consultForm.temperature}
                onChange={(e) => setConsultForm({ ...consultForm, temperature: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>SpO2 (%)</label>
              <input
                type="number"
                className="form-control"
                value={consultForm.oxygen_saturation}
                onChange={(e) => setConsultForm({ ...consultForm, oxygen_saturation: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowConsultModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Encrypt & Save Record</button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Doctors */}
      <Modal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="DOCTOR"
          title="Scan Patient QR"
          customActionLabel="Open Consultation Desk"
          onCustomAction={(patientData) => {
            setShowQRScanner(false);
            setConsultForm(prev => ({
              ...prev,
              symptoms: patientData.known_allergies ? `Allergies: ${patientData.known_allergies}` : '',
              chief_complaint: 'Clinical consultation initiated via Patient QR'
            }));
            setShowConsultModal(true);
          }}
          onCancel={() => setShowQRScanner(false)}
        />
      </Modal>
    </div>
  );
};
