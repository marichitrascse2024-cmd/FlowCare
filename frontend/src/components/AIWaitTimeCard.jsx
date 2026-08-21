import React, { useState, useEffect } from 'react';
import { Clock, Users, Zap, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const AIWaitTimeCard = ({ doctorId, patientId, priority = 'NORMAL', onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState('');

  const fetchPrediction = async () => {
    if (!doctorId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.predictWaitingTime({
        doctor_id: doctorId,
        patient_id: patientId,
        priority: priority
      });
      setPrediction(data);
      if (onRefresh) onRefresh(data);
    } catch (err) {
      setError(err.message || 'Unable to calculate wait time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [doctorId, patientId, priority]);

  if (!prediction && !loading && !error) return null;

  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff, #f0f9ff)', borderColor: '#bae6fd' }}>
      <div className="card-header" style={{ borderColor: '#e0f2fe' }}>
        <div className="card-title" style={{ color: '#0369a1', fontSize: '1rem' }}>
          <Sparkles size={18} color="#0284c7" />
          AI Waiting-Time Prediction
        </div>
        <button 
          onClick={fetchPrediction} 
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Recalculating...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
      ) : prediction && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#0284c7' }}>
              ~{prediction.estimated_wait_minutes}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>
              minutes estimated wait
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Patients Ahead</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                {prediction.patients_ahead} in queue
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>AI Confidence</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981' }}>
                {(prediction.confidence_score * 100).toFixed(0)}%
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Clinic Flow Rate</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#6366f1' }}>
                {prediction.rush_hour_factor > 1.0 ? 'Peak Rush' : 'Normal Flow'}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
            * {prediction.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};
