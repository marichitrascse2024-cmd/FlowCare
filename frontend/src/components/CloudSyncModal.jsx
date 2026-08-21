import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Clock, Server, ArrowUpRight, X } from 'lucide-react';
import { api } from '../services/api';

export default function CloudSyncModal({ isOpen, onClose }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCloudSyncStatus();
      setSyncStatus(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch sync status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunSync = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);
      const res = await api.triggerCloudSync();
      setMessage(res.message || 'Sync cycle executed.');
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Cloud synchronization failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);
      const res = await api.retryCloudSync();
      setMessage(res.message || 'Retry cycle executed.');
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Retry operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'CONNECTED') return 'badge-success';
    if (status === 'PENDING' || status === 'RETRYING') return 'badge-warning';
    return 'badge-secondary';
  };

  return (
    <div className="modal-backdrop" style={{
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
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="card shadow-2xl" style={{
        background: '#ffffff',
        borderRadius: '1.25rem',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '1rem',
              top: '1rem',
              background: 'rgba(255, 255, 255, 0.2)',
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
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '0.6rem',
              borderRadius: '0.75rem'
            }}>
              <Cloud size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Cloud Synchronization Center</h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: '0.2rem 0 0 0' }}>Multi-Node Hospital Data Replication & Audit Queue</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={36} className="spin-animate" style={{ margin: '0 auto 1rem auto', color: '#0284c7' }} />
              <p>Inspecting Cloud Sync Queue & Heartbeat...</p>
            </div>
          ) : (
            <div>
              {/* Status Overview Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>STATUS</div>
                  <div style={{ marginTop: '0.3rem' }}>
                    <span className={`badge ${getStatusBadgeClass(syncStatus?.status)}`}>
                      {syncStatus?.status || 'OFFLINE'}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>PENDING QUEUE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f59e0b', marginTop: '0.2rem' }}>
                    {syncStatus?.pending_records ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>SYNCHRONIZED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#10b981', marginTop: '0.2rem' }}>
                    {syncStatus?.synced_records ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>FAILED / RETRY</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ef4444', marginTop: '0.2rem' }}>
                    {syncStatus?.failed_records ?? 0}
                  </div>
                </div>
              </div>

              {/* Endpoint Meta */}
              <div style={{
                background: '#f1f5f9',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Server size={16} color="#0284c7" />
                  <span><strong>Endpoint:</strong> {syncStatus?.cloud_endpoint || 'Local Isolation'}</span>
                </div>
                <div>
                  <strong>Mode:</strong> {syncStatus?.cloud_sync_enabled ? 'Active Online Sync' : 'Local Offline (Safe)'}
                </div>
              </div>

              {/* Alerts */}
              {message && (
                <div style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{message}</span>
                </div>
              )}

              {error && (
                <div style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleRunSync}
                  disabled={actionLoading}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <RefreshCw size={16} className={actionLoading ? "spin-animate" : ""} />
                  Trigger Cloud Sync Batch
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={handleRetryFailed}
                  disabled={actionLoading || (syncStatus?.failed_records === 0)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <ArrowUpRight size={16} />
                  Retry Failed Syncs
                </button>
              </div>

              {/* Recent Audit Trail */}
              <div>
                <h5 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: '#1e293b' }}>
                  Recent Sync Audit Queue
                </h5>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <table className="table" style={{ fontSize: '0.8rem', margin: 0 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th>Sync ID</th>
                        <th>Entity</th>
                        <th>Op</th>
                        <th>Status</th>
                        <th>Retries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncStatus?.recent_records && syncStatus.recent_records.length > 0 ? (
                        syncStatus.recent_records.map((r) => (
                          <tr key={r.id}>
                            <td style={{ fontFamily: 'monospace' }}>{r.sync_id}</td>
                            <td><strong>{r.entity_type}</strong> #{r.entity_id}</td>
                            <td><span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{r.operation}</span></td>
                            <td>
                              <span className={`badge ${r.sync_status === 'SYNCED' ? 'badge-success' : r.sync_status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                {r.sync_status}
                              </span>
                            </td>
                            <td>{r.retry_count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                            No sync transactions logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
