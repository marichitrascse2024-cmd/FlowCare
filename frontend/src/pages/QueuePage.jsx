import React, { useState, useEffect } from 'react';
import { Clock, Users, Activity, CheckCircle2, UserCheck, Play, SkipForward, XCircle, RefreshCw, UserPlus, Sparkles, Building2, User, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TokenDisplay } from '../components/TokenDisplay';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { api } from '../services/api';

export const QueuePage = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  // Check-In Modal for front-desk / walk-in from Queue screen
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showQRQueueModal, setShowQRQueueModal] = useState(false);
  const [checkInDepartment, setCheckInDepartment] = useState('All Departments');
  const [checkInDoctorId, setCheckInDoctorId] = useState('');
  const [checkInPatientId, setCheckInPatientId] = useState('');
  const [checkInPriority, setCheckInPriority] = useState('NORMAL');

  const loadQueue = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const params = {};
      if (doctorFilter) params.doctor_id = doctorFilter;

      const [qData, docsData, patsData] = await Promise.all([
        api.getQueue(params),
        api.getDoctors(),
        user?.role !== 'PATIENT' ? api.getPatients() : Promise.resolve([])
      ]);
      setQueue(qData);
      setDoctors(docsData);
      setPatients(patsData);
    } catch (err) {
      console.error('Failed to load queue data:', err);
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
    loadQueue();
    const interval = setInterval(() => loadQueue(false), 6000); // 6s background sync
    return () => clearInterval(interval);
  }, [doctorFilter]);

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

  // Doctors filtered by check-in department
  const checkInFilteredDoctors = checkInDepartment !== 'All Departments'
    ? doctors.filter(d => d.specialization === checkInDepartment)
    : doctors;

  // Queue entries filtered by department
  const filteredQueue = queue.filter(q => {
    if (departmentFilter !== 'All Departments') {
      const dep = q.department || q.doctor_specialization;
      if (dep !== departmentFilter) return false;
    }
    return true;
  });

  const handleAdvance = async (docId) => {
    setAdvancing(true);
    try {
      const res = await api.advanceQueue(docId);
      alert(res.message || 'Queue advanced successfully.');
      await loadQueue(true);
    } catch (err) {
      alert(err.message || 'Failed to advance queue.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleUpdateStatus = async (queueId, newStatus) => {
    try {
      await api.updateQueueStatus(queueId, { status: newStatus });
      await loadQueue(true);
    } catch (err) {
      alert(err.message || 'Status update failed.');
    }
  };

  const handlePerformCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInDoctorId) {
      alert('Please select an assigned doctor.');
      return;
    }
    try {
      const res = await api.checkIn({
        patient_id: parseInt(checkInPatientId),
        doctor_id: parseInt(checkInDoctorId),
        priority: checkInPriority
      });
      alert(`Patient checked in! Token: ${res.token_number} (Position #${res.queue_position})`);
      setShowCheckInModal(false);
      await loadQueue(true);
    } catch (err) {
      alert(err.message || 'Failed to check in patient.');
    }
  };

  // Identify logged-in patient's own queue token entry
  const myToken = queue.find(q => 
    user && (
      (user.patient_id && q.patient_id === user.patient_id) ||
      (user.patient_code && q.patient_code === user.patient_code) ||
      (user.role === 'PATIENT' && q.patient_name === user.full_name)
    )
  );

  // Find currently consulting and next waiting
  const activeConsultation = filteredQueue.find(q => q.status === 'IN_CONSULTATION');
  const nextWaiting = filteredQueue.find(q => q.status === 'WAITING' || q.status === 'CALLED');
  const waitingEntries = filteredQueue.filter(q => q.status === 'WAITING' || q.status === 'CALLED');
  const waitingCount = waitingEntries.length;
  
  const avgWait = waitingEntries.length > 0
    ? Math.round(waitingEntries.reduce((acc, q) => acc + (q.estimated_wait_time ?? q.estimated_wait_minutes ?? 0), 0) / waitingEntries.length)
    : (activeConsultation ? 15 : 0);

  const selectedDoctorObj = doctors.find(d => d.id === parseInt(doctorFilter));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Live Hospital Queue Management</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Real-time token tracking across all departments, triage priority handling, and AI waiting times</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {user?.role !== 'PATIENT' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowQRQueueModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7' }}
            >
              <QrCode size={14} /> Scan Patient QR
            </button>
          )}
          {user?.role !== 'PATIENT' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCheckInModal(true)}>
              <UserPlus size={14} /> Check-In Patient
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadQueue(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Board'}
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* MY TOKEN: Patient's Own Live Queue Card */}
      {myToken && (
        <div 
          className="card" 
          style={{ 
            background: 'linear-gradient(135deg, #0f172a, #1e293b)', 
            color: '#ffffff', 
            borderColor: '#38bdf8', 
            borderWidth: '2px', 
            marginBottom: '1.75rem', 
            boxShadow: '0 10px 25px rgba(14, 165, 233, 0.15)' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                <Activity size={16} /> MY TOKEN
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontSize: '2.75rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                  {myToken.token_number}
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                  YOU
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.6rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>Doctor: <strong style={{ color: '#ffffff' }}>{myToken.doctor_name}</strong></span>
                <span>Department: <strong style={{ color: '#38bdf8' }}>{myToken.department || myToken.doctor_specialization || 'General Medicine'}</strong></span>
                {myToken.room_number && <span>Room: <strong style={{ color: '#ffffff' }}>{myToken.room_number}</strong></span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Position</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                  {myToken.status === 'IN_CONSULTATION' ? 'Inside Room' : `#${myToken.queue_position}`}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Patients Ahead</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                  {myToken.status === 'IN_CONSULTATION' ? 0 : Math.max(0, (myToken.queue_position || 1) - 1)}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>AI Estimated Wait</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>
                  {myToken.status === 'IN_CONSULTATION' ? 'Active' : `~${myToken.estimated_wait_time ?? myToken.estimated_wait_minutes} mins`}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Status</div>
                <Badge status={myToken.status} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Waiting Room Ticker */}
      <TokenDisplay
        currentToken={activeConsultation?.token_number}
        nextToken={nextWaiting?.token_number}
        waitingCount={waitingCount}
        avgWait={avgWait}
        roomNumber={activeConsultation?.room_number || selectedDoctorObj?.room_number || 'OPD'}
      />

      {/* Filter / Doctor Selector */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Department Filter</label>
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
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Doctor Clinic Filter</label>
            <select
              className="form-control"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="">All Hospital Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.specialization} — {d.room_number})</option>
              ))}
            </select>
          </div>

          {user?.role !== 'PATIENT' && doctors.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', height: '38px' }}
                onClick={() => handleAdvance(doctorFilter ? parseInt(doctorFilter) : (user?.doctor_id || doctors[0].id))}
                disabled={advancing}
              >
                <UserCheck size={14} /> {advancing ? 'Advancing...' : 'Admit / Advance Next Token'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Complete Active Live Queue Lineup Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Users size={18} color="#0284c7" />
            Live Queue Lineup
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Complete active hospital queue updated dynamically from database</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Position</th>
                <th>AI Est. Wait</th>
                <th>Priority</th>
                <th>Status</th>
                {user?.role !== 'PATIENT' && <th>Queue Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((q) => {
                const isCurrentUser = user && (
                  (user.patient_id && q.patient_id === user.patient_id) ||
                  (user.patient_code && q.patient_code === user.patient_code) ||
                  (user.role === 'PATIENT' && q.patient_name === user.full_name)
                );

                return (
                  <tr 
                    key={q.id} 
                    style={{ 
                      background: isCurrentUser ? '#eff6ff' : (q.status === 'IN_CONSULTATION' ? '#f0fdf4' : 'transparent'),
                      borderLeft: isCurrentUser ? '4px solid #0284c7' : 'none'
                    }}
                  >
                    <td>
                      <strong style={{ fontSize: '1.1rem', color: isCurrentUser ? '#0369a1' : (q.status === 'IN_CONSULTATION' ? '#166534' : '#0284c7'), fontFamily: 'var(--font-heading)' }}>
                        {q.token_number}
                      </strong>
                    </td>
                    <td>
                      {isCurrentUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ background: '#0284c7', color: 'white', fontWeight: 800, fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            YOU
                          </span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>({q.patient_name})</span>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#334155' }}>{q.patient_name}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{q.doctor_name}</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{q.room_number || 'Room 101'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>
                        {q.department || q.doctor_specialization || 'General Medicine'}
                      </span>
                    </td>
                    <td>
                      {q.status === 'IN_CONSULTATION' ? (
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>Inside Room</span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>#{q.queue_position}</span>
                      )}
                    </td>
                    <td>
                      {q.status === 'IN_CONSULTATION' ? (
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>--</span>
                      ) : (
                        <strong style={{ color: '#0284c7' }}>~{q.estimated_wait_time ?? q.estimated_wait_minutes} min</strong>
                      )}
                    </td>
                    <td><Badge status={q.priority} /></td>
                    <td><Badge status={q.status} /></td>
                    {user?.role !== 'PATIENT' && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {q.status === 'WAITING' && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                onClick={() => handleUpdateStatus(q.id, 'CALLED')}
                                title="Call Patient"
                              >
                                Call
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                onClick={() => handleUpdateStatus(q.id, 'IN_CONSULTATION')}
                                title="Admit to Consultation"
                              >
                                Admit
                              </button>
                            </>
                          )}
                          {q.status === 'CALLED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                              onClick={() => handleUpdateStatus(q.id, 'IN_CONSULTATION')}
                              title="Admit to Consultation"
                            >
                              Admit
                            </button>
                          )}
                          {q.status !== 'COMPLETED' && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                onClick={() => handleUpdateStatus(q.id, 'COMPLETED')}
                                title="Mark Complete (Removes from Live Queue)"
                              >
                                Done
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: '#f59e0b' }}
                                onClick={() => handleUpdateStatus(q.id, 'SKIPPED')}
                                title="Skip Patient"
                              >
                                Skip
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredQueue.length === 0 && (
                <tr>
                  <td colSpan={user?.role !== 'PATIENT' ? 9 : 8} style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                    No patients currently waiting in the clinic queue for the selected department.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check-In Modal */}
      <Modal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        title="Check-In Patient & Issue Live Queue Token"
      >
        <form onSubmit={handlePerformCheckIn}>
          <div className="form-group">
            <label className="form-label">Patient *</label>
            <select
              className="form-control"
              value={checkInPatientId}
              onChange={(e) => setCheckInPatientId(e.target.value)}
              required
            >
              <option value="">Select Patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select
              className="form-control"
              value={checkInDepartment}
              onChange={(e) => {
                setCheckInDepartment(e.target.value);
                setCheckInDoctorId('');
              }}
            >
              {allDepartmentsList.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Doctor *</label>
            <select
              className="form-control"
              value={checkInDoctorId}
              onChange={(e) => setCheckInDoctorId(e.target.value)}
              required
            >
              <option value="">{checkInDepartment !== 'All Departments' ? `Select ${checkInDepartment} Doctor` : 'Select Doctor'}</option>
              {checkInFilteredDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.specialization} — {d.room_number})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Triage Priority</label>
            <select
              className="form-control"
              value={checkInPriority}
              onChange={(e) => setCheckInPriority(e.target.value)}
            >
              <option value="NORMAL">Normal Routine</option>
              <option value="URGENT">Urgent Care</option>
              <option value="EMERGENCY">Emergency (Highest Priority)</option>
              <option value="ELDERLY">Elderly / Senior Care</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Generate Token & Add to Live Queue</button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Queue */}
      <Modal
        isOpen={showQRQueueModal}
        onClose={() => setShowQRQueueModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="QUEUE"
          title="Scan Patient QR"
          customActionLabel="Check-In / Assign Token for This Patient"
          onCustomAction={(patientData) => {
            setShowQRQueueModal(false);
            setCheckInPatientId(patientData.patient_id.toString());
            setShowCheckInModal(true);
          }}
          onCancel={() => setShowQRQueueModal(false)}
        />
      </Modal>
    </div>
  );
};
