import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  // Clear any existing session on initial load so the application ALWAYS starts on the Login Page
  useEffect(() => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setLoading(false);
  }, []);

  const login = async (email, password, role = null) => {
    const payload = { email, password };
    if (role) payload.role = role;
    const data = await api.login(payload);
    setAuthToken(data.access_token);
    setToken(data.access_token);
    setUser({
      id: data.user_id,
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      patient_id: data.patient_id,
      patient_code: data.patient_code,
      doctor_id: data.doctor_id,
      doctor_code: data.doctor_code,
      doctor_specialization: data.doctor_specialization,
      department: data.department
    });
    return data;
  };

  const qrLogin = async (qrToken) => {
    const data = await api.qrPatientLogin(qrToken);
    setAuthToken(data.access_token);
    setToken(data.access_token);
    setUser({
      id: data.user_id,
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      patient_id: data.patient_id,
      patient_code: data.patient_code,
      doctor_id: data.doctor_id,
      doctor_code: data.doctor_code,
      doctor_specialization: data.doctor_specialization,
      department: data.department
    });
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, qrLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
