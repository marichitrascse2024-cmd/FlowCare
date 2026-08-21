import React, { useState, useRef } from 'react';
import { Camera, Scan, X, CheckCircle2, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import jsQR from 'jsqr';
import { api } from '../services/api';

export default function QRScannerModal({ isOpen, onClose, onPatientResolved, module = 'GENERAL', title = 'Scan Patient QR' }) {
  const [tokenInput, setTokenInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [resolvedPatient, setResolvedPatient] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const decodeImageFile = (file) => {
    if (!file) return;
    setError(null);
    setScanning(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);

          let decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (!decoded) {
            decoded = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth'
            });
          }

          if (decoded && decoded.data && decoded.data.trim()) {
            const code = decoded.data.trim();
            setTokenInput(code);
            handleScanOrSubmit(code);
          } else {
            setError('No QR code detected. Please upload a clear Patient QR image.');
            setScanning(false);
          }
        } catch (err) {
          setError('Failed to process image file. Please upload a valid PNG, JPG, or WEBP Patient QR.');
          setScanning(false);
        }
      };

      img.onerror = () => {
        setError('Unsupported or corrupted image file. Please upload a valid PNG, JPG, or WEBP file.');
        setScanning(false);
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      setError('Unable to read file from your device.');
      setScanning(false);
    };

    reader.readAsDataURL(file);
  };

  const handleScanOrSubmit = async (codeToSubmit) => {
    const targetToken = codeToSubmit || tokenInput;
    if (!targetToken.trim()) {
      setError('Please provide or scan a valid Patient QR code.');
      return;
    }

    try {
      setScanning(true);
      setError(null);
      setResolvedPatient(null);

      const res = await api.verifyPatientQR(targetToken.trim(), module);
      if (res && res.patient_data) {
        setResolvedPatient(res.patient_data);
        if (onPatientResolved) {
          onPatientResolved(res.patient_data);
        }
      } else {
        throw new Error('Invalid FlowCare Patient QR.');
      }
    } catch (err) {
      console.error('QR verification error:', err);
      const msg = err.message || 'Patient could not be identified.';
      if (msg.includes('403') || msg.includes('denied')) {
        setError('You are not authorized to access this patient\'s information.');
      } else if (msg.includes('404') || msg.includes('Unrecognized') || msg.includes('Invalid')) {
        setError('Invalid FlowCare Patient QR.');
      } else {
        setError(msg);
      }
    } finally {
      setScanning(false);
    }
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
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && decodeImageFile(e.target.files[0])}
      />

      <div className="card shadow-2xl" style={{
        background: '#ffffff',
        borderRadius: '1.25rem',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
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
              <Scan size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                {title || 'Scan Patient QR'}
              </h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.2rem 0 0 0' }}>
                Universal FlowCare Patient Identification
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Scanner Input / Optical viewfinder */}
          <div style={{
            border: '2px dashed #0d9488',
            borderRadius: '1rem',
            padding: '1.25rem',
            background: '#f0fdfa',
            textAlign: 'center',
            marginBottom: '1.25rem',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ccfbf1',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto'
            }}>
              <Camera size={28} />
            </div>
            <p style={{ margin: 0, fontWeight: '600', color: '#0f766e', fontSize: '0.95rem' }}>
              Optical Camera or Upload Patient QR
            </p>
            <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
              Point optical scanner or select a Patient QR image file
            </p>

            {/* Action Button: [ Upload Patient QR ] */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderColor: '#0d9488',
                  color: '#0f766e',
                  background: '#ffffff',
                  fontWeight: 700,
                  padding: '0.5rem 1.25rem'
                }}
              >
                <Upload size={14} /> Upload Patient QR
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text"
                className="form-control"
                placeholder="Or enter Patient Code / Token (e.g. PAT1001)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanOrSubmit()}
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <button 
                className="btn btn-primary"
                onClick={() => handleScanOrSubmit()}
                disabled={scanning}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {scanning ? <RefreshCw size={16} className="spin-animate" /> : <Scan size={16} />}
                Verify
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              color: '#991b1b',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {resolvedPatient && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: '700', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={18} /> Patient Identified
              </div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>{resolvedPatient.full_name}</h4>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><strong>Code:</strong> {resolvedPatient.patient_code}</div>
                <div><strong>Blood Group:</strong> {resolvedPatient.blood_group || 'N/A'}</div>
                <div><strong>Phone:</strong> {resolvedPatient.phone || 'N/A'}</div>
                <div><strong>Email:</strong> {resolvedPatient.email || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { QRScannerModal };
