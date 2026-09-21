import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  ScanFace, 
  ShieldCheck, 
  Eye, 
  VideoOff 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const RegisterFaceModal = ({ isOpen, onClose, onSuccess }) => {
  const { updateFaceAuthStatus } = useAuth();
  const [method, setMethod] = useState('camera'); // 'camera' | 'upload'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && method === 'camera' && !capturedPhoto) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, method, capturedPhoto]);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.log('Video play error:', e));
        };
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Webcam access error:', err);
      setCameraError('Camera access unavailable or permission denied. Please select "Upload Photo" instead.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setUploadFile(null);
    setUploadPreview(null);
    setErrorMessage('');
    setStatusMessage('');
    if (method === 'camera') {
      startCamera();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      setErrorMessage('PDF files are not supported for Face Recognition. Please upload a JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      setErrorMessage('Please upload a valid JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    setErrorMessage('');
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterFace = async () => {
    const activeImageData = method === 'camera' ? capturedPhoto : uploadPreview;
    if (!activeImageData) {
      setErrorMessage('Please capture or select a face photo first.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setStatusMessage('Analyzing facial features and generating biometric template...');

    try {
      const res = await api.registerFace(activeImageData);
      setStatusMessage('Face Recognition successfully enabled!');
      setSuccess(true);
      if (updateFaceAuthStatus) {
        updateFaceAuthStatus(true);
      }
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        handleClose();
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to register face recognition. Please try again with clear lighting.');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedPhoto(null);
    setUploadFile(null);
    setUploadPreview(null);
    setErrorMessage('');
    setStatusMessage('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
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
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.5rem', borderRadius: '10px' }}>
              <ScanFace size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Register Face Recognition
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Enable secure, instant camera or photo login for your account
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '0.25rem',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Method Tabs */}
          {!capturedPhoto && !uploadPreview && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => { setMethod('camera'); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '8px',
                  border: method === 'camera' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  background: method === 'camera' ? '#f0f9ff' : '#ffffff',
                  color: method === 'camera' ? '#0284c7' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Camera size={16} /> Live Camera
              </button>
              <button
                type="button"
                onClick={() => { setMethod('upload'); stopCamera(); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '8px',
                  border: method === 'upload' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  background: method === 'upload' ? '#f0f9ff' : '#ffffff',
                  color: method === 'upload' ? '#0284c7' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Upload size={16} /> Upload Photo
              </button>
            </div>
          )}

          {/* Camera View */}
          {method === 'camera' && !capturedPhoto && (
            <div>
              {cameraError ? (
                <div style={{
                  padding: '1.5rem',
                  background: '#fef2f2',
                  border: '1px dashed #f87171',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#991b1b'
                }}>
                  <VideoOff size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.8 }} />
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => { setMethod('upload'); setErrorMessage(''); }}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Upload size={14} /> Switch to Photo Upload
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '280px', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '180px',
                    height: '220px',
                    border: '2px dashed rgba(2, 132, 199, 0.8)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }} />
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={!cameraActive}
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50px',
                      padding: '0.6rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: cameraActive ? 'pointer' : 'not-allowed',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    <Camera size={16} /> Take Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {method === 'upload' && !uploadPreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'border-color 0.2s'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <Upload size={36} color="#0284c7" style={{ margin: '0 auto 0.75rem', opacity: 0.9 }} />
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                Click to browse face photo
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Supported formats: JPG, JPEG, PNG, WEBP (Clear single face)
              </p>
            </div>
          )}

          {/* Photo Preview & Confirmation */}
          {(capturedPhoto || uploadPreview) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                position: 'relative',
                display: 'inline-block',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <img
                  src={capturedPhoto || uploadPreview}
                  alt="Face Preview"
                  style={{ width: '220px', height: '220px', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  padding: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}>
                  <Eye size={12} /> Ready for registration
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={loading}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <RefreshCw size={14} /> Retake / Choose Different Photo
                </button>
              </div>
            </div>
          )}

          {/* Status & Error Messages */}
          {errorMessage && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: success ? '#dcfce7' : '#f0f9ff',
              color: success ? '#166534' : '#0369a1',
              borderRadius: '8px',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {success ? <CheckCircle2 size={16} /> : <RefreshCw size={16} className="spin-animate" />}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRegisterFace}
            disabled={loading || (!capturedPhoto && !uploadPreview)}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: (capturedPhoto || uploadPreview) && !loading ? '#0284c7' : '#94a3b8',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: (capturedPhoto || uploadPreview) && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: (capturedPhoto || uploadPreview) && !loading ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
            }}
          >
            {loading ? <RefreshCw size={16} className="spin-animate" /> : <ShieldCheck size={16} />}
            {loading ? 'Processing Face AI...' : 'Save & Enable Face Login'}
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
