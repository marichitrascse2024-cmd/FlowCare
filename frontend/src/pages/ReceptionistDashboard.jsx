import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Clock, 
  Calendar, 
  Receipt, 
  Sparkles, 
  CheckCircle2, 
  Search, 
  Stethoscope, 
  Activity,
  Plus,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { DashboardCard } from '../components/DashboardCard';
import { TokenDisplay } from '../components/TokenDisplay';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { AIBillingModal } from '../components/AIBillingModal';
import { AISchedulingModal } from '../components/AISchedulingModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { api } from '../services/api';

export const ReceptionistDashboard = ({ onNavigate }) => {
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // QR Scanner Modal
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Check-In Modal
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [checkInDepartment, setCheckInDepartment] = useState('All Departments');
  const [checkInDoctorId, setCheckInDoctorId] = useState('');
  const [checkInPatientId, setCheckInPatientId] = useState('');
  const [checkInPriority, setCheckInPriority] = useState('NORMAL');

  // AI Billing Assistant Modal
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingPatientId, setBillingPatientId] = useState(null);
  const [billingApptId, setBillingApptId] = useState(null);

  // AI Scheduling Modal
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [queueData, apptsData, docsData, patsData] = await Promise.all([
        api.getQueue(),
        api.getAppointments({ appointment_date: todayStr }),
        api.getDoctors(),
        api.getPatients()
      ]);
      setQueue(queueData);
      setAppointments(apptsData);
      setDoctors(docsData);
      setPatients(patsData);
    } catch (err) {
      console.error('Error loading receptionist data:', err);
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

  // Extract all departments dynamically
  const knownDepartments = [
    'Cardiology',
    'Orthopedics',
    'General Medicine',
    'Pediatrics',
    'Dermatology',
    'Neurology',
    'Gynecology',
    'ENT',
    'Ophthalmology',
    'Dental',
    'Pulmonology',
    'Gastroenterology'
  ];
  const dynamicDepartments = Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)));
  const allDepartmentsList = ['All Departments', ...Array.from(new Set([...knownDepartments, ...dynamicDepartments]))];

  const handleOpenCheckInForAppt = (appt) => {
    setSelectedAppt(appt);
    setCheckInPatientId(appt.patient_id.toString());
    setCheckInDoctorId(appt.doctor_id.toString());
    const doc = doctors.find(d => d.id === appt.doctor_id);
    if (doc) setCheckInDepartment(doc.specialization);
    setCheckInPriority(appt.priority || 'NORMAL');
    setShowCheckInModal(true);
  };

  const handleQRResolved = (pData) => {
    setCheckInPatientId(pData.patient_id.toString());
    setSelectedAppt(null);
    setShowCheckInModal(true);
  };

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!checkInPatientId || !checkInDoctorId) {
      alert('Please select both a patient and an assigned doctor.');
      return;
    }
    try {
      const payload = {
        patient_id: parseInt(checkInPatientId),
        doctor_id: parseInt(checkInDoctorId),
        priority: checkInPriority,
        appointment_id: selectedAppt ? selectedAppt.id : undefined
      };
      const res = await api.checkIn(payload);
      alert(`Patient checked in successfully! Assigned Token: ${res.token_number} (Position #${res.queue_position})`);
      setShowCheckInModal(false);
      setSelectedAppt(null);
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to check in patient.');
    }
  };

  const handleOpenBilling = (patientId, apptId) => {
    setBillingPatientId(patientId);
    setBillingApptId(apptId);
    setShowBillingModal(true);
  };

  const activeConsultation = queue.find(q => q.status === 'IN_CONSULTATION');
  const nextWaiting = queue.find(q => q.status === 'WAITING' || q.status === 'CALLED');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Front Desk & Reception Station</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Patient check-in, token generation, AI appointment scheduling, and automated billing draft confirmation</p>
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
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Desk'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setSelectedAppt(null); setShowCheckInModal(true); }}>
            <UserPlus size={14} /> Quick Check-In / Walk-in
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => setShowSchedulingModal(true)}>
            <Sparkles size={14} /> AI Smart Scheduling
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Live Token Banner */}
      <TokenDisplay
        currentToken={activeConsultation?.token_number}
        nextToken={nextWaiting?.token_number}
        averageWaitTime={12}
        totalWaiting={queue.filter(q => q.status === 'WAITING' || q.status === 'CALLED').length}
      />

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <DashboardCard
          title="Active Live Queue"
          value={queue.length}
          subtitle="Patients in hospital"
          icon={Activity}
          color="primary"
        />
        <DashboardCard
          title="Today's Appointments"
          value={appointments.length}
          subtitle="Scheduled slots"
          icon={Calendar}
          color="info"
        />
        <DashboardCard
          title="Checked-In Today"
          value={queue.filter(q => q.status !== 'CANCELLED').length}
          subtitle="Tokens distributed"
          icon={UserPlus}
          color="success"
        />
        <DashboardCard
          title="Avg Triage Wait"
          value="12 mins"
          subtitle="Dynamic queue pacing"
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Main Grid: Today's Booked Appointments + Active Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Booked Appointments Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Calendar size={18} color="#0284c7" />
              Today's Bookings (Click to Check-In)
            </h3>
            <span className="badge badge-primary">{appointments.length} Booked</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Doctor / Dept</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td><strong>{appt.time_slot}</strong></td>
                    <td>
                      <div>{appt.patient_name}</div>
                      <small style={{ color: '#64748b' }}>{appt.patient_code}</small>
                    </td>
                    <td>
                      <div>{appt.doctor_name}</div>
                      <small style={{ color: '#0284c7' }}>{appt.department || appt.doctor_specialization}</small>
                    </td>
                    <td><Badge status={appt.status} /></td>
                    <td>
                      {appt.status === 'CONFIRMED' && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenCheckInForAppt(appt)}
                        >
                          Check-In
                        </button>
                      )}
                      {appt.status === 'COMPLETED' && (
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleOpenBilling(appt.patient_id, appt.id)}
                        >
                          <Receipt size={12} /> Bill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      No booked appointments found for today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Queue Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={18} color="#10b981" />
              Live Hospital Queue Board
            </h3>
            <span className="badge badge-success">{queue.length} Active</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Assigned Doctor</th>
                  <th>Priority</th>
                  <th>Status</th>
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
                    <td>
                      <div>{q.doctor_name}</div>
                      <small style={{ color: '#64748b' }}>{q.department || q.doctor_specialization || 'Room 101'}</small>
                    </td>
                    <td><Badge status={q.priority} /></td>
                    <td><Badge status={q.status} /></td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Queue is currently empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Check-In Modal */}
      <Modal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        title={selectedAppt ? `Check-In Booked Patient (${selectedAppt.patient_name})` : "Quick Patient Check-In & Token Generation"}
      >
        <form onSubmit={handleCheckInSubmit}>
          <div className="form-group">
            <label className="form-label">Select Patient *</label>
            <select
              className="form-control"
              value={checkInPatientId}
              onChange={(e) => setCheckInPatientId(e.target.value)}
              required
            >
              <option value="">-- Choose Registered Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Filter Department</label>
            <select
              className="form-control"
              value={checkInDepartment}
              onChange={(e) => {
                setCheckInDepartment(e.target.value);
                setCheckInDoctorId('');
              }}
            >
              {allDepartmentsList.map((dept, idx) => (
                <option key={idx} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assign Doctor *</label>
            <select
              className="form-control"
              value={checkInDoctorId}
              onChange={(e) => setCheckInDoctorId(e.target.value)}
              required
            >
              <option value="">-- Select Doctor --</option>
              {doctors
                .filter(d => checkInDepartment === 'All Departments' || d.specialization === checkInDepartment)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.specialization}) — {d.room_number}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Queue Priority</label>
            <select
              className="form-control"
              value={checkInPriority}
              onChange={(e) => setCheckInPriority(e.target.value)}
            >
              <option value="NORMAL">NORMAL (Standard Queue)</option>
              <option value="SENIOR_CITIZEN">SENIOR CITIZEN (Elevated Priority)</option>
              <option value="EMERGENCY">EMERGENCY (Urgent Immediate Care)</option>
              <option value="PREGNANT">PREGNANT (Fast-Track Priority)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Generate Live Token & Admit</button>
          </div>
        </form>
      </Modal>

      {/* AI Scheduling Modal */}
      <AISchedulingModal
        isOpen={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
        doctors={doctors}
        onSelectSlot={async (slot) => {
          try {
            await api.createAppointment({
              patient_id: patients[0]?.id || 1,
              doctor_id: slot.doctor_id,
              appointment_date: slot.appointment_date,
              time_slot: slot.time_slot,
              ai_suggested: 'YES',
              chief_complaint: 'Booked via Front Desk AI Scheduling Wizard'
            });
            alert(`Appointment scheduled successfully for ${slot.time_slot} on ${slot.appointment_date}!`);
            await loadData(true);
          } catch (err) {
            alert(err.message || 'Failed to book slot.');
          }
        }}
      />

      {/* AI Billing Assistant Modal */}
      <AIBillingModal
        isOpen={showBillingModal}
        onClose={() => setShowBillingModal(false)}
        patientId={billingPatientId}
        appointmentId={billingApptId}
        onBillCreated={() => loadData(true)}
      />

      {/* Universal Patient QR Scanner Modal */}
      <Modal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="RECEPTION"
          title="Scan Patient QR"
          customActionLabel="Fast Check-In This Patient"
          onCustomAction={(patientData) => {
            setShowQRScanner(false);
            setCheckInPatientId(patientData.patient_id.toString());
            setShowCheckInModal(true);
          }}
          onCancel={() => setShowQRScanner(false)}
        />
      </Modal>
    </div>
  );
};
