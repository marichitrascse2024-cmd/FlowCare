import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Search, MapPin, Clock, DollarSign, Award, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { PasswordInput } from '../components/PasswordInput';
import { api } from '../services/api';

export const DoctorsPage = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // Add Doctor Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [docForm, setDocForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'Doctor@123',
    specialization: 'Cardiology',
    qualification: 'MBBS, MD',
    experience_years: 5,
    consultation_fee: 500.0,
    room_number: 'Room 105',
    biography: ''
  });

  const loadDoctors = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const data = await api.getDoctors();
      setDoctors(data);
    } catch (err) {
      console.error('Failed to load doctors:', err);
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
    loadDoctors();
  }, []);

  // Dynamically extract all available departments from database doctors
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

  // Filtered doctors list
  const filteredDoctors = doctors.filter((doc) => {
    // Department filter
    if (departmentFilter !== 'All Departments' && doc.specialization !== departmentFilter) {
      return false;
    }
    // Availability filter
    if (availabilityFilter === 'AVAILABLE' && !doc.is_available) {
      return false;
    }
    if (availabilityFilter === 'UNAVAILABLE' && doc.is_available) {
      return false;
    }
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = doc.full_name?.toLowerCase().includes(q);
      const matchSpec = doc.specialization?.toLowerCase().includes(q);
      const matchRoom = doc.room_number?.toLowerCase().includes(q);
      const matchQual = doc.qualification?.toLowerCase().includes(q);
      if (!matchName && !matchSpec && !matchRoom && !matchQual) {
        return false;
      }
    }
    return true;
  });

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    try {
      await api.createDoctor({
        ...docForm,
        experience_years: parseInt(docForm.experience_years),
        consultation_fee: parseFloat(docForm.consultation_fee)
      });
      alert('Doctor created successfully!');
      setShowAddModal(false);
      await loadDoctors();
    } catch (err) {
      alert(err.message || 'Failed to create doctor.');
    }
  };

  const handleToggleAvailability = async (doc) => {
    try {
      await api.updateDoctor(doc.id, { is_available: !doc.is_available });
      await loadDoctors();
    } catch (err) {
      alert(err.message || 'Failed to update availability.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Medical Staff & Specialist Directory</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Attending physicians across all hospital departments, consultation fees, and availability</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadDoctors(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Directory'}
          </button>
          {user?.role === 'ADMIN' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Add Doctor Profile
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Search Doctor</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, specialization, room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Department / Specialty</label>
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
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Availability</label>
            <select
              className="form-control"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            >
              <option value="ALL">All Availability</option>
              <option value="AVAILABLE">Available for Consultation</option>
              <option value="UNAVAILABLE">On Leave / Unavailable</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', height: '38px' }}
              onClick={() => {
                setDepartmentFilter('All Departments');
                setAvailabilityFilter('ALL');
                setSearch('');
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Active Count Banner */}
      <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
        Showing <strong>{filteredDoctors.length}</strong> of <strong>{doctors.length}</strong> doctors {departmentFilter !== 'All Departments' ? `in ${departmentFilter}` : 'across all departments'}
      </div>

      {/* Doctor Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredDoctors.map((d) => (
          <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Stethoscope size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{d.full_name}</h4>
                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#0284c7', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {d.specialization}
                    </span>
                  </div>
                </div>

                <span className={`badge ${d.is_available ? 'badge-success' : 'badge-danger'}`}>
                  {d.is_available ? 'Available' : 'On Leave'}
                </span>
              </div>

              <p style={{ fontSize: '0.825rem', color: '#475569', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                {d.qualification} • {d.experience_years} years clinical experience
              </p>

              {d.biography && (
                <p style={{ fontSize: '0.775rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.35, fontStyle: 'italic' }}>
                  "{d.biography}"
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={14} color="#0284c7" /> Room Location: <strong>{d.room_number}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} color="#10b981" /> Working Hours: <strong>09:00 AM - 05:00 PM (Mon-Sat)</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} color="#6366f1" /> Avg Consultation Time: <strong>{d.average_consultation_time} mins</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={14} color="#d97706" /> Consultation Fee: <strong>₹{d.consultation_fee}</strong>
                </div>
              </div>
            </div>

            {user?.role === 'ADMIN' && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className={`btn btn-sm ${d.is_available ? 'btn-secondary' : 'btn-success'}`}
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleToggleAvailability(d)}
                >
                  {d.is_available ? 'Mark as Unavailable' : 'Mark as Available'}
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredDoctors.length === 0 && !loading && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
            <Stethoscope size={44} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ color: '#475569', fontWeight: 600 }}>No doctors found</h4>
            <p style={{ fontSize: '0.85rem' }}>No medical specialists match your selected department or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Add Doctor Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Doctor Clinical Profile"
        size="lg"
      >
        <form onSubmit={handleCreateDoctor}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-control" placeholder="e.g. Dr. Rajesh Sharma" value={docForm.full_name} onChange={(e) => setDocForm({...docForm, full_name: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-control" placeholder="dr.sharma@flowcare.com" value={docForm.email} onChange={(e) => setDocForm({...docForm, email: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-control" placeholder="+91 98400 00201" value={docForm.phone} onChange={(e) => setDocForm({...docForm, phone: e.target.value})} />
            </div>

            <PasswordInput
              label="Doctor Portal Password *"
              name="password"
              value={docForm.password}
              onChange={(e) => setDocForm({...docForm, password: e.target.value})}
              placeholder="••••••••"
              required
            />

            <div className="form-group">
              <label className="form-label">Department / Specialization *</label>
              <input type="text" className="form-control" placeholder="e.g. Cardiology" value={docForm.specialization} onChange={(e) => setDocForm({...docForm, specialization: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Qualification *</label>
              <input type="text" className="form-control" placeholder="e.g. MBBS, MD, DM" value={docForm.qualification} onChange={(e) => setDocForm({...docForm, qualification: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Experience (Years)</label>
              <input type="number" className="form-control" value={docForm.experience_years} onChange={(e) => setDocForm({...docForm, experience_years: parseInt(e.target.value)})} />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Fee (₹) *</label>
              <input type="number" step="0.01" className="form-control" value={docForm.consultation_fee} onChange={(e) => setDocForm({...docForm, consultation_fee: parseFloat(e.target.value)})} required />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Room / Clinic Wing *</label>
              <input type="text" className="form-control" placeholder="e.g. Room 101 (Cardio Wing)" value={docForm.room_number} onChange={(e) => setDocForm({...docForm, room_number: e.target.value})} required />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Doctor Profile</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
