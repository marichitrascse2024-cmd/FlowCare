import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Heart, ShieldAlert, Sparkles, X, RefreshCw, Info, ChevronRight, Stethoscope, QrCode } from 'lucide-react';
import { PatientQRScanner } from './PatientQRScanner';
import { api } from '../services/api';

export default function RiskAssessmentModal({ isOpen, onClose, initialPatientId, initialPatientName }) {
  const [riskType, setRiskType] = useState('Cardiovascular Disease Risk');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [patientName, setPatientName] = useState(initialPatientName || '');
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [formData, setFormData] = useState({
    age: 50,
    gender: 'Male',
    systolic_bp: 135,
    diastolic_bp: 88,
    bmi: 27.5,
    blood_sugar: 110,
    is_smoker: false,
    family_history_heart_disease: true,
    family_history_diabetes: false,
    symptoms: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAssess = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const payload = {
        patient_id: initialPatientId || undefined,
        risk_type: riskType,
        age: parseFloat(formData.age) || 45,
        gender: formData.gender,
        systolic_bp: parseFloat(formData.systolic_bp) || 120,
        diastolic_bp: parseFloat(formData.diastolic_bp) || 80,
        bmi: parseFloat(formData.bmi) || 24,
        blood_sugar: parseFloat(formData.blood_sugar) || 100,
        is_smoker: Boolean(formData.is_smoker),
        family_history_heart_disease: Boolean(formData.family_history_heart_disease),
        family_history_diabetes: Boolean(formData.family_history_diabetes),
        symptoms: formData.symptoms || ''
      };

      const res = await api.evaluateDiseaseRisk(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to compute risk score.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    if (level === 'HIGH RISK') return '#ef4444';
    if (level === 'MODERATE RISK') return '#f59e0b';
    return '#10b981';
  };

  const getRiskBg = (level) => {
    if (level === 'HIGH RISK') return '#fef2f2';
    if (level === 'MODERATE RISK') return '#fffbeb';
    return '#ecfdf5';
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="card shadow-2xl" style={{
        background: '#ffffff',
        borderRadius: '1.25rem',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: '#ffffff',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '1rem',
              top: '1rem',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '0.6rem',
              borderRadius: '0.75rem'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                AI Clinical Disease Risk Prediction
              </h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.2rem 0 0 0' }}>
                Multi-Factor Epidemiological & Statistical Assessment
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Patient Identification Header & Scan Patient QR Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#334155' }}>
              <strong>Patient Case:</strong> {patientName ? `${patientName}` : 'Auto-fill from Patient QR'}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowQRScanner(!showQRScanner)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#4f46e5', color: '#4f46e5', fontWeight: 600, fontSize: '0.78rem' }}
            >
              <QrCode size={13} /> {showQRScanner ? 'Hide Scanner' : 'Scan Patient QR'}
            </button>
          </div>

          {showQRScanner && (
            <div style={{ marginBottom: '1.25rem' }}>
              <PatientQRScanner
                module="DOCTOR"
                title="Scan Patient QR"
                customActionLabel="Apply Vitals to Risk Assessment"
                onCustomAction={(patientData) => {
                  setPatientId(patientData.patient_id);
                  setPatientName(patientData.full_name);
                  if (patientData.date_of_birth) {
                    const birthYear = new Date(patientData.date_of_birth).getFullYear();
                    const currentYear = new Date().getFullYear();
                    if (!isNaN(birthYear)) {
                      setFormData(prev => ({ ...prev, age: Math.max(1, currentYear - birthYear) }));
                    }
                  }
                  if (patientData.gender) {
                    setFormData(prev => ({ ...prev, gender: patientData.gender }));
                  }
                  if (patientData.known_allergies || patientData.medical_history_notes) {
                    setFormData(prev => ({ ...prev, symptoms: patientData.medical_history_notes || '' }));
                  }
                  setShowQRScanner(false);
                }}
                onCancel={() => setShowQRScanner(false)}
              />
            </div>
          )}

          {/* Target Disease Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`btn ${riskType === 'Cardiovascular Disease Risk' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRiskType('Cardiovascular Disease Risk')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
            >
              <Heart size={16} /> Cardiovascular Risk
            </button>
            <button
              type="button"
              className={`btn ${riskType === 'Type 2 Diabetes Risk' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRiskType('Type 2 Diabetes Risk')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
            >
              <Activity size={16} /> Type 2 Diabetes Risk
            </button>
          </div>

          <form onSubmit={handleAssess}>
            {/* Input Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Age (Years)</label>
                <input 
                  type="number"
                  className="form-control"
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Gender</label>
                <select 
                  className="form-control"
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Systolic BP (mmHg)</label>
                <input 
                  type="number"
                  className="form-control"
                  value={formData.systolic_bp}
                  onChange={(e) => handleInputChange('systolic_bp', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Diastolic BP (mmHg)</label>
                <input 
                  type="number"
                  className="form-control"
                  value={formData.diastolic_bp}
                  onChange={(e) => handleInputChange('diastolic_bp', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>BMI (kg/m²)</label>
                <input 
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={formData.bmi}
                  onChange={(e) => handleInputChange('bmi', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Blood Glucose (mg/dL)</label>
                <input 
                  type="number"
                  className="form-control"
                  value={formData.blood_sugar}
                  onChange={(e) => handleInputChange('blood_sugar', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Checkbox lifestyle factors */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              background: '#f8fafc',
              padding: '0.85rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={formData.is_smoker}
                  onChange={(e) => handleInputChange('is_smoker', e.target.checked)}
                />
                Active Smoker / Tobacco
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={riskType === 'Cardiovascular Disease Risk' ? formData.family_history_heart_disease : formData.family_history_diabetes}
                  onChange={(e) => handleInputChange(
                    riskType === 'Cardiovascular Disease Risk' ? 'family_history_heart_disease' : 'family_history_diabetes',
                    e.target.checked
                  )}
                />
                Family History
              </label>
            </div>

            {/* Symptoms free text */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                Reported Symptoms / Complaints (Optional)
              </label>
              <input 
                type="text"
                className="form-control"
                placeholder="e.g. Occasional chest tightness, fatigue on exertion, frequent thirst..."
                value={formData.symptoms}
                onChange={(e) => handleInputChange('symptoms', e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loading ? <RefreshCw size={18} className="spin-animate" /> : <Sparkles size={18} />}
              Compute AI Risk Assessment
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: '1rem',
              background: '#fef2f2',
              color: '#991b1b',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Assessment Output */}
          {result && (
            <div style={{
              marginTop: '1.5rem',
              border: `2px solid ${getRiskColor(result.risk_level)}`,
              background: getRiskBg(result.risk_level),
              borderRadius: '1rem',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    {result.risk_type}
                  </span>
                  <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1.35rem', fontWeight: '800', color: getRiskColor(result.risk_level) }}>
                    {result.risk_level} ({result.risk_score}%)
                  </h4>
                </div>
                <div style={{
                  background: getRiskColor(result.risk_level),
                  color: '#ffffff',
                  padding: '0.5rem 1rem',
                  borderRadius: '2rem',
                  fontWeight: '700',
                  fontSize: '0.85rem'
                }}>
                  Score: {result.risk_score}%
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, result.risk_score)}%`,
                  background: getRiskColor(result.risk_level),
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>

              {/* Contributing Factors */}
              {result.contributing_factors && result.contributing_factors.length > 0 && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Identified Contributing Factors:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {result.contributing_factors.map((f, i) => (
                      <span key={i} style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.78rem',
                        color: '#334155'
                      }}>
                        • {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Clinical Recommendations:</strong>
                  <ul style={{ margin: '0.4rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#334155' }}>
                    {result.recommendations.map((r, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medical Disclaimer */}
              <div style={{
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '0.75rem'
              }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#6366f1' }} />
                <span>
                  <strong>Clinical Notice:</strong> {result.disclaimer}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
