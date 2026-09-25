import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  FileText, 
  ClipboardList, 
  Receipt, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard,
  Plus,
  Activity,
  ArrowRight,
  RefreshCw,
  QrCode,
  HeartPulse,
  ShieldCheck,
  ScanFace,
  Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardCard } from '../components/DashboardCard';
import { Badge } from '../components/Badge';
import { AIWaitTimeCard } from '../components/AIWaitTimeCard';
import { AISchedulingModal } from '../components/AISchedulingModal';
import RiskAssessmentModal from '../components/RiskAssessmentModal';
import QRCodeModal from '../components/QRCodeModal';
import { RegisterFaceModal } from '../components/RegisterFaceModal';
import { VideoCallModal } from '../components/VideoCallModal';
import { Modal } from '../components/Modal';
import { api } from '../services/api';

export const PatientDashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [liveQueue, setLiveQueue] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [records, setRecords] = useState([]);
  const [bills, setBills] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeVideoCallAppt, setActiveVideoCallAppt] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // AI Booking Wizard Modal
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);

  // AI Disease Risk Modal
  const [showRiskModal, setShowRiskModal] = useState(false);

  // Face Registration Modal
  const [showFaceModal, setShowFaceModal] = useState(false);

  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [paying, setPaying] = useState(false);

  const loadPatientData = async (isManualRefresh = false) => {
    if (!user?.patient_id) return;
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const [apptsData, queueData, rxData, recData, billsData, docsData] = await Promise.all([
        api.getAppointments(),
        api.getPatientQueue(user.patient_id),
        api.getPatientPrescriptions(user.patient_id),
        api.getPatientMedicalRecords(user.patient_id),
        api.getBills(),
        api.getDoctors()
      ]);
      setAppointments(apptsData);
      setLiveQueue(queueData);
      setPrescriptions(rxData);
      setRecords(recData);
      setBills(billsData);
      setDoctors(docsData);
    } catch (err) {
      console.error('Failed to load patient dashboard:', err);
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
    loadPatientData();
    const interval = setInterval(() => loadPatientData(false), 8000);
    return () => clearInterval(interval);
  }, [user]);

  const upcomingAppt = appointments.find(a => a.status === 'CONFIRMED' || a.status === 'WAITING' || a.status === 'IN_CONSULTATION');
  const pendingBill = bills.find(b => b.payment_status === 'PENDING' || b.payment_status === 'PARTIAL');

  const handlePayBill = async (e) => {
    e.preventDefault();
    if (!selectedBill) return;
    setPaying(true);
    try {
      await api.payBill(selectedBill.id, {
        payment_method: paymentMethod,
        amount_paid: selectedBill.total_amount,
        transaction_reference: `TXN-${Date.now()}`,
        notes: 'Online patient portal payment'
      });
      alert('Payment successful! Thank you.');
      setShowPayModal(false);
      await loadPatientData(true);
    } catch (err) {
      alert(err.message || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Welcome, {user?.full_name}</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Patient ID: <strong>{user?.patient_code}</strong> • Your personalized health and queue portal</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowQRModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}
          >
            <QrCode size={14} /> My Patient QR
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowRiskModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            <HeartPulse size={14} /> AI Health Risk Screening
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadPatientData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Portal'}
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => setShowSchedulingModal(true)}>
            <Sparkles size={14} /> AI Smart Book Slot
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* MY TOKEN: Live Queue Banner if checked-in */}
      {liveQueue && (
        <div 
          className="card" 
          style={{ 
            background: 'linear-gradient(135deg, #0f172a, #1e293b)', 
            color: '#ffffff', 
            borderColor: '#38bdf8', 
            borderWidth: '2px', 
            marginBottom: '2rem', 
            boxShadow: '0 10px 25px rgba(14, 165, 233, 0.15)' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                <Activity size={16} /> MY TOKEN — LIVE CLINIC QUEUE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontSize: '2.75rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                  {liveQueue.token_number}
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                  YOU
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.6rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>Doctor: <strong style={{ color: '#ffffff' }}>{liveQueue.doctor_name}</strong></span>
                <span>Department: <strong style={{ color: '#38bdf8' }}>{liveQueue.department || liveQueue.doctor_specialization || 'General Medicine'}</strong></span>
                {liveQueue.room_number && <span>Room: <strong style={{ color: '#ffffff' }}>{liveQueue.room_number}</strong></span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Position</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                  {liveQueue.status === 'IN_CONSULTATION' ? 'Inside Room' : `#${liveQueue.queue_position}`}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Patients Ahead</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                  {liveQueue.status === 'IN_CONSULTATION' ? 0 : Math.max(0, (liveQueue.queue_position || 1) - 1)}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>AI Estimated Wait</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>
                  {liveQueue.status === 'IN_CONSULTATION' ? 'Active' : `~${liveQueue.estimated_wait_time ?? liveQueue.estimated_wait_minutes} mins`}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Status</div>
                <Badge status={liveQueue.status} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <DashboardCard
          title="Upcoming Appointment"
          value={upcomingAppt ? (upcomingAppt.doctor_delay_minutes > 0 && upcomingAppt.shifted_time_slot ? upcomingAppt.shifted_time_slot : upcomingAppt.time_slot) : 'None'}
          subtitle={upcomingAppt ? `${upcomingAppt.appointment_date} with ${upcomingAppt.doctor_name}${upcomingAppt.doctor_delay_minutes > 0 ? ` (Revised from ${upcomingAppt.time_slot})` : ''}` : 'No active booking'}
          icon={Calendar}
          color="primary"
        />
        <DashboardCard
          title="Active Prescriptions"
          value={prescriptions.length}
          subtitle="Issued medications"
          icon={ClipboardList}
          color="success"
        />
        <DashboardCard
          title="Medical Records"
          value={records.length}
          subtitle="Hybrid-Encrypted Clinical Archive"
          icon={ShieldCheck}
          color="info"
        />
        <DashboardCard
          title="Pending Invoices"
          value={pendingBill ? `₹${pendingBill.total_amount}` : '₹0.00'}
          subtitle={pendingBill ? `Bill #${pendingBill.bill_number}` : 'All bills settled'}
          icon={Receipt}
          color={pendingBill ? 'warning' : 'success'}
        />
      </div>

      {/* Advanced Features Quick Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* My Patient QR Pass Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderColor: '#bae6fd' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#0284c7', color: '#ffffff', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <QrCode size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>My Patient QR</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Universal Patient Identity</p>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '1rem' }}>
            View and download your digital patient QR pass for rapid check-in at clinic reception or triage kiosks.
          </p>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setShowQRModal(true)}
            style={{ width: '100%', borderColor: '#0284c7', color: '#0284c7' }}
          >
            <QrCode size={14} /> View My QR Code
          </button>
        </div>

        {/* Face Recognition Pass Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 100%)', borderColor: '#a7f3d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#059669', color: '#ffffff', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <ScanFace size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Face Recognition</h4>
                <Badge variant={user?.face_auth_enabled ? 'success' : 'warning'}>
                  {user?.face_auth_enabled ? 'Active' : 'Not Registered'}
                </Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>AI Biometric Authentication</p>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '1rem' }}>
            {user?.face_auth_enabled 
              ? 'Face Recognition is active for your account. You can log in securely using your webcam or photo.' 
              : 'Register your face using your webcam or photo upload to enable 1-click Face Recognition login.'}
          </p>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setShowFaceModal(true)}
            style={{ width: '100%', borderColor: '#059669', color: '#059669' }}
          >
            <ScanFace size={14} /> {user?.face_auth_enabled ? 'Update Face Photo' : 'Register Face Recognition'}
          </button>
        </div>

        {/* AI Disease Risk Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)', borderColor: '#f5d0fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#7c3aed', color: '#ffffff', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <HeartPulse size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>AI Disease Risk Assessment</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Cardiovascular & Glycemic Screening</p>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '1rem' }}>
            Evaluate your 10-year Cardiovascular and Type 2 Diabetes clinical risk factors with personalized recommendations.
          </p>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setShowRiskModal(true)}
            style={{ width: '100%', borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            <Sparkles size={14} /> Run AI Risk Screening
          </button>
        </div>
      </div>

      {/* Main Grid: AI Wait Predictor + Upcoming Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {upcomingAppt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <AIWaitTimeCard
              doctorId={upcomingAppt.doctor_id}
              patientId={user?.patient_id}
            />
            <div 
              className="card" 
              style={{ 
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                color: '#ffffff', 
                borderColor: '#38bdf8', 
                borderWidth: '1px' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Video size={16} /> LIVE TELECONSULTATION STATION
                  </div>
                  <h4 style={{ margin: '0.35rem 0 0 0', fontSize: '1.1rem', fontWeight: 800 }}>
                    Appointment #{upcomingAppt.id} with {upcomingAppt.doctor_name}
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Slot: {upcomingAppt.doctor_delay_minutes > 0 && upcomingAppt.shifted_time_slot ? upcomingAppt.shifted_time_slot : upcomingAppt.time_slot} • Encrypted WebRTC Room
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setActiveVideoCallAppt(upcomingAppt);
                    setShowVideoModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', borderColor: '#38bdf8', fontWeight: 700 }}
                >
                  <Video size={16} /> Join Video Call
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2.5rem' }}>
            <Calendar size={40} color="#0284c7" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>Need a Doctor Consultation?</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem', maxWidth: '350px' }}>
              Use our AI-assisted slot optimizer to find available appointments across all departments with minimal wait times.
            </p>
            <button className="btn btn-ai" onClick={() => setShowSchedulingModal(true)}>
              <Sparkles size={16} /> Book With AI Assistant
            </button>
          </div>
        )}

        {/* Latest Prescriptions Quick View */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ClipboardList size={18} color="#10b981" />
              Latest Prescriptions
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('prescriptions')}>
              View All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {prescriptions.slice(0, 2).map((rx) => (
              <div key={rx.id} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{rx.prescription_number}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(rx.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Prescribed by {rx.doctor_name} ({rx.doctor_specialization || rx.department})
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                  {rx.items.map((it, i) => (
                    <div key={i}>• {it.medicine_name} ({it.dosage}) — {it.frequency}</div>
                  ))}
                </div>
              </div>
            ))}
            {prescriptions.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                No prescriptions on file yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Bills Row if any */}
      {pendingBill && (
        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Receipt size={22} />
              </div>
              <div>
                <h4 style={{ color: '#92400e', fontWeight: 700 }}>Outstanding Bill #{pendingBill.bill_number}</h4>
                <p style={{ fontSize: '0.85rem', color: '#b45309' }}>Amount Due: <strong>₹{pendingBill.total_amount.toFixed(2)}</strong> • Generated: {new Date(pendingBill.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSelectedBill(pendingBill);
                setShowPayModal(true);
              }}
            >
              <CreditCard size={14} /> Settle Bill Online
            </button>
          </div>
        </div>
      )}

      {/* AI Smart Scheduling Modal */}
      <AISchedulingModal
        isOpen={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
        doctors={doctors}
        onSelectSlot={async (slot) => {
          try {
            await api.createAppointment({
              doctor_id: slot.doctor_id,
              appointment_date: slot.appointment_date,
              time_slot: slot.time_slot,
              ai_suggested: 'YES',
              chief_complaint: 'Booked via FlowCare AI Smart Slot Recommender'
            });
            alert(`Appointment booked successfully for ${slot.time_slot} on ${slot.appointment_date}!`);
            await loadPatientData(true);
          } catch (err) {
            alert(err.message || 'Failed to book appointment.');
          }
        }}
      />

      {/* AI Disease Risk Assessment Modal */}
      <RiskAssessmentModal
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        initialPatientId={user?.patient_id}
        initialPatientName={user?.full_name}
      />

      {/* Pay Bill Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`Settle Bill #${selectedBill?.bill_number}`}
      >
        <form onSubmit={handlePayBill}>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Total Invoice Amount:</span>
              <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>₹{selectedBill?.total_amount?.toFixed(2)}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Includes all consultation fees, diagnostics, and healthcare service taxes.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CARD">Credit / Debit Card</option>
              <option value="UPI">UPI / Instant Pay (GPay, PhonePe)</option>
              <option value="NET_BANKING">Net Banking</option>
              <option value="INSURANCE">Insurance Direct Claim</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={paying}>
              {paying ? 'Processing Payment...' : `Pay ₹${selectedBill?.total_amount?.toFixed(2)}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Register Face Recognition Modal */}
      <RegisterFaceModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onSuccess={() => loadPatientData(true)}
      />

      {/* WebRTC Video Call Signaling Modal */}
      <VideoCallModal
        isOpen={showVideoModal}
        onClose={() => {
          setShowVideoModal(false);
          setActiveVideoCallAppt(null);
        }}
        appointment_id={activeVideoCallAppt?.id}
        patientName={user?.full_name || 'Patient'}
        doctorName={activeVideoCallAppt?.doctor_name || 'Dr. Specialist'}
        userRole="PATIENT"
      />

      {/* Patient QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        patientId={user?.patient_id}
        patientName={user?.full_name}
        patientCode={user?.patient_code}
      />
    </div>
  );
};
