import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  UserCheck, 
  RefreshCw,
  Stethoscope,
  ChevronRight,
  User,
  ArrowLeft,
  DollarSign,
  MapPin,
  Award,
  QrCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { AISchedulingModal } from '../components/AISchedulingModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { api } from '../services/api';

export const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Interactive 5-Step Booking State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1); // 1: Dept, 2: Doctor, 3: Date, 4: Slot, 5: Confirm
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [doctorSlots, setDoctorSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingPatientId, setBookingPatientId] = useState('');
  const [bookingType, setBookingType] = useState('GENERAL');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // AI Scheduler Modal
  const [showAIScheduler, setShowAIScheduler] = useState(false);

  // QR Appointment Booking Modal
  const [showQRBookModal, setShowQRBookModal] = useState(false);

  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');

  // AI Symptom-Based Doctor Recommendation State
  const [symptomsInput, setSymptomsInput] = useState('');
  const [symptomAnalyzing, setSymptomAnalyzing] = useState(false);
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [recommendationError, setRecommendationError] = useState('');

  const handleAnalyzeSymptoms = async (e) => {
    if (e) e.preventDefault();
    if (!symptomsInput.trim()) {
      setRecommendationError('Please enter your symptoms to receive specialist recommendations.');
      return;
    }
    try {
      setSymptomAnalyzing(true);
      setRecommendationError('');
      const res = await api.getDoctorRecommendations(symptomsInput);
      setRecommendationResult(res);
    } catch (err) {
      setRecommendationError(err.message || 'Failed to analyze symptoms.');
    } finally {
      setSymptomAnalyzing(false);
    }
  };

  const handleBookWithRecommendedDoctor = (doc) => {
    setSelectedDept(doc.specialization);
    const fullDoc = doctors.find(d => d.id === doc.doctor_id) || {
      id: doc.doctor_id,
      full_name: doc.full_name,
      specialization: doc.specialization,
      qualification: doc.qualification,
      consultation_fee: doc.consultation_fee,
      room_number: doc.room_number,
      experience_years: doc.experience_years
    };
    setSelectedDoctor(fullDoc);
    setChiefComplaint(symptomsInput || 'Symptom-based specialist consultation');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setBookingStep(3); // Jump directly to Step 3: Date & Slot with Doctor configured!
    setShowBookModal(true);
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (doctorFilter) params.doctor_id = doctorFilter;
      if (dateFilter) params.appointment_date = dateFilter;

      const [appts, docs, pats] = await Promise.all([
        api.getAppointments(params),
        api.getDoctors(),
        user?.role !== 'PATIENT' ? api.getPatients() : Promise.resolve([])
      ]);
      setAppointments(appts);
      setDoctors(docs);
      setPatients(pats);
    } catch (err) {
      console.error('Failed to load appointments:', err);
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
  }, [statusFilter, doctorFilter, dateFilter]);

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
  const selectableDepartments = Array.from(new Set([...knownDepartments, ...dynamicDepartments]));

  // Doctors in the currently selected department for Step 2
  const doctorsInSelectedDept = selectedDept
    ? doctors.filter(d => d.specialization?.toLowerCase() === selectedDept.toLowerCase())
    : [];

  // Fetch available slots when doctor or date changes in Step 4
  const fetchDoctorSlots = async (docId, dStr) => {
    if (!docId) return;
    setSlotsLoading(true);
    try {
      const res = await api.getDoctorAvailableSlots(docId, dStr);
      setDoctorSlots(res.slots || []);
    } catch (err) {
      console.error('Failed to fetch doctor slots:', err);
      // Fallback standard slots
      setDoctorSlots([
        { time_slot: '09:00 AM', is_available: true },
        { time_slot: '09:30 AM', is_available: true },
        { time_slot: '10:00 AM', is_available: true },
        { time_slot: '10:30 AM', is_available: true },
        { time_slot: '11:00 AM', is_available: true },
        { time_slot: '11:30 AM', is_available: true },
        { time_slot: '02:00 PM', is_available: true },
        { time_slot: '02:30 PM', is_available: true },
        { time_slot: '03:00 PM', is_available: true },
        { time_slot: '03:30 PM', is_available: true },
        { time_slot: '04:00 PM', is_available: true },
        { time_slot: '04:30 PM', is_available: true }
      ]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleOpenBookingWizard = () => {
    setBookingStep(1);
    setSelectedDept('');
    setSelectedDoctor(null);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedSlot('');
    setChiefComplaint('');
    setBookingType('GENERAL');
    if (patients.length > 0) {
      setBookingPatientId(patients[0].id);
    }
    setShowBookModal(true);
  };

  const handleSelectDepartment = (dept) => {
    setSelectedDept(dept);
    setSelectedDoctor(null);
    setSelectedSlot('');
    setBookingStep(2); // Advance to Doctor Selection
  };

  const handleSelectDoctor = (doc) => {
    setSelectedDoctor(doc);
    setSelectedSlot('');
    setBookingStep(3); // Advance to Date Selection
  };

  const handleSelectDate = (dateVal) => {
    setSelectedDate(dateVal);
    fetchDoctorSlots(selectedDoctor?.id, dateVal);
    setBookingStep(4); // Advance to Time Slot Selection
  };

  const handleSelectSlot = (slotStr) => {
    setSelectedSlot(slotStr);
    setBookingStep(5); // Advance to Confirmation
  };

  const handleConfirmAppointment = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) {
      alert('Please complete all booking steps.');
      return;
    }

    setBookingSubmitting(true);
    try {
      await api.createAppointment({
        doctor_id: selectedDoctor.id,
        patient_id: user?.role !== 'PATIENT' ? parseInt(bookingPatientId || patients[0]?.id) : undefined,
        department: selectedDoctor.specialization || selectedDept,
        appointment_date: selectedDate,
        time_slot: selectedSlot,
        appointment_type: bookingType,
        chief_complaint: chiefComplaint || 'Routine medical consultation'
      });
      alert(`Appointment confirmed successfully with ${selectedDoctor.full_name} on ${selectedDate} at ${selectedSlot}!`);
      setShowBookModal(false);
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to book appointment.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCheckIn = async (appt) => {
    try {
      const res = await api.checkIn({
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        priority: 'NORMAL'
      });
      alert(`Patient checked in! Token: ${res.token_number} (Position #${res.queue_position})`);
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Check-in failed.');
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!selectedAppt) return;
    try {
      await api.updateAppointment(selectedAppt.id, {
        appointment_date: rescheduleDate,
        time_slot: rescheduleSlot,
        status: 'CONFIRMED'
      });
      alert('Appointment rescheduled successfully!');
      setShowRescheduleModal(false);
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Reschedule failed.');
    }
  };

  const handleCancelAppt = async (id) => {
    const reason = prompt('Please enter cancellation reason:');
    if (reason === null) return;
    try {
      await api.updateAppointment(id, {
        status: 'CANCELLED',
        cancellation_reason: reason || 'Cancelled by user'
      });
      alert('Appointment cancelled.');
      await loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to cancel.');
    }
  };

  // Filtered appointments by department if selected
  const filteredAppointments = appointments.filter((a) => {
    if (departmentFilter !== 'All Departments') {
      const dept = a.department || a.doctor_specialization;
      if (dept?.toLowerCase() !== departmentFilter.toLowerCase()) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Appointment Management</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Schedule, reschedule, and manage clinical consultations across all hospital departments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowQRBookModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}
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
            {refreshing ? 'Refreshing...' : 'Refresh Appointments'}
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => setShowAIScheduler(true)}>
            <Sparkles size={14} /> AI Smart Slot Recommender
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenBookingWizard}>
            <Plus size={14} /> Book Appointment
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* AI Doctor Recommendation Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        border: '1px solid #38bdf8',
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 20px rgba(14, 165, 233, 0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#38bdf8', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
          <Sparkles size={16} /> AI Symptom-to-Specialist Recommender
        </div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '800' }}>
          Not sure which doctor or department to consult?
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
          Describe your symptoms (e.g. <em>"chest heaviness and shortness of breath"</em> or <em>"knee swelling after sports"</em>) and our clinical AI engine will recommend the right department and all available registered doctors.
        </p>

        <form onSubmit={handleAnalyzeSymptoms} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input 
            type="text"
            className="form-control"
            placeholder="Type symptoms e.g. severe chest pain, skin rash, dental toothache..."
            value={symptomsInput}
            onChange={(e) => setSymptomsInput(e.target.value)}
            style={{ flex: '1 1 300px', background: '#ffffff', color: '#0f172a' }}
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={symptomAnalyzing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 0 auto' }}
          >
            {symptomAnalyzing ? <RefreshCw size={16} className="spin-animate" /> : <Sparkles size={16} />}
            Find Right Specialist
          </button>
        </form>

        {recommendationError && (
          <div style={{ marginTop: '0.75rem', color: '#fca5a5', fontSize: '0.85rem' }}>
            {recommendationError}
          </div>
        )}

        {/* Recommendation Results Card */}
        {recommendationResult && (
          <div style={{
            marginTop: '1.25rem',
            background: 'rgba(255, 255, 255, 0.07)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '0.75rem',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Recommended Specialty</span>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#38bdf8' }}>
                  {recommendationResult.recommended_department}
                </div>
              </div>
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                padding: '0.3rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem',
                fontWeight: '700'
              }}>
                {recommendationResult.confidence_score}% Confidence Match
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#e2e8f0', margin: '0 0 1rem 0' }}>
              {recommendationResult.reason}
            </p>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
              Available Registered Specialists in {recommendationResult.recommended_department} ({recommendationResult.doctors?.length || 0}):
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {recommendationResult.doctors?.map((doc) => (
                <div key={doc.doctor_id} style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '0.5rem',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{doc.full_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: '600' }}>{doc.qualification}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Fee: <strong>₹{doc.consultation_fee}</strong> • {doc.room_number}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleBookWithRecommendedDoctor(doc)}
                    style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.8rem' }}
                  >
                    Select & Book with {doc.full_name.split(' ')[1] || 'Doctor'} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Department</label>
            <select
              className="form-control"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              {allDepartmentsList.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Filter by Doctor</label>
            <select
              className="form-control"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.specialization})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Filter by Status</label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="BOOKED">Booked</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="WAITING">Waiting (In Queue)</option>
              <option value="IN_CONSULTATION">In Consultation</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Filter by Date</label>
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Appt #</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Live Token</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong style={{ color: '#0284c7' }}>{a.appointment_number}</strong>
                    {a.ai_suggested === 'YES' && (
                      <span title="Booked via AI Optimizer" style={{ marginLeft: '4px', color: '#6366f1', fontSize: '0.75rem' }}>✨</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{a.patient_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.patient_code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.doctor_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.doctor_room || 'Room OPD'}</span>
                  </td>
                  <td>
                    <span className="badge badge-info">{a.department || a.doctor_specialization || 'General'}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.appointment_date}</div>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>{a.time_slot || a.appointment_time}</span>
                  </td>
                  <td><span className="badge badge-secondary">{a.appointment_type}</span></td>
                  <td>
                    {a.queue_token ? (
                      <span className="badge badge-success" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {a.queue_token}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Not in queue</span>
                    )}
                  </td>
                  <td><Badge status={a.status || a.appointment_status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {/* Check-In Button: generate queue token */}
                      {(a.status === 'BOOKED' || a.status === 'CONFIRMED') && !a.queue_token && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                          onClick={() => handleCheckIn(a)}
                          title="Generate Queue Token"
                        >
                          <UserCheck size={12} /> Check-In
                        </button>
                      )}

                      {/* Reschedule Button */}
                      {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                          onClick={() => {
                            setSelectedAppt(a);
                            setRescheduleDate(a.appointment_date);
                            setRescheduleSlot(a.time_slot);
                            setShowRescheduleModal(true);
                          }}
                          title="Reschedule"
                        >
                          <Clock size={12} />
                        </button>
                      )}

                      {/* Cancel Button */}
                      {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                          onClick={() => handleCancelAppt(a.id)}
                          title="Cancel"
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredAppointments.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                    No appointments found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5-Step Interactive Multi-Doctor Booking Wizard Modal */}
      <Modal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        title="Interactive 5-Step Appointment Booking"
        size="lg"
      >
        <div>
          {/* Step Progress Indicator */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            {[
              { num: 1, label: '1. Department' },
              { num: 2, label: '2. Doctor' },
              { num: 3, label: '3. Date' },
              { num: 4, label: '4. Time Slot' },
              { num: 5, label: '5. Confirm' }
            ].map((st) => (
              <div 
                key={st.num} 
                style={{ 
                  background: bookingStep === st.num ? '#0284c7' : (bookingStep > st.num ? '#10b981' : '#f1f5f9'),
                  color: bookingStep >= st.num ? '#ffffff' : '#64748b',
                  padding: '0.45rem 0.2rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}
              >
                {bookingStep > st.num ? `✓ ${st.label.split('. ')[1]}` : st.label}
              </div>
            ))}
          </div>

          {/* STEP 1: SELECT DEPARTMENT */}
          {bookingStep === 1 && (
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Step 1: Select Clinical Specialty / Department
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
                Choose the clinical specialty for your consultation. Multiple doctors are available in each department.
              </p>

              {user?.role !== 'PATIENT' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Booking for Patient *</label>
                  <select
                    className="form-control"
                    value={bookingPatientId}
                    onChange={(e) => setBookingPatientId(e.target.value)}
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.patient_code}) — {p.blood_group || 'No blood group'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {selectableDepartments.map((dept) => {
                  const docCount = doctors.filter(d => d.specialization?.toLowerCase() === dept.toLowerCase()).length;
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => handleSelectDepartment(dept)}
                      style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.4rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0284c7';
                        e.currentTarget.style.background = '#f0f9ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Stethoscope size={18} color="#0284c7" />
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{dept}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {docCount} {docCount === 1 ? 'Doctor Available' : 'Doctors Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT DOCTOR */}
          {bookingStep === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Step 2: Select Doctor in {selectedDept}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    All doctors registered under {selectedDept}. Select the doctor you wish to consult.
                  </p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingStep(1)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ArrowLeft size={14} /> Back to Departments
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {doctorsInSelectedDept.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      background: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.background = '#f0f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          {doc.full_name}
                        </h4>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Available</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0' }}>
                        {doc.qualification || 'Specialist Physician'} • {doc.experience_years ? `${doc.experience_years} years experience` : 'Senior Consultant'}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>📍 {doc.room_number || 'Room 101'}</span>
                        <span>⏱️ ~{doc.average_consultation_time || 15} mins / patient</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>
                        ₹{doc.consultation_fee || 500}
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ marginTop: '0.35rem' }}>
                        Select Doctor <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {doctorsInSelectedDept.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No doctors found in {selectedDept}. Please choose another department.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SELECT DATE */}
          {bookingStep === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Step 3: Select Consultation Date
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Consulting with <strong>{selectedDoctor?.full_name}</strong> ({selectedDept})
                  </p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingStep(2)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ArrowLeft size={14} /> Back to Doctors
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Pick Date *</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ fontSize: '1rem', padding: '0.65rem' }}
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />

                {/* Quick Date Chips */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: 'In 2 Days', offset: 2 },
                    { label: 'In 3 Days', offset: 3 },
                    { label: 'Next Week', offset: 7 }
                  ].map((chip) => {
                    const d = new Date();
                    d.setDate(d.getDate() + chip.offset);
                    const dStr = d.toISOString().split('T')[0];
                    const isSelected = selectedDate === dStr;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedDate(dStr)}
                      >
                        {chip.label} ({dStr.split('-').slice(1).join('/')})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleSelectDate(selectedDate)}
                >
                  Proceed to Time Slots <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SELECT AVAILABLE TIME SLOT */}
          {bookingStep === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Step 4: Select Available Time Slot
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Doctor: <strong>{selectedDoctor?.full_name}</strong> • Date: <strong>{selectedDate}</strong>
                  </p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingStep(3)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ArrowLeft size={14} /> Back to Date
                </button>
              </div>

              {slotsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Checking doctor schedule & booking availability...</div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {doctorSlots.map((s) => {
                      const isAvail = s.is_available;
                      const isSel = selectedSlot === s.time_slot;
                      return (
                        <button
                          key={s.time_slot}
                          type="button"
                          disabled={!isAvail}
                          onClick={() => handleSelectSlot(s.time_slot)}
                          style={{
                            padding: '0.75rem 0.5rem',
                            borderRadius: '8px',
                            border: isSel ? '2px solid #0284c7' : '1px solid #e2e8f0',
                            background: isSel ? '#0284c7' : (isAvail ? '#ffffff' : '#f1f5f9'),
                            color: isSel ? '#ffffff' : (isAvail ? '#0f172a' : '#94a3b8'),
                            cursor: isAvail ? 'pointer' : 'not-allowed',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div>{s.time_slot}</div>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isSel ? '#e0f2fe' : (isAvail ? '#16a34a' : '#ef4444') }}>
                            {isAvail ? '● Available' : '✕ Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: CONFIRM APPOINTMENT */}
          {bookingStep === 5 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Step 5: Review & Confirm Consultation
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Please verify your selected appointment details before confirming.
                  </p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBookingStep(4)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ArrowLeft size={14} /> Back to Slots
                </button>
              </div>

              {/* Verified Booking Card */}
              <div style={{ background: 'linear-gradient(135deg, #f0f9ff, #ffffff)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Department</span>
                    <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '1.05rem' }}>{selectedDept}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Selected Doctor</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{selectedDoctor?.full_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>{selectedDoctor?.qualification} ({selectedDoctor?.room_number})</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Date & Time</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{selectedDate}</div>
                    <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>{selectedSlot}</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Consultation Fee</span>
                    <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '1.15rem' }}>₹{selectedDoctor?.consultation_fee || 500}</div>
                  </div>
                </div>
              </div>

              {/* Consultation Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Appointment Type</label>
                  <select
                    className="form-control"
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                  >
                    <option value="GENERAL">General Routine</option>
                    <option value="SPECIALIST">Specialist Consultation</option>
                    <option value="FOLLOW_UP">Follow-up Visit</option>
                    <option value="EMERGENCY">Emergency Care</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Chief Complaint / Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Chest tightness, regular check"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookModal(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleConfirmAppointment}
                  disabled={bookingSubmitting}
                >
                  <CheckCircle2 size={16} /> {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title={`Reschedule Appointment #${selectedAppt?.appointment_number}`}
      >
        <form onSubmit={handleReschedule}>
          <div className="form-group">
            <label className="form-label">New Appointment Date *</label>
            <input
              type="date"
              className="form-control"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Time Slot *</label>
            <select
              className="form-control"
              value={rescheduleSlot}
              onChange={(e) => setRescheduleSlot(e.target.value)}
              required
            >
              <option value="09:00 AM">09:00 AM</option>
              <option value="09:30 AM">09:30 AM</option>
              <option value="10:00 AM">10:00 AM</option>
              <option value="10:30 AM">10:30 AM</option>
              <option value="11:00 AM">11:00 AM</option>
              <option value="11:30 AM">11:30 AM</option>
              <option value="02:00 PM">02:00 PM</option>
              <option value="02:30 PM">02:30 PM</option>
              <option value="03:00 PM">03:00 PM</option>
              <option value="03:30 PM">03:30 PM</option>
              <option value="04:00 PM">04:00 PM</option>
              <option value="04:30 PM">04:30 PM</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowRescheduleModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save New Schedule</button>
          </div>
        </form>
      </Modal>

      {/* AI Smart Slot Scheduler */}
      <AISchedulingModal
        isOpen={showAIScheduler}
        onClose={() => setShowAIScheduler(false)}
        doctors={doctors}
        onSelectSlot={async (slot) => {
          try {
            await api.createAppointment({
              doctor_id: slot.doctor_id,
              patient_id: user?.role === 'PATIENT' ? undefined : (patients[0]?.id || 1),
              department: slot.specialization,
              appointment_date: slot.appointment_date,
              time_slot: slot.time_slot,
              ai_suggested: 'YES',
              chief_complaint: 'Scheduled via AI Smart Recommender'
            });
            alert(`Appointment successfully confirmed with ${slot.doctor_name} at ${slot.time_slot} on ${slot.appointment_date}!`);
            await loadData(true);
          } catch (err) {
            alert(err.message || 'Failed to book slot.');
          }
        }}
      />

      {/* Universal Patient QR Scanner Modal for Booking */}
      <Modal
        isOpen={showQRBookModal}
        onClose={() => setShowQRBookModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="APPOINTMENT"
          title="Scan Patient QR"
          customActionLabel="Select Doctor & Book for This Patient"
          onCustomAction={(patientData) => {
            setBookingPatientId(patientData.patient_id);
            setShowQRBookModal(false);
            setBookingStep(1); // Start 5-step wizard with this patient identified
            setShowBookModal(true);
          }}
          onCancel={() => setShowQRBookModal(false)}
        />
      </Modal>
    </div>
  );
};
