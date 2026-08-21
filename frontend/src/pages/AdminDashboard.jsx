import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Stethoscope, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Shield, 
  Layers, 
  Activity,
  Plus,
  RefreshCw,
  Cloud,
  Lock
} from 'lucide-react';
import { DashboardCard } from '../components/DashboardCard';
import { TokenDisplay } from '../components/TokenDisplay';
import { Badge } from '../components/Badge';
import CloudSyncModal from '../components/CloudSyncModal';
import { api } from '../services/api';

export const AdminDashboard = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const [analytics, queueList] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getQueue()
      ]);
      setData(analytics);
      setQueue(queueList);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      if (isManualRefresh) {
        setRefreshError('Unable to refresh data. Please try again.');
      }
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => loadDashboardData(false), 10000); // 10s auto-sync
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading hospital operations dashboard...</div>;
  }

  const activeConsultation = queue.find(q => q.status === 'IN_CONSULTATION');
  const nextWaiting = queue.find(q => q.status === 'WAITING' || q.status === 'CALLED');

  return (
    <div>
      {/* Header & Quick Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Hospital Operations Command Center</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Real-time clinic throughput, queue analytics, and financial overview across all departments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowCloudSyncModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7' }}
          >
            <Cloud size={14} /> Cloud Synchronization
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('users')}>
            <Plus size={14} /> New User
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reports')}>
            <TrendingUp size={14} /> Full Analytics
          </button>
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Live Digital Waiting Room Ticker */}
      <TokenDisplay
        currentToken={activeConsultation?.token_number}
        nextToken={nextWaiting?.token_number}
        waitingCount={data?.patients_waiting || 0}
        avgWait={data?.average_wait_time_today || 15}
        roomNumber={activeConsultation?.room_number || 'OPD'}
      />

      {/* Stat Cards Grid */}
      <div className="dashboard-grid">
        <DashboardCard
          title="Total Registered Patients"
          value={data?.total_patients || 0}
          subtitle="Electronic health profiles"
          icon={Users}
          color="primary"
        />
        <DashboardCard
          title="Today's Appointments"
          value={data?.today_appointments || 0}
          subtitle={`${data?.completed_consultations_today || 0} completed`}
          icon={Calendar}
          color="info"
        />
        <DashboardCard
          title="Available Doctors"
          value={`${data?.available_doctors || 0} / ${data?.total_doctors || 0}`}
          subtitle="Across all 12 departments"
          icon={Stethoscope}
          color="success"
        />
        <DashboardCard
          title="Patients In Queue"
          value={data?.patients_waiting || 0}
          subtitle={`Avg wait ~${data?.average_wait_time_today || 0}m`}
          icon={Clock}
          color="warning"
        />
        <DashboardCard
          title="Today's Hospital Revenue"
          value={`₹${(data?.today_revenue || 0).toLocaleString()}`}
          subtitle={`Total: ₹${(data?.total_revenue || 0).toLocaleString()}`}
          icon={DollarSign}
          color="success"
        />
        <DashboardCard
          title="Security & Cloud Status"
          value="HYBRID ACTIVE"
          subtitle="AES-256 + RSA Enveloped"
          icon={Shield}
          color="success"
        />
      </div>

      {/* Tables Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Live Patient Flow Queue Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={18} color="#0284c7" />
              Live Hospital Patient Queue
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('queue')}>
              View All Queue
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor & Dept</th>
                  <th>Pos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 5).map((q) => (
                  <tr key={q.id}>
                    <td><strong style={{ color: '#0284c7' }}>{q.token_number}</strong></td>
                    <td>{q.patient_name}</td>
                    <td>
                      <div>{q.doctor_name}</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{q.department || q.doctor_specialization}</span>
                    </td>
                    <td>#{q.queue_position}</td>
                    <td><Badge status={q.status} /></td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                      No active patient queue currently.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Activity and Modules */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Shield size={18} color="#10b981" />
              Department Operations & Cloud Hub
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Cloud Replication & Audit Hub</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Manage multi-entity cloud sync, status, and retry queues</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCloudSyncModal(true)}>
                <Cloud size={14} /> Open Sync Center
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>12 Clinical Departments</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Cardiology, Ortho, General Medicine, Pediatrics, Derma, Neuro, etc.</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('doctors')}>
                View Directory
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Hybrid Encrypted Medical Records</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>AES-256-GCM + RSA-2048 enveloped clinical consultation notes</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('patients')}>
                View Patients
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
      />
    </div>
  );
};
