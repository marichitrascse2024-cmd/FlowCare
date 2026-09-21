import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  ScanFace, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const FaceAuthModal = ({ isOpen, onClose, selectedRole = null }) => {
  const { faceLogin } = useAuth();
  const [authMode, setAuthMode] = useState('camera'); // 'camera' | 'upload'
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize camera when modal opens in 'camera' mode
  useEffect(() => {
    let stream = null;

    const startWebcam = async () => {
      setCameraError('');
      setCameraReady(false);
      setError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera unavailable. You can upload a photo instead.');
        setAuthMode('upload');
        return;
      }

      try {
        const videoConstraints = selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
            setCameraReady(true);
          };
        }

        // Enumerate video devices to allow switching between DroidCam / Webcams
        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoDevices);
            if (!selectedCameraId && videoDevices.length > 0) {
              const currentTrack = stream.getVideoTracks()[0];
              const currentSettings = currentTrack ? currentTrack.getSettings() : null;
              if (currentSettings && currentSettings.deviceId) {
                setSelectedCameraId(currentSettings.deviceId);
              }
            }
          } catch (enumErr) {
            console.warn('Camera enumeration error:', enumErr);
          }
        }
      } catch (err) {
        console.warn('Webcam permission denied or camera unavailable:', err.message);
        setCameraError('Camera unavailable. You can upload a photo instead.');
        setAuthMode('upload');
      }
    };

    if (isOpen && authMode === 'camera' && !capturedImage) {
      startWebcam();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, authMode, capturedImage, selectedCameraId]);

  // Clean up stream on modal close
  useEffect(() => {
    if (!isOpen && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setCapturedImage(null);
      setUploadedImage(null);
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    handleAuthenticate(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      setError('Please upload a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      setError('Please upload a valid JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setUploadedImage(dataUrl);
      handleAuthenticate(dataUrl);
    };
    reader.onerror = () => {
      setError('Failed to read image file from device.');
    };
    reader.readAsDataURL(file);
  };

  const handleAuthenticate = async (imageDataUrl) => {
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await faceLogin(imageDataUrl, selectedRole);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Face verification failed:', err);
      const msg = err.message || 'Face verification failed. Please try again or use username and password.';
      setError(msg);
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setUploadedImage(null);
    setError('');
    setSuccess(false);
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="card shadow-2xl" style={{
        background: '#ffffff',
        borderRadius: '1.25rem',
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
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
              background: 'rgba(255, 255, 255, 0.15)',
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
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              padding: '0.65rem',
              borderRadius: '0.75rem'
            }}>
              <ScanFace size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                Face Recognition Sign-In
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                AI-based face identity verification for FlowCare authorized users
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Mode Selector */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: '#f1f5f9',
            padding: '0.35rem',
            borderRadius: '10px',
            marginBottom: '1.25rem'
          }}>
            <button
              type="button"
              onClick={() => {
                setAuthMode('camera');
                setCapturedImage(null);
                setUploadedImage(null);
                setError('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'camera' ? '#ffffff' : 'transparent',
                color: authMode === 'camera' ? '#0284c7' : '#64748b',
                fontWeight: authMode === 'camera' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: authMode === 'camera' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Camera size={16} /> Live Camera
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('upload');
                setCapturedImage(null);
                setUploadedImage(null);
                setError('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'upload' ? '#ffffff' : 'transparent',
                color: authMode === 'upload' ? '#0284c7' : '#64748b',
                fontWeight: authMode === 'upload' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: authMode === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Upload size={16} /> Upload Photo
            </button>
          </div>

          {/* Camera Unavailable Banner */}
          {cameraError && authMode === 'upload' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '0.5rem',
              color: '#92400e',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              color: '#991b1b',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '0.5rem',
              color: '#166534',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              fontWeight: 700
            }}>
              <CheckCircle2 size={18} /> Face Verified! Logging in...
            </div>
          )}

          {/* Mode 1: Live Camera Viewfinder */}
          {authMode === 'camera' && (
            <div>
              {/* Camera Device Switcher */}
              {availableCameras.length > 1 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Select Camera Source:
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      if (cameraStream) {
                        cameraStream.getTracks().forEach(track => track.stop());
                      }
                      setSelectedCameraId(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.825rem',
                      color: '#0f172a',
                      background: '#f8fafc',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {availableCameras.map((cam, idx) => (
                      <option key={cam.deviceId || idx} value={cam.deviceId}>
                        {cam.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{
                position: 'relative',
                width: '100%',
                height: '280px',
                borderRadius: '1rem',
                overflow: 'hidden',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #38bdf8'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)' // Mirror for natural webcam feel
                  }}
                />

                {/* Facial Targeting Viewfinder Overlay */}
                <div style={{
                  position: 'absolute',
                  width: '180px',
                  height: '220px',
                  border: '2px dashed rgba(56, 189, 248, 0.8)',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                  pointerEvents: 'none'
                }} />

                {/* Align Guide */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  backdropFilter: 'blur(4px)'
                }}>
                  Align face within frame
                </div>
              </div>

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCaptureFrame}
                  disabled={loading || !cameraReady}
                  style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="spin-animate" /> Verifying Face Identity...
                    </>
                  ) : (
                    <>
                      <ScanFace size={18} /> Capture & Authenticate
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Photo Upload */}
          {authMode === 'upload' && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg, image/jpg, image/png, image/webp"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              {uploadedImage ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '100%',
                    height: '240px',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem'
                  }}>
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded face" 
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      Choose Different Photo
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAuthenticate(uploadedImage)}
                      disabled={loading}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      {loading ? <RefreshCw size={16} className="spin-animate" /> : <ScanFace size={16} />}
                      Verify & Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #0284c7',
                    borderRadius: '1rem',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: '#f0f9ff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                  }}>
                    <Upload size={26} />
                  </div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 700 }}>
                    Select Photo from Laptop
                  </h4>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Accepts JPG, JPEG, PNG, or WEBP
                  </p>
                  <span style={{
                    display: 'inline-block',
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    Browse Files
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div style={{
            marginTop: '1.25rem',
            padding: '0.75rem',
            background: '#f8fafc',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span>AI face recognition verifies identity securely against registered FlowCare user accounts.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
