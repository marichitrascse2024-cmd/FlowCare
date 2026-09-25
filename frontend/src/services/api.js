const envBase = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '') : '';
const API_BASE_URL = envBase ? (envBase.endsWith('/api') ? envBase : `${envBase}/api`) : '/api';

let activeAuthToken = null;

export const setAuthToken = (token) => {
  activeAuthToken = token;
  if (token) {
    sessionStorage.setItem('flowcare_token', token);
  } else {
    sessionStorage.removeItem('flowcare_token');
    localStorage.removeItem('flowcare_token');
  }
};

export const getAuthToken = () => {
  return activeAuthToken || sessionStorage.getItem('flowcare_token') || null;
};

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.detail) || response.statusText || 'An unexpected error occurred.';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  faceLogin: (imageData, role) => request('/auth/face-login', { method: 'POST', body: JSON.stringify({ image_data: imageData, role }) }),
  registerFace: (imageData, userId) => request('/auth/register-face', { method: 'POST', body: JSON.stringify({ image_data: imageData, user_id: userId }) }),
  googleLogin: (payload) => request('/auth/google-login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (patientData) => request('/auth/register', { method: 'POST', body: JSON.stringify(patientData) }),
  getMe: () => request('/auth/me'),
  changePassword: (data) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),

  // Users (Admin)
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (userData) => request('/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (id, userData) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),

  // Patients
  getPatients: (search = '') => request(`/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dynamic QR Codes & Universal Patient Verification (Universal QR System)
  qrPatientLogin: (qrToken) => request('/auth/patient/qr-login', { method: 'POST', body: JSON.stringify({ qr_token: qrToken }) }),
  verifyPatientQR: (qrToken, module = 'GENERAL') => request('/patient/qr/verify', { method: 'POST', body: JSON.stringify({ qr_token: qrToken, module }) }),
  getPatientQRCode: (patientId) => request(`/patients/${patientId}/qr`),
  regeneratePatientQRCode: (patientId) => request(`/patients/${patientId}/qr`, { method: 'POST' }),
  scanQRCode: (qrToken, module = 'GENERAL') => request('/patient/qr/verify', { method: 'POST', body: JSON.stringify({ qr_token: qrToken, module }) }),

  // Doctors
  getDoctors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/doctors${qs ? `?${qs}` : ''}`);
  },
  getDoctorsByDepartment: (dept) => request(`/doctors/department/${encodeURIComponent(dept)}`),
  getDoctorAvailableSlots: (doctorId, date) => request(`/doctors/${doctorId}/slots${date ? `?date=${date}` : ''}`),
  getDoctor: (id) => request(`/doctors/${id}`),
  createDoctor: (data) => request('/doctors', { method: 'POST', body: JSON.stringify(data) }),
  updateDoctor: (id, data) => request(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Doctor Recommendation System (Feature 4)
  getDoctorRecommendations: (symptoms, targetDate = '') => request('/doctor-recommendation', {
    method: 'POST',
    body: JSON.stringify({ symptoms, target_date: targetDate || undefined })
  }),

  // Doctor Specific Portal (Determined by Auth Token)
  getDoctorSelfProfile: () => request('/doctor/profile'),
  doctorCheckIn: () => request('/doctor/check-in', { method: 'POST' }),
  getDoctorSelfAppointments: (date = '') => request(`/doctor/appointments${date ? `?appointment_date=${date}` : ''}`),
  getDoctorSelfQueue: (status = '') => request(`/doctor/queue${status ? `?status=${status}` : ''}`),
  getDoctorSelfPatients: (search = '') => request(`/doctor/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // Appointments
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/appointments${qs ? `?${qs}` : ''}`);
  },
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  getAppointment: (id) => request(`/appointments/${id}`),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Queue
  checkIn: (data) => request('/queue/check-in', { method: 'POST', body: JSON.stringify(data) }),
  getQueue: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/queue${qs ? `?${qs}` : ''}`);
  },
  getPatientQueue: (patientId) => request(`/queue/patient/${patientId}`),
  advanceQueue: (doctorId) => request(`/queue/advance/${doctorId}`, { method: 'POST' }),
  updateQueueStatus: (queueId, data) => request(`/queue/${queueId}/status`, { method: 'PUT', body: JSON.stringify(data) }),

  // Medical Records (Hybrid Encrypted) (Feature 2)
  getPatientMedicalRecords: (patientId) => request(`/medical-records/patient/${patientId}`),
  createMedicalRecord: (data) => request('/medical-records', { method: 'POST', body: JSON.stringify(data) }),

  // Prescriptions
  getPatientPrescriptions: (patientId) => request(`/prescriptions/patient/${patientId}`),
  createPrescription: (data) => request('/prescriptions', { method: 'POST', body: JSON.stringify(data) }),

  // Billing
  getHospitalServices: (category = '') => request(`/bills/services${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createHospitalService: (data) => request('/bills/services', { method: 'POST', body: JSON.stringify(data) }),
  getBills: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bills${qs ? `?${qs}` : ''}`);
  },
  getBill: (id) => request(`/bills/${id}`),
  createBill: (data) => request('/bills', { method: 'POST', body: JSON.stringify(data) }),
  confirmBill: (id, data = {}) => request(`/bills/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
  payBill: (id, data) => request(`/bills/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),

  // AI Modules & Disease Risk Prediction (Feature 3)
  evaluateDiseaseRisk: (data) => request('/ai/disease-risk', { method: 'POST', body: JSON.stringify(data) }),
  getPatientRiskPredictions: (patientId) => request(`/patients/${patientId}/risk-predictions`),
  predictWaitingTime: (data) => request('/ai/waiting-time', { method: 'POST', body: JSON.stringify(data) }),
  suggestSlots: (data) => request('/ai/appointment-suggestion', { method: 'POST', body: JSON.stringify(data) }),
  getMedicalSummary: (data) => request('/ai/medical-summary', { method: 'POST', body: JSON.stringify(data) }),
  getBillingAssistance: (data) => request('/ai/billing-assistance', { method: 'POST', body: JSON.stringify(data) }),

  // Cloud Synchronization (Feature 5)
  getCloudSyncStatus: () => request('/sync/status'),
  triggerCloudSync: () => request('/sync/run', { method: 'POST' }),
  retryCloudSync: () => request('/sync/retry', { method: 'POST' }),

  // Notifications
  getNotifications: (unreadOnly = false) => request(`/notifications?unread_only=${unreadOnly}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),

  // Reports & Analytics
  getDashboardAnalytics: () => request('/reports/dashboard'),

  // Scan Scheduling
  getScanSchedules: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/scan-schedules${qs ? `?${qs}` : ''}`);
  },
  getScanSchedule: (id) => request(`/scan-schedules/${id}`),
  createScanSchedule: (data) => request('/scan-schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateScanSchedule: (id, data) => request(`/scan-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelScanSchedule: (id) => request(`/scan-schedules/${id}/cancel`, { method: 'PUT' }),
  getScanSlots: (date, scanType) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (scanType) params.append('scan_type', scanType);
    const qs = params.toString();
    return request(`/scan-schedules/slots${qs ? `?${qs}` : ''}`);
  }
};
