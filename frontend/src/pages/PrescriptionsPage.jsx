import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Pill, Stethoscope, Calendar, User, Printer, RefreshCw, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { api } from '../services/api';

export const PrescriptionsPage = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(user?.patient_id || '');
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [showQRPrescriptionModal, setShowQRPrescriptionModal] = useState(false);

  // New Prescription Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [rxForm, setRxForm] = useState({
    patient_id: '',
    general_instructions: 'Take medications on time after meals with water.',
    dietary_advice: 'Low salt, balanced nutritious diet, adequate hydration.',
    items: [
      { medicine_name: 'Paracetamol 650mg', dosage: '650 mg', frequency: 'As needed for fever/pain (1-0-1)', duration_days: 5, route: 'Oral', special_instructions: 'Take after meals' }
    ]
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
        console.error('Failed to load patients for prescriptions:', err);
      }
    } else {
      setSelectedPatientId(user.patient_id);
    }
  };

  const loadPrescriptions = async (isManualRefresh = false) => {
    if (!selectedPatientId) return;
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
    }
    try {
      const rxs = await api.getPatientPrescriptions(selectedPatientId);
      setPrescriptions(rxs);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
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
      loadPrescriptions();
    }
  }, [selectedPatientId]);

  const handleAddItem = () => {
    setRxForm({
      ...rxForm,
      items: [
        ...rxForm.items,
        { medicine_name: '', dosage: '', frequency: '1-0-1 (Twice daily)', duration_days: 7, route: 'Oral', special_instructions: 'After food' }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    setRxForm({
      ...rxForm,
      items: rxForm.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, val) => {
    const newItems = [...rxForm.items];
    newItems[index][field] = val;
    setRxForm({ ...rxForm, items: newItems });
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    try {
      await api.createPrescription({
        patient_id: parseInt(rxForm.patient_id || selectedPatientId),
        general_instructions: rxForm.general_instructions,
        dietary_advice: rxForm.dietary_advice,
        items: rxForm.items.map(it => ({
          ...it,
          duration_days: parseInt(it.duration_days)
        }))
      });
      alert('Prescription created successfully!');
      setShowAddModal(false);
      await loadPrescriptions(true);
    } catch (err) {
      alert(err.message || 'Failed to create prescription.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Prescription Management</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Digital prescription issuing, medication schedules, and pharmacy fulfillment</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {user?.role !== 'PATIENT' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowQRPrescriptionModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}
            >
              <QrCode size={14} /> Scan Patient QR
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadPrescriptions(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Prescriptions'}
          </button>
          {user?.role !== 'PATIENT' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Issue New Prescription
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Patient Selector */}
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
                  {p.full_name} ({p.patient_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Prescriptions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {prescriptions.map((rx) => (
          <div key={rx.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Rx ID: {rx.prescription_number}</span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Prescribed by {rx.doctor_name} ({rx.doctor_specialization || 'Attending Physician'})
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge badge-info">{new Date(rx.created_at).toLocaleDateString()}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={12} /> Print Rx
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Route</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rx.items.map((it, idx) => (
                      <tr key={idx}>
                        <td><strong style={{ color: '#0284c7' }}>{it.medicine_name}</strong></td>
                        <td>{it.dosage}</td>
                        <td><span className="badge badge-primary">{it.frequency}</span></td>
                        <td>{it.duration_days} days</td>
                        <td>{it.route}</td>
                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>{it.special_instructions || 'Take as directed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.825rem' }}>
              <div>
                <strong>General Advice:</strong> {rx.general_instructions || 'None'}
              </div>
              <div>
                <strong>Dietary Advice:</strong> {rx.dietary_advice || 'None'}
              </div>
            </div>
          </div>
        ))}

        {prescriptions.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#94a3b8' }}>
            <ClipboardList size={44} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ color: '#475569', fontWeight: 600 }}>No prescriptions on file</h4>
            <p style={{ fontSize: '0.85rem' }}>No active prescriptions issued for this patient yet.</p>
          </div>
        )}
      </div>

      {/* Add Prescription Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Issue New Medical Prescription"
        size="lg"
      >
        <form onSubmit={handleCreatePrescription}>
          <div className="form-group">
            <label className="form-label">Patient *</label>
            <select
              className="form-control"
              value={rxForm.patient_id || selectedPatientId}
              onChange={(e) => setRxForm({...rxForm, patient_id: e.target.value})}
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Medications List *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                <Plus size={12} /> Add Medication
              </button>
            </div>

            {rxForm.items.map((item, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Medicine Name (e.g. Amoxicillin 500mg)"
                    value={item.medicine_name}
                    onChange={(e) => handleItemChange(idx, 'medicine_name', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Dosage"
                    value={item.dosage}
                    onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Frequency (e.g. 1-0-1 after food)"
                    value={item.frequency}
                    onChange={(e) => handleItemChange(idx, 'frequency', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Days"
                    value={item.duration_days}
                    onChange={(e) => handleItemChange(idx, 'duration_days', e.target.value)}
                    required
                  />
                  {rxForm.items.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveItem(idx)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">General Usage Instructions</label>
            <input type="text" className="form-control" value={rxForm.general_instructions} onChange={(e) => setRxForm({...rxForm, general_instructions: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="form-label">Dietary Advice</label>
            <input type="text" className="form-control" value={rxForm.dietary_advice} onChange={(e) => setRxForm({...rxForm, dietary_advice: e.target.value})} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Issue Prescription</button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Prescriptions */}
      <Modal
        isOpen={showQRPrescriptionModal}
        onClose={() => setShowQRPrescriptionModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="DOCTOR"
          title="Scan Patient QR"
          customActionLabel="Select Patient for Prescription"
          onCustomAction={(patientData) => {
            setSelectedPatientId(patientData.patient_id);
            setRxForm(prev => ({ ...prev, patient_id: patientData.patient_id }));
            setShowQRPrescriptionModal(false);
          }}
          onCancel={() => setShowQRPrescriptionModal(false)}
        />
      </Modal>
    </div>
  );
};
