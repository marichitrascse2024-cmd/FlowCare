import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  Shield, 
  HeartPulse, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  ArrowRight, 
  Stethoscope,
  Upload,
  Zap,
  ImageIcon
} from 'lucide-react';
import jsQR from 'jsqr';
import { api } from '../services/api';
import { Badge } from './Badge';

export const PatientQRScanner = ({ 
  module = 'GENERAL', 
  title = 'Scan Patient QR',
  onPatientIdentified,
  onCancel,
  customActionLabel,
  onCustomAction
}) => {
  const [inputToken, setInputToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const mediaStreamRef = useRef(null);

  // Initialize camera access if available
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return; // Fallback to optical viewfinder preview
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (active && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          mediaStreamRef.current = stream;
          scanCameraFrame();
        }
      } catch (err) {
        console.log('Using optical camera viewfinder:', err.message);
      }
    };

    const scanCameraFrame = () => {
      if (!active || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && code.data.trim()) {
          setInputToken(code.data.trim());
          handleVerifyToken(code.data.trim());
          return; // Stop scanning loop on detection
        }
      }
      animationFrameId.current = requestAnimationFrame(scanCameraFrame);
    };

    if (cameraActive) {
      startCamera();
    }

    return () => {
      active = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive]);

  const decodeImageFile = (file) => {
    if (!file) return;
    setError('');
    setUploadedFileName(file.name);
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
            const extractedToken = decoded.data.trim();
            setInputToken(extractedToken);
            handleVerifyToken(extractedToken);
          } else {
            setError('No QR code detected. Please upload a clear Patient QR image.');
            setScanning(false);
          }
        } catch (err) {
          console.error('Image decoding error:', err);
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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      decodeImageFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      decodeImageFile(file);
    }
  };

  const handleVerifyToken = async (tokenToVerify) => {
    const rawToken = tokenToVerify || inputToken;
    if (!rawToken.trim()) {
      setError('Please scan or upload a valid Patient QR code.');
      return;
    }

    setScanning(true);
    setError('');
    try {
      const response = await api.verifyPatientQR(rawToken.trim(), module);
      if (response && response.patient_data) {
        setResult(response.patient_data);
        if (onPatientIdentified) {
          onPatientIdentified(response.patient_data);
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
      setResult(null);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/*, application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header & Scanner Viewfinder */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          background: '#0f172a',
          borderRadius: '12px',
          padding: '1.5rem',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          border: dragOver ? '2px dashed #38bdf8' : '1px solid #1e293b',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Animated Scanner Box */}
        <div style={{
          height: '175px',
          border: '2px dashed #0284c7',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 132, 199, 0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Active Camera Video Preview */}
          <video
            ref={videoRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.65,
              display: cameraActive ? 'block' : 'none'
            }}
            muted
          />

          {cameraActive ? (
            <>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                boxShadow: '0 0 10px #38bdf8',
                animation: 'scanLine 2s infinite ease-in-out',
                zIndex: 2
              }} />
              <QrCode size={44} color="#38bdf8" style={{ opacity: 0.9, marginBottom: '0.4rem', zIndex: 2 }} />
              <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, zIndex: 2 }}>
                {scanning ? 'Decoding & Verifying Patient QR...' : 'Scan Patient QR with Camera or Upload Image'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', zIndex: 2 }}>
                Hold Patient QR in front of camera or select a QR image file
              </div>
              {uploadedFileName && (
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.3rem', zIndex: 2, background: 'rgba(15,23,42,0.8)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                  Loaded: <strong>{uploadedFileName}</strong>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <Camera size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Camera preview paused</p>
            </div>
          )}
        </div>

        {/* Action Controls: [ Upload Patient QR ] */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '1.25rem',
          paddingTop: '0.5rem'
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: '#1e293b',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              padding: '0.65rem 1.75rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(56, 189, 248, 0.15)',
              width: '100%',
              maxWidth: '280px'
            }}
          >
            <Upload size={16} color="#38bdf8" />
            <span>Upload Patient QR</span>
          </button>
        </div>

        {/* Manual Patient Code/Token Input Bar */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Or enter Patient Code / Token (e.g. PAT1001)"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyToken()}
              style={{ paddingLeft: '2.2rem', background: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleVerifyToken()}
            disabled={scanning}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {scanning ? <RefreshCw size={14} className="spin-animate" /> : <CheckCircle2 size={14} />}
            Verify
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Scanned & Verified Patient Profile Sliced by Module */}
      {result && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.1rem'
              }}>
                {result.full_name ? result.full_name.charAt(0) : 'P'}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {result.full_name}
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '0.15rem' }}>
                  <span>ID: <strong style={{ color: '#0284c7' }}>{result.patient_code}</strong></span>
                  <span>•</span>
                  <span>{result.gender || 'Gender N/A'}</span>
                  <span>•</span>
                  <span>Blood: <strong style={{ color: '#dc2626' }}>{result.blood_group || 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            <span style={{
              background: '#dcfce7',
              color: '#166534',
              padding: '0.25rem 0.65rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <CheckCircle2 size={12} /> Patient Identified ({module})
            </span>
          </div>

          {/* Module-Specific Views */}
          {/* 1. RECEPTION VIEW */}
          {module === 'RECEPTION' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div><strong>Phone:</strong> {result.phone || 'N/A'}</div>
              <div><strong>Email:</strong> {result.email || 'N/A'}</div>
              <div><strong>City/State:</strong> {result.city ? `${result.city}, ${result.state}` : 'N/A'}</div>
              <div><strong>Active Queue:</strong> <Badge status={result.active_queue_status || 'NONE'} /></div>
              <div><strong>Emergency Contact:</strong> {result.emergency_contact_name} ({result.emergency_contact_phone})</div>
            </div>
          )}

          {/* 2. APPOINTMENT VIEW */}
          {module === 'APPOINTMENT' && (
            <div style={{ fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>
                Patient identity verified. Ready to schedule appointment consultation.
              </p>
              <div><strong>Contact:</strong> {result.phone} | {result.email}</div>
            </div>
          )}

          {/* 3. DOCTOR VIEW */}
          {module === 'DOCTOR' && (
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '0.6rem' }}>
                <strong>Known Allergies:</strong> <span style={{ color: '#b91c1c' }}>{result.known_allergies || 'None'}</span>
              </div>
              <div style={{ marginBottom: '0.6rem' }}>
                <strong>Medical History:</strong> <span>{result.medical_history_notes || 'None recorded'}</span>
              </div>
              {result.medical_records && result.medical_records.length > 0 && (
                <div>
                  <strong>Recent Consultations:</strong>
                  <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0 }}>
                    {result.medical_records.slice(0, 3).map((r) => (
                      <li key={r.id} style={{ marginBottom: '0.25rem' }}>
                        {r.date} — {r.diagnosis} ({r.doctor_name} • {r.specialization})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 4. QUEUE VIEW */}
          {module === 'QUEUE' && (
            <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div><strong>Current Token:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7' }}>{result.active_queue_token || 'None'}</span></div>
              <div><strong>Doctor:</strong> {result.doctor_name || 'Not assigned'} ({result.department || 'N/A'})</div>
              <div><strong>Queue Position:</strong> {result.queue_position ? `#${result.queue_position}` : 'N/A'}</div>
              <div><strong>Estimated Wait:</strong> {result.estimated_wait_minutes ? `~${result.estimated_wait_minutes} mins` : 'N/A'}</div>
            </div>
          )}

          {/* 5. MEDICAL RECORDS VIEW */}
          {module === 'MEDICAL_RECORDS' && (
            <div style={{ fontSize: '0.85rem' }}>
              <div><strong>Total Historical Records:</strong> {result.total_records_count || 0}</div>
              <div><strong>Allergies:</strong> {result.known_allergies || 'None'}</div>
            </div>
          )}

          {/* 6. BILLING VIEW */}
          {module === 'BILLING' && (
            <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div><strong>Total Invoices:</strong> {result.total_bills_count || 0}</div>
              <div><strong>Pending Bills:</strong> {result.pending_bills_count || 0}</div>
              <div><strong>Total Due:</strong> <strong style={{ color: '#dc2626', fontSize: '1.05rem' }}>₹{result.total_outstanding_amount || 0}</strong></div>
            </div>
          )}

          {/* 7. EMERGENCY ACCESS VIEW */}
          {module === 'EMERGENCY' && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.85rem',
              color: '#991b1b'
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} /> CRITICAL PATIENT HEALTH PROFILE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                <div><strong>Blood Group:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{result.critical_emergency_profile?.blood_group || result.blood_group || 'N/A'}</span></div>
                <div><strong>Known Allergies:</strong> <span>{result.critical_emergency_profile?.known_allergies || result.known_allergies || 'None reported'}</span></div>
                <div><strong>Chronic Conditions:</strong> <span>{result.critical_emergency_profile?.chronic_conditions || 'None reported'}</span></div>
                <div><strong>Emergency Contact:</strong> <span>{result.critical_emergency_profile?.emergency_contact_name || result.emergency_contact_name || 'N/A'} ({result.critical_emergency_profile?.emergency_contact_phone || result.emergency_contact_phone || 'N/A'})</span></div>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          {customActionLabel && onCustomAction && (
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {onCancel && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
                  Close
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onCustomAction(result)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {customActionLabel} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientQRScanner;
