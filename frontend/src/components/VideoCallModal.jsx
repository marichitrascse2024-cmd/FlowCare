import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Camera, 
  RefreshCw, 
  User, 
  ShieldCheck, 
  X,
  Volume2,
  Clock,
  Sparkles
} from 'lucide-react';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const VideoCallModal = ({
  isOpen,
  onClose,
  patientName = 'Patient',
  doctorName = 'Dr. Specialist',
  appointmentId = null,
  appointment_id = null,
  userRole = 'DOCTOR',
  remoteStream = null,
  onIceCandidate = null,
  onOfferCreated = null,
  onAnswerCreated = null
}) => {
  const activeAppointmentId = appointment_id || appointmentId;

  const [stream, setStream] = useState(null);
  const [peerRemoteStream, setPeerRemoteStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // Comprehensive Call Teardown & Reset Helper
  const cleanupCall = () => {
    setIsLocalStreamReady(false);

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    pendingCandidatesRef.current = [];
    setPeerRemoteStream(null);
    setIsMicMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
    setCameraError('');
  };

  // Helper to construct WebSocket signaling URL
  const getWsUrl = (appId) => {
    const envBase = import.meta.env.VITE_API_BASE_URL || '';
    if (envBase) {
      const wsProtocol = envBase.startsWith('https') ? 'wss' : 'ws';
      const host = envBase.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
      return `${wsProtocol}://${host}/ws/video-call/${appId}`;
    }
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${wsProtocol}://${window.location.hostname}:8000/ws/video-call/${appId}`;
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${window.location.host}/ws/video-call/${appId}`;
  };

  // Initialize or reset WebRTC PeerConnection instance
  const initPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    try {
      const pc = new RTCPeerConnection(rtcConfig);

      // Handle remote media track reception
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setPeerRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Handle ICE Candidates and relay over WebSocket
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (onIceCandidate) onIceCandidate(event.candidate);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate
              })
            );
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (err) {
      console.error('Failed to create RTCPeerConnection:', err);
      return null;
    }
  };

  // Helper to re-bind local tracks to a PeerConnection
  const bindLocalTracks = (pc) => {
    const mediaStream = localStreamRef.current || stream;
    if (pc && mediaStream) {
      try {
        const currentSenders = pc.getSenders();
        currentSenders.forEach((sender) => {
          try { pc.removeTrack(sender); } catch (e) {}
        });
        mediaStream.getTracks().forEach((track) => {
          pc.addTrack(track, mediaStream);
        });
      } catch (err) {
        console.warn('Error binding local tracks to RTCPeerConnection:', err);
      }
    }
  };

  // Helper to create and setup a fresh PeerConnection with local tracks
  const setupFreshPeerConnection = () => {
    const pc = initPeerConnection();
    bindLocalTracks(pc);
    return pc;
  };

  // Helper to create and broadcast WebRTC offer via WebSocket
  const createAndSendOffer = async () => {
    let pc = peerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') {
      pc = setupFreshPeerConnection();
    }
    if (!pc || pc.signalingState !== 'stable') return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (onOfferCreated) onOfferCreated(offer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'offer',
            offer: offer,
            sdp: offer.sdp
          })
        );
      }
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  };

  // WebSocket Signaling Connection Lifecycle
  useEffect(() => {
    let isMounted = true;
    if (isOpen && activeAppointmentId && isLocalStreamReady) {
      // Clean up previous socket if any
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }

      const wsUrl = getWsUrl(activeAppointmentId);
      console.log(`[WebSocket] Connecting to WebRTC signaling at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          console.log(`[WebSocket] Connected to signaling room for appointment #${activeAppointmentId}`);
        }
      };

      ws.onmessage = async (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'peer-joined':
              console.log('[WebSocket] Peer joined notification received.');
              let pcJoined = peerConnectionRef.current;
              if (!pcJoined || pcJoined.signalingState === 'closed' || pcJoined.signalingState !== 'stable') {
                pcJoined = setupFreshPeerConnection();
              }
              await createAndSendOffer();
              break;

            case 'offer':
              console.log('[WebSocket] WebRTC offer received from peer.');
              let pcOffer = peerConnectionRef.current;
              if (!pcOffer || pcOffer.signalingState === 'closed' || pcOffer.signalingState !== 'stable') {
                pcOffer = setupFreshPeerConnection();
              }
              if (!pcOffer) return;
              const offerDesc = data.offer || { type: 'offer', sdp: data.sdp };
              await pcOffer.setRemoteDescription(new RTCSessionDescription(offerDesc));

              // Process queued ICE candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                await pcOffer.addIceCandidate(cand);
              }

              const answer = await pcOffer.createAnswer();
              await pcOffer.setLocalDescription(answer);
              if (onAnswerCreated) onAnswerCreated(answer);
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    sdp: answer.sdp
                  })
                );
              }
              break;

            case 'answer':
              console.log('[WebSocket] WebRTC answer received from peer.');
              const pcAnswer = peerConnectionRef.current;
              if (!pcAnswer || pcAnswer.signalingState === 'closed') return;
              const answerDesc = data.answer || { type: 'answer', sdp: data.sdp };
              await pcAnswer.setRemoteDescription(new RTCSessionDescription(answerDesc));

              // Process queued ICE candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                await pcAnswer.addIceCandidate(cand);
              }
              break;

            case 'ice-candidate':
              const pcIce = peerConnectionRef.current;
              if (!pcIce || pcIce.signalingState === 'closed') return;
              if (data.candidate) {
                const iceCandidate = new RTCIceCandidate(data.candidate);
                if (pcIce.remoteDescription && pcIce.remoteDescription.type) {
                  await pcIce.addIceCandidate(iceCandidate);
                } else {
                  pendingCandidatesRef.current.push(iceCandidate);
                }
              }
              break;

            case 'peer-left':
              console.log('[WebSocket] Peer left signaling room.');
              setPeerRemoteStream(null);
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
              }
              pendingCandidatesRef.current = [];
              setupFreshPeerConnection();
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Error processing WebSocket message in VideoCallModal:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Signaling connection error:', err);
      };

      ws.onclose = () => {
        console.log(`[WebSocket] Disconnected from signaling room #${activeAppointmentId}`);
      };

      return () => {
        isMounted = false;
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          try {
            wsRef.current.close();
          } catch (e) {}
          wsRef.current = null;
        }
      };
    } else {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
    }
  }, [isOpen, activeAppointmentId, isLocalStreamReady]);

  // Initialize call duration timer
  useEffect(() => {
    if (isOpen) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // Handle local camera & microphone media stream initialization
  const startLocalStream = async (deviceId = '') => {
    setCameraError('');
    setIsLocalStreamReady(false);
    try {
      // Stop existing tracks if any
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : true;

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };

      const localMediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints
      });

      const audioTracks = localMediaStream.getAudioTracks();
      const videoTracks = localMediaStream.getVideoTracks();

      if (audioTracks.length === 0 || videoTracks.length === 0) {
        throw new Error('Camera or microphone failed to initialize. Both audio and video are required for teleconsultation.');
      }

      localStreamRef.current = localMediaStream;
      setStream(localMediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localMediaStream;
      }

      // Attach tracks to WebRTC PeerConnection
      const pc = peerConnectionRef.current || initPeerConnection();
      if (pc && localMediaStream) {
        // Remove old senders if replacing tracks
        const currentSenders = pc.getSenders();
        currentSenders.forEach((sender) => pc.removeTrack(sender));

        // Add new tracks to peer connection
        localMediaStream.getTracks().forEach((track) => {
          pc.addTrack(track, localMediaStream);
        });
        setIsLocalStreamReady(true);
      }

      // Enumerate camera devices for device selector
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoInputs);

      if (!deviceId && videoInputs.length > 0) {
        const activeTrack = localMediaStream.getVideoTracks()[0];
        const activeSettings = activeTrack ? activeTrack.getSettings() : null;
        if (activeSettings && activeSettings.deviceId) {
          setSelectedCameraId(activeSettings.deviceId);
        } else {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.error('Camera/Microphone access error:', err);
      setIsLocalStreamReady(false);
      setCameraError(
        err.message || 'Unable to access camera or microphone. Please check browser permissions and ensure no other application is using the microphone.'
      );
    }
  };

  // Effect to manage stream lifecycle and WebRTC connection when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      cleanupCall();
      initPeerConnection();
      startLocalStream(selectedCameraId);
    } else {
      cleanupCall();
    }

    return () => {
      cleanupCall();
    };
  }, [isOpen]);

  // Connect remote stream if provided via prop or peer connection
  const activeRemoteStream = remoteStream || peerRemoteStream;

  useEffect(() => {
    if (activeRemoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeRemoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn('Autoplay prevented for remote audio/video stream:', err);
      });
    }
  }, [activeRemoteStream]);

  // Handle camera device switch
  const handleCameraChange = (e) => {
    const newDeviceId = e.target.value;
    setSelectedCameraId(newDeviceId);
    startLocalStream(newDeviceId);
  };

  // Mute / Unmute Microphone
  const toggleMicrophone = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMicMuted; // Toggle enabled
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // Toggle Camera On / Off
  const toggleCamera = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const targetEnabled = isVideoOff; // If currently off, target is enabled = true
      videoTracks.forEach((track) => {
        track.enabled = targetEnabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Ensure local video stream attachment
  useEffect(() => {
    if (stream && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
      }
    }
  }, [stream, isVideoOff]);

  // Stop call and close modal
  const handleEndCall = () => {
    cleanupCall();
    onClose();
  };

  // Format call duration helper
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const isDoctor = userRole === 'DOCTOR';
  const remotePersonName = isDoctor ? patientName : doctorName;
  const remoteRoleLabel = isDoctor ? 'Patient' : 'Attending Physician';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          height: '90vh',
          maxHeight: '720px',
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '1.25rem',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          color: '#ffffff'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.75)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                padding: '0.3rem 0.75rem',
                borderRadius: '2rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 8px #22c55e'
                }}
              ></span>
              LIVE TELECONSULTATION
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {remotePersonName}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                {remoteRoleLabel} {appointmentId ? `• Appointment #${appointmentId}` : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '0.35rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: '#cbd5e1',
                fontWeight: 600
              }}
            >
              <Clock size={15} color="#38bdf8" />
              <span>{formatDuration(callDuration)}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <ShieldCheck size={14} />
              <span>WebRTC Encrypted</span>
            </div>

            <button
              onClick={handleEndCall}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Video Screen Container */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#090d16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {cameraError ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                maxWidth: '450px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '1rem',
                color: '#fca5a5'
              }}
            >
              <VideoOff size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Camera Access Restricted</h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem', color: '#f87171' }}>
                {cameraError}
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => startLocalStream(selectedCameraId)}
                style={{ gap: '0.4rem' }}
              >
                <RefreshCw size={14} /> Retry Camera Access
              </button>
            </div>
          ) : (
            <>
              {/* Remote Stream Video Area */}
              {activeRemoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#94a3b8'
                  }}
                >
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                      border: '3px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.25rem',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                    }}
                  >
                    <User size={48} color="#38bdf8" />
                  </div>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.4rem 0' }}>
                    Waiting for {remotePersonName} to join...
                  </h4>
                  <p style={{ fontSize: '0.85rem', maxWidth: '360px', margin: 0, color: '#64748b' }}>
                    The video connection will start automatically once {remotePersonName.toLowerCase()} enters the consultation room.
                  </p>
                </div>
              )}

              {/* Local Video Overlay (Picture-in-Picture) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.5rem',
                  right: '1.5rem',
                  width: '210px',
                  height: '145px',
                  background: '#1e293b',
                  borderRadius: '0.85rem',
                  border: '2px solid rgba(56, 189, 248, 0.4)',
                  overflow: 'hidden',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isVideoOff && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      fontSize: '0.75rem'
                    }}
                  >
                    <VideoOff size={24} style={{ marginBottom: '0.35rem' }} />
                    <span>Camera Paused</span>
                  </div>
                )}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirror local camera view
                    display: isVideoOff ? 'none' : 'block'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '0.4rem',
                    left: '0.4rem',
                    background: 'rgba(15, 23, 42, 0.75)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  You ({isDoctor ? 'Doctor' : 'Patient'})
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.92)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          {/* Camera Selection Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
            <Camera size={16} color="#38bdf8" />
            <select
              value={selectedCameraId}
              onChange={handleCameraChange}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '240px'
              }}
            >
              {cameraDevices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
              {cameraDevices.length === 0 && <option value="">Default Camera</option>}
            </select>
          </div>

          {/* Action Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Microphone Toggle Button */}
            <button
              onClick={toggleMicrophone}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                background: isMicMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isMicMuted ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
              }}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Camera Toggle Button */}
            <button
              onClick={toggleCamera}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                background: isVideoOff ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isVideoOff ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
              }}
              title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}
            >
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              style={{
                padding: '0 1.5rem',
                height: '48px',
                borderRadius: '2rem',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
              }}
            >
              <PhoneOff size={20} />
              <span>End Call</span>
            </button>
          </div>

          {/* Clinical Telemedicine Notice */}
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={14} color="#0284c7" />
            <span>FlowCare Telemedicine Station</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
