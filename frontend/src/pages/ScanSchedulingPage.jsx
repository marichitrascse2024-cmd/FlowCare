import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  RefreshCw, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  Eye, 
  X, 
  User, 
  Stethoscope, 
  Layers, 
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { api } from '../services/api';

// Helper function to format duration in user-friendly format
const formatDuration = (mins) => {
  if (mins === undefined || mins === null || isNaN(mins)) return '30 minutes';
  const minutes = parseInt(mins, 10);
  const hours = Math.floor(minutes / 60);
  const remainderMins = minutes % 60;
  if (hours === 0) return `${remainderMins} minutes`;
  if (remainderMins === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainderMins} minutes`;
};

// Scan Type Options
const SCAN_TYPES = ['MRI', 'CT Scan', 'X-Ray', 'Ultrasound', 'PET Scan'];

// Status Options
const SCAN_STATUSES = ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];

export const ScanSchedulingPage = () => {
  const { user } = useAuth();
  const role = user?.role || 'PATIENT';

  // Core Data States
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dropdown Lists for Staff
  const [patientsList, setPatientsList] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [scanTypeFilter, setScanTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [selectedScan, setSelectedScan] = useState(null);

  // Booking Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [bookingForm, setBookingForm] = useState({
    patient_id: '',
    scan_type: 'MRI',
    body_part: '',
    scan_date: todayStr,
    time_slot: '',
    doctor_id: '',
    radiologist_technician: '',
    estimated_duration_minutes: 30,
    instructions: ''
  });
  const [bookingSlots, setBookingSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState(todayStr);
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);

  // Update Status/Details Form State
  const [updateForm, setUpdateForm] = useState({
    status: 'Scheduled',
    estimated_duration_minutes: 30,
    radiologist_technician: '',
    doctor_id: '',
    instructions: '',
    findings_summary: ''
  });

  // Action Pending State
  const [submitting, setSubmitting] = useState(false);

  // Load Scan Schedules
  const loadSchedules = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setError('');
    }
    try {
      const data = await api.getScanSchedules();
      setSchedules(data || []);
    } catch (err) {
      console.error('Failed to fetch scan schedules:', err);
      setError(err.message || 'Failed to load scan schedules.');
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
  };

  // Load Patients and Doctors for Staff dropdowns
  const loadDropdowns = async () => {
    if (['ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR'].includes(role)) {
      try {
        const docs = await api.getDoctors();
        setDoctorsList(docs || []);
      } catch (err) {
        console.error('Failed to load doctors list:', err);
      }
    }
    if (['ADMIN', 'RECEPTIONIST'].includes(role)) {
      try {
        const pts = await api.getPatients();
        setPatientsList(pts || []);
      } catch (err) {
        console.error('Failed to load patients list:', err);
      }
    }
  };

  useEffect(() => {
    loadSchedules();
    loadDropdowns();
  }, []);

  // Fetch Available Slots for Booking Form
  const fetchBookingSlots = async (dateVal, scanTypeVal) => {
    if (!dateVal) return;
    setLoadingSlots(true);
    try {
      const data = await api.getScanSlots(dateVal, scanTypeVal);
      const slotsList = data.slots || [];
      setBookingSlots(slotsList);
      // Auto select first available slot if current slot isn't available
      const availables = slotsList.filter(s => s.available);
      if (availables.length > 0) {
        setBookingForm(prev => {
          if (!prev.time_slot || !slotsList.find(s => s.time_slot === prev.time_slot && s.available)) {
            return { ...prev, time_slot: availables[0].time_slot };
          }
          return prev;
        });
      } else {
        setBookingForm(prev => ({ ...prev, time_slot: '' }));
      }
    } catch (err) {
      console.error('Error loading scan slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch Slots when Date or Scan Type changes in Booking Form
  useEffect(() => {
    if (showBookingModal) {
      fetchBookingSlots(bookingForm.scan_date, bookingForm.scan_type);
    }
  }, [bookingForm.scan_date, bookingForm.scan_type, showBookingModal]);

  // Fetch Available Slots for Reschedule Form
  const fetchRescheduleSlots = async (dateVal, scanTypeVal) => {
    if (!dateVal) return;
    setLoadingRescheduleSlots(true);
    try {
      const data = await api.getScanSlots(dateVal, scanTypeVal);
      const slotsList = data.slots || [];
      setRescheduleSlots(slotsList);
      const availables = slotsList.filter(s => s.available);
      if (availables.length > 0) {
        setRescheduleSlot(prev => {
          if (!prev || !slotsList.find(s => s.time_slot === prev && s.available)) {
            return availables[0].time_slot;
          }
          return prev;
        });
      } else {
        setRescheduleSlot('');
      }
    } catch (err) {
      console.error('Error loading reschedule slots:', err);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  useEffect(() => {
    if (showRescheduleModal && selectedScan) {
      fetchRescheduleSlots(rescheduleDate, selectedScan.scan_type);
    }
  }, [rescheduleDate, showRescheduleModal, selectedScan]);

  // Handlers for Opening Modals
  const handleOpenBooking = () => {
    setBookingForm({
      patient_id: role === 'PATIENT' ? (user?.patient_id || '') : '',
      scan_type: 'MRI',
      body_part: '',
      scan_date: todayStr,
      time_slot: '',
      doctor_id: '',
      radiologist_technician: '',
      estimated_duration_minutes: 30,
      instructions: ''
    });
    setError('');
    setSuccessMsg('');
    setShowBookingModal(true);
  };

  const handleOpenReschedule = (scan) => {
    setSelectedScan(scan);
    setRescheduleDate(scan.scan_date || todayStr);
    setRescheduleSlot(scan.time_slot || '');
    setError('');
    setSuccessMsg('');
    setShowRescheduleModal(true);
  };

  const handleOpenUpdate = (scan) => {
    setSelectedScan(scan);
    setUpdateForm({
      status: scan.status || 'Scheduled',
      estimated_duration_minutes: scan.estimated_duration_minutes || 30,
      radiologist_technician: scan.radiologist_technician || '',
      doctor_id: scan.doctor_id || '',
      instructions: scan.instructions || '',
      findings_summary: scan.findings_summary || ''
    });
    setError('');
    setSuccessMsg('');
    setShowUpdateModal(true);
  };

  const handleOpenCancel = (scan) => {
    setSelectedScan(scan);
    setError('');
    setSuccessMsg('');
    setShowCancelModal(true);
  };

  const handleOpenReport = (scan) => {
    setSelectedScan(scan);
    setShowReportModal(true);
  };

  // Submit Booking Form
  const handleCreateScan = async (e) => {
    e.preventDefault();
    if (!bookingForm.time_slot) {
      alert('Please select an available time slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        scan_type: bookingForm.scan_type,
        body_part: bookingForm.body_part.trim() || undefined,
        scan_date: bookingForm.scan_date,
        time_slot: bookingForm.time_slot,
        estimated_duration_minutes: parseInt(bookingForm.estimated_duration_minutes, 10) || 30,
        instructions: bookingForm.instructions.trim() || undefined
      };

      if (['ADMIN', 'RECEPTIONIST'].includes(role)) {
        if (!bookingForm.patient_id) {
          alert('Please select a patient for this scan.');
          setSubmitting(false);
          return;
        }
        payload.patient_id = parseInt(bookingForm.patient_id, 10);
        if (bookingForm.doctor_id) {
          payload.doctor_id = parseInt(bookingForm.doctor_id, 10);
        }
        if (bookingForm.radiologist_technician) {
          payload.radiologist_technician = bookingForm.radiologist_technician.trim();
        }
      } else if (role === 'PATIENT') {
        if (bookingForm.doctor_id) {
          payload.doctor_id = parseInt(bookingForm.doctor_id, 10);
        }
      }

      await api.createScanSchedule(payload);
      setSuccessMsg('Scan appointment booked successfully!');
      setShowBookingModal(false);
      await loadSchedules();
    } catch (err) {
      console.error('Failed to create scan schedule:', err);
      setError(err.message || 'Failed to book scan schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Reschedule Form
  const handleRescheduleScan = async (e) => {
    e.preventDefault();
    if (!selectedScan || !rescheduleSlot) {
      alert('Please select a valid time slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.updateScanSchedule(selectedScan.id, {
        scan_date: rescheduleDate,
        time_slot: rescheduleSlot
      });
      setSuccessMsg(`Scan ${selectedScan.scan_number} rescheduled successfully.`);
      setShowRescheduleModal(false);
      await loadSchedules();
    } catch (err) {
      console.error('Failed to reschedule scan:', err);
      setError(err.message || 'Failed to reschedule scan appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Update Details Form
  const handleUpdateScanDetails = async (e) => {
    e.preventDefault();
    if (!selectedScan) return;
    setSubmitting(true);
    setError('');
    try {
      const updateData = {};
      
      if (['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN'].includes(role)) {
        if (updateForm.status) updateData.status = updateForm.status;
        if (updateForm.estimated_duration_minutes) {
          updateData.estimated_duration_minutes = parseInt(updateForm.estimated_duration_minutes, 10);
        }
      }

      if (['RECEPTIONIST', 'NURSE', 'ADMIN'].includes(role)) {
        if (updateForm.radiologist_technician !== undefined) {
          updateData.radiologist_technician = updateForm.radiologist_technician.trim() || null;
        }
        if (updateForm.instructions !== undefined) {
          updateData.instructions = updateForm.instructions.trim() || null;
        }
      }

      if (['RECEPTIONIST', 'ADMIN'].includes(role)) {
        if (updateForm.doctor_id) {
          updateData.doctor_id = parseInt(updateForm.doctor_id, 10);
        }
      }

      if (['DOCTOR', 'ADMIN'].includes(role)) {
        if (updateForm.findings_summary !== undefined) {
          updateData.findings_summary = updateForm.findings_summary.trim() || null;
        }
      }

      await api.updateScanSchedule(selectedScan.id, updateData);
      setSuccessMsg(`Scan ${selectedScan.scan_number} updated successfully.`);
      setShowUpdateModal(false);
      await loadSchedules();
    } catch (err) {
      console.error('Failed to update scan details:', err);
      setError(err.message || 'Failed to update scan schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Cancellation
  const handleCancelScan = async () => {
    if (!selectedScan) return;
    setSubmitting(true);
    setError('');
    try {
      await api.cancelScanSchedule(selectedScan.id);
      setSuccessMsg(`Scan ${selectedScan.scan_number} has been cancelled.`);
      setShowCancelModal(false);
      await loadSchedules();
    } catch (err) {
      console.error('Failed to cancel scan:', err);
      setError(err.message || 'Failed to cancel scan schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering Logic
  const filteredSchedules = schedules.filter((scan) => {
    if (scanTypeFilter !== 'ALL' && scan.scan_type !== scanTypeFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && scan.status !== statusFilter) {
      return false;
    }
    if (dateFilter && scan.scan_date !== dateFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = scan.scan_number?.toLowerCase().includes(q);
      const matchPat = scan.patient_name?.toLowerCase().includes(q);
      const matchCode = scan.patient_code?.toLowerCase().includes(q);
      const matchDoc = scan.doctor_name?.toLowerCase().includes(q);
      const matchBody = scan.body_part?.toLowerCase().includes(q);
      const matchTech = scan.radiologist_technician?.toLowerCase().includes(q);
      if (!matchNum && !matchPat && !matchCode && !matchDoc && !matchBody && !matchTech) {
        return false;
      }
    }
    return true;
  });

  // Action Permissions
  const canBook = ['PATIENT', 'RECEPTIONIST', 'ADMIN'].includes(role);
  const canReschedule = (scan) => {
    if (scan.status === 'Cancelled' || scan.status === 'Completed') return false;
    if (role === 'PATIENT' || role === 'RECEPTIONIST' || role === 'ADMIN') return true;
    return false;
  };
  const canCancel = (scan) => {
    if (scan.status === 'Cancelled' || scan.status === 'Completed') return false;
    if (role === 'PATIENT' || role === 'RECEPTIONIST' || role === 'ADMIN') return true;
    return false;
  };
  const canUpdate = ['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN'].includes(role);

  return (
    <div>
      {/* Top Banner Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Activity color="#0284c7" size={28} />
            Scan Scheduling & Diagnostics
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {role === 'PATIENT'
              ? 'Schedule, track and view reports for your MRI, CT, X-Ray, Ultrasound & PET scans'
              : 'Manage diagnostic imaging appointments, time slots, radiological technicians & reports'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadSchedules(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh List'}
          </button>

          {canBook && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenBooking} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Book Scan Appointment
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Feedback Banners */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '0.75rem 1rem', background: '#d1fae5', borderLeft: '4px solid #10b981', color: '#065f46', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Control Toolbar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Search Scans</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search number, patient, doctor, body part..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Scan Type</label>
            <select
              className="form-control"
              value={scanTypeFilter}
              onChange={(e) => setScanTypeFilter(e.target.value)}
            >
              <option value="ALL">All Scan Types</option>
              {SCAN_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Status</label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {SCAN_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Date</label>
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', height: '38px' }}
              onClick={() => {
                setSearch('');
                setScanTypeFilter('ALL');
                setStatusFilter('ALL');
                setDateFilter('');
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Counter Summary */}
      <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
        Showing <strong>{filteredSchedules.length}</strong> of <strong>{schedules.length}</strong> scan appointments
      </div>

      {/* Main Scan Schedules Data Table / Cards */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#0284c7', fontWeight: 600 }}>
          Loading diagnostic scan appointments...
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#94a3b8' }}>
          <Activity size={48} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
          <h4 style={{ color: '#475569', fontWeight: 700, marginBottom: '0.25rem' }}>No Scan Schedules Found</h4>
          <p style={{ fontSize: '0.875rem' }}>
            {role === 'PATIENT' 
              ? "You don't have any diagnostic scan appointments scheduled yet." 
              : "No diagnostic scans match your selected filter criteria."}
          </p>
          {canBook && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleOpenBooking}
              style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={14} /> Book First Scan
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Scan Number</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Patient</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Doctor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Scan Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Body Part</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date & Time</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Est. Duration</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.875rem' }}>
                {filteredSchedules.map((scan) => (
                  <tr key={scan.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#0284c7' }}>
                      {scan.scan_number}
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{scan.patient_name || 'Patient'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {scan.patient_code ? `ID: ${scan.patient_code}` : ''}
                      </div>
                    </td>

                    <td style={{ padding: '1rem', color: '#334155' }}>
                      {scan.doctor_name ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{scan.doctor_name}</div>
                          {scan.doctor_specialization && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{scan.doctor_specialization}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: '#e0f2fe', 
                        color: '#0369a1', 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '6px', 
                        fontWeight: 700,
                        fontSize: '0.775rem'
                      }}>
                        {scan.scan_type}
                      </span>
                    </td>

                    <td style={{ padding: '1rem', color: '#334155', fontWeight: 500 }}>
                      {scan.body_part || 'Full Body / General'}
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{scan.scan_date}</div>
                      <div style={{ fontSize: '0.775rem', color: '#0284c7', fontWeight: 600 }}>{scan.time_slot}</div>
                    </td>

                    <td style={{ padding: '1rem', color: '#475569', fontSize: '0.825rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={14} color="#64748b" />
                        <span>{formatDuration(scan.estimated_duration_minutes)}</span>
                      </div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <Badge status={scan.status} />
                      {scan.radiologist_technician && (
                        <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Tech: {scan.radiologist_technician}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {/* Report View Button */}
                        {(scan.findings_summary || scan.status === 'Completed' || role === 'DOCTOR') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenReport(scan)}
                            title="View Scan Report & Findings"
                          >
                            <FileText size={14} color="#0284c7" /> View Report
                          </button>
                        )}

                        {/* Staff Update Details Button */}
                        {canUpdate && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenUpdate(scan)}
                            title="Update Status / Technician / Findings"
                          >
                            <Edit3 size={14} color="#475569" /> Update
                          </button>
                        )}

                        {/* Reschedule Button */}
                        {canReschedule(scan) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenReschedule(scan)}
                            title="Reschedule Scan Date / Time Slot"
                          >
                            <Clock size={14} color="#0284c7" /> Reschedule
                          </button>
                        )}

                        {/* Cancel Button */}
                        {canCancel(scan) && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenCancel(scan)}
                            title="Cancel Scan Appointment"
                          >
                            <X size={14} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. BOOKING MODAL */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Book Diagnostic Scan Appointment"
        size="lg"
      >
        <form onSubmit={handleCreateScan}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            {/* Patient Selection */}
            {role === 'PATIENT' ? (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Patient Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={`${user?.full_name || 'Patient'} ${user?.patient_code ? `(${user.patient_code})` : ''}`}
                  disabled
                  style={{ background: '#f1f5f9', fontWeight: 600 }}
                />
              </div>
            ) : (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Select Patient *</label>
                <select
                  className="form-control"
                  value={bookingForm.patient_id}
                  onChange={(e) => setBookingForm({ ...bookingForm, patient_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patientsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_code || `ID: ${p.id}`}) - {p.phone || ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scan Type */}
            <div className="form-group">
              <label className="form-label">Scan Type *</label>
              <select
                className="form-control"
                value={bookingForm.scan_type}
                onChange={(e) => setBookingForm({ ...bookingForm, scan_type: e.target.value })}
                required
              >
                {SCAN_TYPES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Body Part */}
            <div className="form-group">
              <label className="form-label">Target Body Part</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Chest, Brain, Knee, Abdomen"
                value={bookingForm.body_part}
                onChange={(e) => setBookingForm({ ...bookingForm, body_part: e.target.value })}
              />
            </div>

            {/* Scan Date */}
            <div className="form-group">
              <label className="form-label">Scan Date *</label>
              <input
                type="date"
                className="form-control"
                value={bookingForm.scan_date}
                onChange={(e) => setBookingForm({ ...bookingForm, scan_date: e.target.value })}
                required
              />
            </div>

            {/* Doctor Selection (Optional) */}
            <div className="form-group">
              <label className="form-label">Referring Doctor (Optional)</label>
              <select
                className="form-control"
                value={bookingForm.doctor_id}
                onChange={(e) => setBookingForm({ ...bookingForm, doctor_id: e.target.value })}
              >
                <option value="">-- None / General Request --</option>
                {doctorsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            {/* Available Time Slots */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Available Time Slots for {bookingForm.scan_date} *</label>
              {loadingSlots ? (
                <div style={{ fontSize: '0.85rem', color: '#0284c7', padding: '0.5rem 0' }}>
                  Checking slot availability...
                </div>
              ) : bookingSlots.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#ef4444', padding: '0.5rem 0' }}>
                  No time slots available for this date.
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', 
                  gap: '0.5rem', 
                  maxHeight: '140px', 
                  overflowY: 'auto',
                  padding: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  {bookingSlots.map((s) => (
                    <button
                      key={s.time_slot}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setBookingForm({ ...bookingForm, time_slot: s.time_slot })}
                      style={{
                        padding: '0.4rem 0.25rem',
                        fontSize: '0.775rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: bookingForm.time_slot === s.time_slot ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: bookingForm.time_slot === s.time_slot 
                          ? '#e0f2fe' 
                          : s.available ? '#ffffff' : '#f1f5f9',
                        color: s.available ? (bookingForm.time_slot === s.time_slot ? '#0369a1' : '#1e293b') : '#94a3b8',
                        cursor: s.available ? 'pointer' : 'not-allowed',
                        textDecoration: s.available ? 'none' : 'line-through'
                      }}
                    >
                      {s.time_slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Staff Options: Technician & Duration */}
            {['ADMIN', 'RECEPTIONIST', 'NURSE'].includes(role) && (
              <>
                <div className="form-group">
                  <label className="form-label">Radiologist / Technician</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Tech. Rahul Verma"
                    value={bookingForm.radiologist_technician}
                    onChange={(e) => setBookingForm({ ...bookingForm, radiologist_technician: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estimated Duration (Minutes)</label>
                  <select
                    className="form-control"
                    value={bookingForm.estimated_duration_minutes}
                    onChange={(e) => setBookingForm({ ...bookingForm, estimated_duration_minutes: e.target.value })}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes (Default)</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hour)</option>
                    <option value={90}>90 minutes (1 hr 30 mins)</option>
                    <option value={120}>120 minutes (2 hours)</option>
                  </select>
                </div>
              </>
            )}

            {/* Instructions / Special Requirements */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Instructions / Clinical Notes</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="e.g. Fasting 4 hours prior, claustrophobia precaution, contrast allergy details..."
                value={bookingForm.instructions}
                onChange={(e) => setBookingForm({ ...bookingForm, instructions: e.target.value })}
              />
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowBookingModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !bookingForm.time_slot}>
              {submitting ? 'Booking...' : 'Confirm Scan Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. RESCHEDULE MODAL */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title={`Reschedule Scan: ${selectedScan?.scan_number || ''}`}
        size="md"
      >
        <form onSubmit={handleRescheduleScan}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
            <div>Patient: <strong>{selectedScan?.patient_name}</strong></div>
            <div>Scan Type: <strong>{selectedScan?.scan_type}</strong> ({selectedScan?.body_part || 'General'})</div>
            <div>Current Appointment: <strong>{selectedScan?.scan_date} at {selectedScan?.time_slot}</strong></div>
          </div>

          <div className="form-group">
            <label className="form-label">New Scan Date *</label>
            <input
              type="date"
              className="form-control"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Available Time Slot *</label>
            {loadingRescheduleSlots ? (
              <div style={{ fontSize: '0.85rem', color: '#0284c7', padding: '0.5rem 0' }}>
                Checking slot availability...
              </div>
            ) : rescheduleSlots.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: '#ef4444', padding: '0.5rem 0' }}>
                No slots available on this date.
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', 
                gap: '0.5rem', 
                maxHeight: '140px', 
                overflowY: 'auto',
                padding: '0.5rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                {rescheduleSlots.map((s) => (
                  <button
                    key={s.time_slot}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setRescheduleSlot(s.time_slot)}
                    style={{
                      padding: '0.4rem 0.25rem',
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: rescheduleSlot === s.time_slot ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: rescheduleSlot === s.time_slot 
                        ? '#e0f2fe' 
                        : s.available ? '#ffffff' : '#f1f5f9',
                      color: s.available ? (rescheduleSlot === s.time_slot ? '#0369a1' : '#1e293b') : '#94a3b8',
                      cursor: s.available ? 'pointer' : 'not-allowed',
                      textDecoration: s.available ? 'none' : 'line-through'
                    }}
                  >
                    {s.time_slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowRescheduleModal(false)}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !rescheduleSlot}>
              {submitting ? 'Updating...' : 'Save New Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. UPDATE DETAILS & STATUS MODAL (For Staff/Doctors) */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title={`Update Scan Details: ${selectedScan?.scan_number || ''}`}
        size="md"
      >
        <form onSubmit={handleUpdateScanDetails}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Status Update */}
            <div className="form-group">
              <label className="form-label">Scan Status</label>
              <select
                className="form-control"
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
              >
                {SCAN_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Estimated Duration */}
            <div className="form-group">
              <label className="form-label">Estimated Scan Duration (Minutes)</label>
              <select
                className="form-control"
                value={updateForm.estimated_duration_minutes}
                onChange={(e) => setUpdateForm({ ...updateForm, estimated_duration_minutes: e.target.value })}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
                <option value={90}>90 minutes (1 hr 30 mins)</option>
                <option value={120}>120 minutes (2 hours)</option>
              </select>
            </div>

            {/* Radiologist / Technician (Nurse, Receptionist, Admin) */}
            {['RECEPTIONIST', 'NURSE', 'ADMIN'].includes(role) && (
              <div className="form-group">
                <label className="form-label">Assign Radiologist / Technician</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tech. Sarah Jenkins"
                  value={updateForm.radiologist_technician}
                  onChange={(e) => setUpdateForm({ ...updateForm, radiologist_technician: e.target.value })}
                />
              </div>
            )}

            {/* Doctor Assignment (Receptionist, Admin) */}
            {['RECEPTIONIST', 'ADMIN'].includes(role) && (
              <div className="form-group">
                <label className="form-label">Assigned Attending Doctor</label>
                <select
                  className="form-control"
                  value={updateForm.doctor_id}
                  onChange={(e) => setUpdateForm({ ...updateForm, doctor_id: e.target.value })}
                >
                  <option value="">-- Select Doctor --</option>
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Instructions (Nurse, Receptionist, Admin) */}
            {['RECEPTIONIST', 'NURSE', 'ADMIN'].includes(role) && (
              <div className="form-group">
                <label className="form-label">Patient Instructions / Prep Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={updateForm.instructions}
                  onChange={(e) => setUpdateForm({ ...updateForm, instructions: e.target.value })}
                />
              </div>
            )}

            {/* Findings / Diagnostic Summary (Doctor, Admin) */}
            {['DOCTOR', 'ADMIN'].includes(role) && (
              <div className="form-group">
                <label className="form-label">Diagnostic Findings & Radiologist Report Summary</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Enter scan findings, observations, radiologist diagnosis..."
                  value={updateForm.findings_summary}
                  onChange={(e) => setUpdateForm({ ...updateForm, findings_summary: e.target.value })}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Update Scan Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. CANCEL CONFIRMATION DIALOG */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Confirm Scan Cancellation"
        size="md"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
            Cancel Scan Appointment {selectedScan?.scan_number}?
          </h4>
          <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Are you sure you want to cancel the <strong>{selectedScan?.scan_type}</strong> scan appointment scheduled for 
            <strong> {selectedScan?.patient_name}</strong> on <strong>{selectedScan?.scan_date} at {selectedScan?.time_slot}</strong>?
            <br />
            This schedule status will be updated to <em>Cancelled</em>.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
              Keep Schedule
            </button>
            <button className="btn btn-danger" onClick={handleCancelScan} disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. REPORT VIEW MODAL */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={`Scan Report & Findings: ${selectedScan?.scan_number || ''}`}
        size="lg"
      >
        {selectedScan && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Patient Information</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{selectedScan.patient_name}</div>
                {selectedScan.patient_code && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Code: {selectedScan.patient_code}</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Attending / Referring Doctor</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{selectedScan.doctor_name || 'Unassigned'}</div>
                {selectedScan.doctor_specialization && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedScan.doctor_specialization}</div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Scan Details</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>
                  {selectedScan.scan_type} - {selectedScan.body_part || 'General'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>Date: {selectedScan.scan_date} ({selectedScan.time_slot})</div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Scan Status & Duration</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge status={selectedScan.status} />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    ({formatDuration(selectedScan.estimated_duration_minutes)})
                  </span>
                </div>
                {selectedScan.radiologist_technician && (
                  <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.25rem' }}>
                    Technician: <strong>{selectedScan.radiologist_technician}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Special Instructions */}
            {selectedScan.instructions && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  Patient Instructions & Preparation
                </h5>
                <div style={{ background: '#ecfeff', borderLeft: '4px solid #06b6d4', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem', color: '#155e75' }}>
                  {selectedScan.instructions}
                </div>
              </div>
            )}

            {/* Radiologist Findings Summary */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Diagnostic Findings & Radiologist Summary
              </h5>
              {selectedScan.findings_summary ? (
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedScan.findings_summary}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  No radiologist findings or diagnostic summary reported yet for this scan.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowReportModal(false)}>
                Close Report
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ScanSchedulingPage;
