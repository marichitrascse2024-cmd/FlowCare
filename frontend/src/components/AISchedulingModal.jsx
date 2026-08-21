import React, { useState } from 'react';
import { Calendar, Clock, Sparkles, UserCheck, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../services/api';

export const AISchedulingModal = ({ isOpen, onClose, onSelectSlot, doctors = [] }) => {
  const [department, setDepartment] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('ANY');
  const [urgency, setUrgency] = useState('NORMAL');
  
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState('');

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
  const allDepartments = Array.from(new Set([...knownDepartments, ...dynamicDepartments]));

  // Filter doctors by selected department
  const filteredDoctors = department
    ? doctors.filter(d => d.specialization === department)
    : doctors;

  const handleFetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.suggestSlots({
        doctor_id: doctorId ? parseInt(doctorId) : undefined,
        specialization: department || undefined,
        preferred_date: preferredDate || undefined,
        preferred_time_of_day: timeOfDay,
        urgency: urgency
      });
      setRecommendations(res.recommendations || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve slot suggestions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotPick = (slot) => {
    if (onSelectSlot) {
      onSelectSlot(slot);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles color="#0ea5e9" size={20} />
          <span>AI-Assisted Appointment Scheduling</span>
        </div>
      }
      size="lg"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>Department</label>
            <select
              className="form-control"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setDoctorId('');
              }}
            >
              <option value="">All Departments</option>
              {allDepartments.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>Doctor</label>
            <select
              className="form-control"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">{department ? `Any ${department} Doctor` : 'Any Available Doctor'}</option>
              {filteredDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.specialization} — ₹{d.consultation_fee})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>Target Date</label>
            <input
              type="date"
              className="form-control"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>Time Preference</label>
            <select
              className="form-control"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
            >
              <option value="ANY">Any Time</option>
              <option value="MORNING">Morning (09:00 - 12:00)</option>
              <option value="AFTERNOON">Afternoon (14:00 - 16:00)</option>
              <option value="EVENING">Evening (16:00 - 18:00)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
          <button 
            className="btn btn-ai" 
            onClick={handleFetchRecommendations}
            disabled={loading}
          >
            <Sparkles size={16} />
            {loading ? 'Finding Optimal Slots...' : 'Find Recommended Slots'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {recommendations.length > 0 ? (
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
              Top AI-Ranked Available Slots ({recommendations.length})
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {recommendations.map((slot, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.2s',
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={16} />
                        {slot.time_slot}
                      </span>
                      <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                        ₹{slot.consultation_fee}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                      {slot.doctor_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      {slot.specialization} • {slot.room_number} • {slot.appointment_date}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#475569', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', lineHeight: 1.3 }}>
                      <strong>AI Optimization:</strong> {slot.reason}
                    </p>
                  </div>

                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '0.75rem', width: '100%' }}
                    onClick={() => handleSlotPick(slot)}
                  >
                    <CheckCircle2 size={14} />
                    Select This Slot
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
            <Calendar size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.9rem' }}>Click <strong>Find Recommended Slots</strong> to receive conflict-free, workload-balanced appointment suggestions across all departments.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
