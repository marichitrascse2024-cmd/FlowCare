import React, { useState, useEffect } from 'react';
import { QrCode, Download, Printer, RefreshCw, X, ShieldCheck, User, Calendar, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function QRCodeModal({ patientId, patientName, patientCode, isOpen, onClose }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchQRCode = async (forceRegenerate = false) => {
    const validId = Number(patientId);
    if (!patientId || isNaN(validId) || validId <= 0) {
      setLoading(false);
      setError('Valid Patient ID is required to fetch QR code.');
      return;
    }
    try {
      if (forceRegenerate) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const res = forceRegenerate 
        ? await api.regeneratePatientQRCode(validId)
        : await api.getPatientQRCode(validId);
      
      setQrData(res);
    } catch (err) {
      setError(err.message || 'Failed to load QR code.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const validId = Number(patientId);
    if (isOpen && patientId && !isNaN(validId) && validId > 0) {
      fetchQRCode();
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!qrData?.qr_image_data_uri) return;
    const link = document.createElement('a');
    link.href = qrData.qr_image_data_uri;
    link.download = `FlowCare_QR_${patientCode || 'patient'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
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
        maxWidth: '460px',
        width: '100%',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
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
              <QrCode size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>My Patient QR</h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.2rem 0 0 0' }}>Universal FlowCare Patient Identity</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem', textAlign: 'center' }}>
          {loading ? (
            <div style={{ padding: '3rem 1rem', color: '#64748b' }}>
              <RefreshCw size={36} className="spin-animate" style={{ margin: '0 auto 1rem auto', color: '#0ea5e9' }} />
              <p>Generating cryptographically signed Patient QR...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem 1rem', color: '#ef4444' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 1rem auto' }} />
              <p>{error}</p>
              <button 
                className="btn btn-outline" 
                onClick={() => fetchQRCode()}
                style={{ marginTop: '1rem' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
              {/* QR Badge Card */}
              <div style={{
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '1rem',
                padding: '1.5rem',
                display: 'inline-block',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)',
                marginBottom: '1.25rem'
              }}>
                <img 
                  src={qrData?.qr_image_data_uri} 
                  alt="Universal Patient QR"
                  style={{
                    width: '210px',
                    height: '210px',
                    display: 'block',
                    borderRadius: '0.5rem'
                  }}
                />
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px'
                }}>
                  {qrData?.qr_token?.substring(0, 24)}...
                </div>
              </div>

              {/* Patient Meta */}
              <div style={{
                background: '#f1f5f9',
                borderRadius: '0.75rem',
                padding: '0.85rem 1rem',
                textAlign: 'left',
                marginBottom: '1.5rem',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Patient Name:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{patientName || qrData?.patient_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Patient ID:</span>
                  <span style={{ fontWeight: '700', color: '#0ea5e9' }}>{patientCode || qrData?.patient_code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Security Protocol:</span>
                  <span style={{ color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> HMAC-SHA256 Signed
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownload}
                  style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Download size={16} /> Download QR
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrint}
                  style={{ flex: '1 1 100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Printer size={16} /> Print QR
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => fetchQRCode(true)}
                  disabled={refreshing}
                  title="Generate a new secure dynamic Patient QR"
                  style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <RefreshCw size={16} className={refreshing ? "spin-animate" : ""} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
