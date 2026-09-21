import React, { useState, useRef, useEffect } from 'react';
import { 
  HeartPulse, 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Calendar,
  Camera,
  Upload,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/PasswordInput';

export const Register = ({ onSwitchToLogin }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    gender: 'Male',
    blood_group: 'O+',
    known_allergies: '',
    medical_history_notes: ''
  });

  // Face Recognition Registration State
  const [faceImage, setFaceImage] = useState(null);
  const [faceMode, setFaceMode] = useState('camera'); // 'camera' | 'upload'
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize webcam stream if in camera mode
  useEffect(() => {
    let stream = null;
    let isMounted = true;

    const startCamera = async () => {
      setCameraError('');
      setCameraReady(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera is unavailable on this device. You can upload a photo instead.');
        setFaceMode('upload');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (isMounted) {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              setCameraReady(true);
            };
          }
        }
      } catch (err) {
        console.warn('Webcam permission denied or camera unavailable:', err.message);
        if (isMounted) {
          setCameraError('Camera is unavailable or permission was denied. You can upload a photo instead.');
          setFaceMode('upload');
        }
      }
    };

    if (faceMode === 'camera' && !faceImage) {
      startCamera();
    }

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [faceMode, faceImage]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    setFaceImage(dataUrl);
    
    // Stop stream after capture
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      setError('PDF files are not supported for Face Recognition. Please upload a JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      setError('Please upload a valid JPG, JPEG, PNG, or WEBP photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFaceImage(ev.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read photo from device.');
    };
    reader.readAsDataURL(file);
  };

  const handleRetakePhoto = () => {
    setFaceImage(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { confirm_password, ...payload } = formData;
      if (faceImage) {
        payload.face_image = faceImage;
      }
      await api.register(payload);
      // Auto-login after registration
      await login(formData.email, formData.password);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem' }}>
      <div style={{ maxWidth: '640px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={onSwitchToLogin}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Patient Registration</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b' }}>Create your FlowCare electronic patient account</p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                name="full_name"
                className="form-control"
                placeholder="e.g. John Doe"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                name="phone"
                className="form-control"
                placeholder="+1 555 0199"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                name="date_of_birth"
                className="form-control"
                value={formData.date_of_birth}
                onChange={handleChange}
              />
            </div>

            <PasswordInput
              label="Password *"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />

            <PasswordInput
              label="Confirm Password *"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                name="gender"
                className="form-control"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select
                name="blood_group"
                className="form-control"
                value={formData.blood_group}
                onChange={handleChange}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Known Allergies (if any)</label>
              <input
                type="text"
                name="known_allergies"
                className="form-control"
                placeholder="e.g. Penicillin, Peanuts"
                value={formData.known_allergies}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.25rem' }}>
            <label className="form-label">Brief Medical History</label>
            <textarea
              name="medical_history_notes"
              className="form-control"
              rows="2"
              placeholder="e.g. History of asthma, hypertension, or past surgeries..."
              value={formData.medical_history_notes}
              onChange={handleChange}
            ></textarea>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          {/* Face Recognition Registration Section */}
          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          <div style={{
            margin: '1.25rem 0',
            border: '1px solid #bae6fd',
            background: '#f0f9ff',
            borderRadius: '12px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ScanFace size={20} color="#0284c7" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0369a1' }}>
                  Face Recognition Registration (Optional)
                </span>
              </div>
              {faceImage && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#166534',
                  background: '#dcfce7',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <CheckCircle2 size={12} /> Face Photo Ready
                </span>
              )}
            </div>
            
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 1rem 0' }}>
              Register your face to enable 1-click Face Recognition login from your laptop or mobile device.
            </p>

            {/* Option Tabs: 1. Take Photo | 2. Upload Photo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', background: '#ffffff', padding: '0.3rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => {
                  setFaceMode('camera');
                  setFaceImage(null);
                  setError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: faceMode === 'camera' ? '#0284c7' : 'transparent',
                  color: faceMode === 'camera' ? '#ffffff' : '#64748b',
                  fontWeight: faceMode === 'camera' ? 700 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                <Camera size={15} /> Take Photo (Live Camera)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFaceMode('upload');
                  setFaceImage(null);
                  setError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: faceMode === 'upload' ? '#0284c7' : 'transparent',
                  color: faceMode === 'upload' ? '#ffffff' : '#64748b',
                  fontWeight: faceMode === 'upload' ? 700 : 500,
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                <Upload size={15} /> Upload Photo
              </button>
            </div>

            {/* Camera Unavailable Banner */}
            {cameraError && faceMode === 'upload' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                color: '#92400e',
                fontSize: '0.8rem',
                marginBottom: '1rem'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{cameraError}</span>
              </div>
            )}

            {/* 1. Live Camera Mode View */}
            {faceMode === 'camera' && !faceImage && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '240px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    border: '2px dashed rgba(56, 189, 248, 0.7)',
                    borderRadius: '50%',
                    width: '150px',
                    height: '190px'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px'
                  }}>
                    Align face within oval frame
                  </div>
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={!cameraReady}
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Camera size={16} /> Capture Face Photo
                </button>
              </div>
            )}

            {/* 2. Photo Upload Mode View */}
            {faceMode === 'upload' && !faceImage && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg, image/jpg, image/png, image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #0284c7',
                    borderRadius: '10px',
                    padding: '1.75rem 1rem',
                    textAlign: 'center',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={24} color="#0284c7" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                    Click to select photo from your laptop
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Supports JPG, JPEG, PNG, or WEBP
                  </div>
                </div>
              </div>
            )}

            {/* 3. Photo Captured / Uploaded Preview */}
            {faceImage && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '100%',
                  height: '220px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <img src={faceImage} alt="Registered Face Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleRetakePhoto}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <RefreshCw size={14} /> Retake / Choose Different Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaceImage(null)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      background: '#fff1f2',
                      color: '#e11d48',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <X size={14} /> Remove Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? 'Creating Account & Face Profile...' : 'Complete Patient Registration'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
