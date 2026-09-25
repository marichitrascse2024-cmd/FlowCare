import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Role Dashboards
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { ReceptionistDashboard } from './pages/ReceptionistDashboard';
import { NurseDashboard } from './pages/NurseDashboard';
import { PatientDashboard } from './pages/PatientDashboard';

// Feature Pages
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ScanSchedulingPage } from './pages/ScanSchedulingPage';
import { QueuePage } from './pages/QueuePage';
import { MedicalRecordsPage } from './pages/MedicalRecordsPage';
import { PrescriptionsPage } from './pages/PrescriptionsPage';
import { BillingPage } from './pages/BillingPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { ServicesCatalogPage } from './pages/ServicesCatalogPage';
import { PatientsPage } from './pages/PatientsPage';
import { DoctorsPage } from './pages/DoctorsPage';

export function App() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Reset tab to dashboard whenever user role changes
  useEffect(() => {
    setActiveTab('dashboard');
  }, [user?.role]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0284c7', fontSize: '1.25rem', fontWeight: 600 }}>
        Connecting to FlowCare System...
      </div>
    );
  }

  if (!user) {
    if (authMode === 'register') {
      return <Register onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthMode('register')} />;
  }

  const renderContent = () => {
    // 1. Dashboard Tab - Role-specific
    if (activeTab === 'dashboard') {
      switch (user.role) {
        case 'ADMIN':
          return <AdminDashboard onNavigate={setActiveTab} />;
        case 'DOCTOR':
          return <DoctorDashboard onNavigate={setActiveTab} />;
        case 'RECEPTIONIST':
          return <ReceptionistDashboard onNavigate={setActiveTab} />;
        case 'NURSE':
          return <NurseDashboard onNavigate={setActiveTab} />;
        case 'PATIENT':
        default:
          return <PatientDashboard onNavigate={setActiveTab} />;
      }
    }

    // 2. Common Feature Pages
    switch (activeTab) {
      case 'appointments':
        return <AppointmentsPage />;
      case 'scan_scheduling':
        return <ScanSchedulingPage />;
      case 'queue':
        return <QueuePage />;
      case 'medical_records':
        return <MedicalRecordsPage />;
      case 'prescriptions':
        return <PrescriptionsPage />;
      case 'billing':
        return <BillingPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UsersPage />;
      case 'services_catalog':
        return <ServicesCatalogPage />;
      case 'patients':
        return <PatientsPage />;
      case 'doctors':
        return <DoctorsPage />;
      default:
        return <AdminDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Navbar />
        <main className="page-body">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
