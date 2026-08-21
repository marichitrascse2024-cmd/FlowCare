import React, { useState } from 'react';
import { Sparkles, Search, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../services/api';

export const AISummaryModal = ({ isOpen, onClose, patientId, patientName }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getMedicalSummary({
        patient_id: patientId,
        query: query.trim() || undefined
      });
      setSummaryData(data);
    } catch (err) {
      setError(err.message || 'Failed to generate clinical summary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles color="#6366f1" size={20} />
          <span>AI Clinical Record Retrieval & Summary</span>
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
        <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Focus query e.g. 'cardiac history', 'diabetes', 'allergies' (optional)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            className="btn btn-ai" 
            onClick={handleGenerate}
            disabled={loading}
            style={{ flexShrink: 0 }}
          >
            <Sparkles size={16} />
            {loading ? 'Analyzing...' : 'Generate Summary'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {summaryData ? (
          <div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ color: '#0f172a', fontWeight: 700 }}>{summaryData.patient_name} ({summaryData.patient_code})</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{summaryData.age_gender} • Blood Group: <strong>{summaryData.blood_group || 'N/A'}</strong></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 600 }}>
                    {summaryData.total_past_visits} Recorded Visits
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summaryData.summary_sections.map((sec, idx) => (
                <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={16} color="#0284c7" />
                    {sec.category}
                  </h5>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {sec.details.map((detail, dIdx) => (
                      <li key={dIdx}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                <strong>AI Healthcare Assistance Disclaimer:</strong> {summaryData.ai_disclaimer}
              </p>
            </div>
          </div>
        ) : !loading && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
            <Sparkles size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.9rem' }}>Click <strong>Generate Summary</strong> to extract clinical records and synthesize medical history.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
