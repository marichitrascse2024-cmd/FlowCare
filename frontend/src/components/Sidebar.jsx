import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  UserPlus, 
  Stethoscope, 
  ClipboardList, 
  FileText, 
  Receipt, 
  BarChart3, 
  Layers, 
  Shield, 
  Clock, 
  Activity,
  HeartPulse
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const role = user?.role || 'PATIENT';

  const getNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
          { id: 'appointments', label: 'Appointments', icon: Calendar },
          { id: 'scan_scheduling', label: 'Scan Scheduling', icon: Activity },
          { id: 'queue', label: 'Live Queue & Tokens', icon: Clock },
          { id: 'patients', label: 'Patients', icon: Users },
          { id: 'doctors', label: 'Doctors', icon: Stethoscope },
          { id: 'medical_records', label: 'Medical Records', icon: FileText },
          { id: 'billing', label: 'Billing & Invoices', icon: Receipt },
          { id: 'services_catalog', label: 'Hospital Services', icon: Layers },
          { id: 'users', label: 'User Accounts', icon: Shield },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 }
        ];

      case 'DOCTOR':
        return [
          { id: 'dashboard', label: 'Doctor Dashboard', icon: LayoutDashboard },
          { id: 'scan_scheduling', label: 'Scan Scheduling', icon: Activity },
          { id: 'queue', label: 'Patient Queue', icon: Clock },
          { id: 'appointments', label: "Today's Schedule", icon: Calendar },
          { id: 'medical_records', label: 'Consultation Records', icon: FileText },
          { id: 'prescriptions', label: 'Prescriptions', icon: ClipboardList },
          { id: 'patients', label: 'Patient Directory', icon: Users }
        ];

      case 'RECEPTIONIST':
        return [
          { id: 'dashboard', label: 'Reception Dashboard', icon: LayoutDashboard },
          { id: 'scan_scheduling', label: 'Scan Scheduling', icon: Activity },
          { id: 'queue', label: 'Check-In & Queue', icon: Clock },
          { id: 'appointments', label: 'Appointment Desk', icon: Calendar },
          { id: 'patients', label: 'Patient Registration', icon: UserPlus },
          { id: 'doctors', label: 'Doctor Availability', icon: Stethoscope },
          { id: 'billing', label: 'Billing & Invoices', icon: Receipt }
        ];

      case 'NURSE':
        return [
          { id: 'dashboard', label: 'Nurse Station', icon: LayoutDashboard },
          { id: 'scan_scheduling', label: 'Scan Scheduling', icon: Activity },
          { id: 'queue', label: 'Queue & Triage', icon: Clock },
          { id: 'appointments', label: 'Appointments', icon: Calendar },
          { id: 'patients', label: 'Assigned Patients', icon: Users },
          { id: 'medical_records', label: 'Vitals & Records', icon: FileText }
        ];

      case 'PATIENT':
      default:
        return [
          { id: 'dashboard', label: 'My Health Portal', icon: LayoutDashboard },
          { id: 'scan_scheduling', label: 'Scan Scheduling', icon: Activity },
          { id: 'appointments', label: 'Book Appointment', icon: Calendar },
          { id: 'queue', label: 'Live Queue & Token', icon: Clock },
          { id: 'medical_records', label: 'My Medical Records', icon: FileText },
          { id: 'prescriptions', label: 'My Prescriptions', icon: ClipboardList },
          { id: 'billing', label: 'My Invoices', icon: Receipt }
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <HeartPulse size={26} color="#38bdf8" />
          <span>FlowCare</span>
        </div>
      </div>

      <div className="sidebar-nav">
        <div style={{ padding: '0 0.5rem 0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {role} Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
          <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '0.2rem' }}>FlowCare v1.0</div>
          <div>FastAPI • React • MySQL • AI</div>
        </div>
      </div>
    </aside>
  );
};
