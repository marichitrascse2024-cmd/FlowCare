import React, { useState, useEffect } from 'react';
import { Receipt, Sparkles, Plus, CreditCard, CheckCircle2, AlertTriangle, Search, Filter, Printer, FileText, RefreshCw, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { AIBillingModal } from '../components/AIBillingModal';
import { PatientQRScanner } from '../components/PatientQRScanner';
import { api } from '../services/api';

export const BillingPage = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [patients, setPatients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // AI Billing Assistant Modal
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedPatientForAI, setSelectedPatientForAI] = useState('');
  const [showQRBillingModal, setShowQRBillingModal] = useState(false);

  // Selected Bill Details Modal
  const [selectedBill, setSelectedBill] = useState(null);

  // Pay Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paying, setPaying] = useState(false);

  const loadBills = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }
    try {
      const params = {};
      if (statusFilter) params.payment_status = statusFilter;

      const [billsData, patsData] = await Promise.all([
        api.getBills(params),
        user?.role !== 'PATIENT' ? api.getPatients() : Promise.resolve([])
      ]);
      setBills(billsData);
      setPatients(patsData);
    } catch (err) {
      console.error('Failed to load bills:', err);
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
    loadBills();
  }, [statusFilter]);

  const handleOpenPay = (bill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.total_amount);
    setShowPayModal(true);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedBill) return;
    setPaying(true);
    try {
      await api.payBill(selectedBill.id, {
        payment_method: paymentMethod,
        amount_paid: parseFloat(paymentAmount),
        transaction_reference: `TXN-${Date.now()}`,
        notes: `Payment received via ${paymentMethod}`
      });
      alert('Payment recorded successfully!');
      setShowPayModal(false);
      await loadBills(true);
    } catch (err) {
      alert(err.message || 'Payment recording failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Billing & Invoices Station</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Itemized bills, AI automated draft generation, and payment processing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {user?.role !== 'PATIENT' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowQRBillingModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#0284c7', color: '#0284c7' }}
            >
              <QrCode size={14} /> Scan Patient QR
            </button>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => loadBills(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Invoices'}
          </button>
          {user?.role !== 'PATIENT' && (
            <button className="btn btn-ai btn-sm" onClick={() => setShowAIModal(true)}>
              <Sparkles size={14} /> AI Billing Assistant
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {refreshError}
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Filter by Payment Status:</label>
          <select
            className="form-control"
            style={{ maxWidth: '220px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partially Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Subtotal</th>
                <th>Tax / Disc</th>
                <th>Total (₹)</th>
                <th>Status</th>
                <th>Draft / AI</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td><strong style={{ color: '#0284c7' }}>{b.bill_number}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.patient_name}</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.patient_code}</span>
                  </td>
                  <td>₹{b.subtotal.toFixed(2)}</td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      +₹{b.tax_amount.toFixed(2)} / -₹{b.discount_amount.toFixed(2)}
                    </span>
                  </td>
                  <td><strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>₹{b.total_amount.toFixed(2)}</strong></td>
                  <td><Badge status={b.payment_status} /></td>
                  <td>
                    {b.is_draft ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        Draft / Review
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        Verified
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => setSelectedBill(b)}
                      >
                        <FileText size={12} /> View Details
                      </button>
                      {b.payment_status !== 'PAID' && user?.role !== 'PATIENT' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => handleOpenPay(b)}
                        >
                          <CreditCard size={12} /> Collect
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Billing Modal */}
      <AIBillingModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        patients={patients}
        onBillCreated={loadBills}
      />

      {/* Bill Details Modal */}
      {selectedBill && (
        <Modal
          isOpen={Boolean(selectedBill)}
          onClose={() => setSelectedBill(null)}
          title={`Invoice Details: ${selectedBill.bill_number}`}
          size="lg"
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>FlowCare Multispeciality Clinic</h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Patient: <strong>{selectedBill.patient_name}</strong> ({selectedBill.patient_code})</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Badge status={selectedBill.payment_status} />
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Date: {new Date(selectedBill.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>Itemized Breakdown</h5>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Service / Item</th>
                      <th>Category</th>
                      <th>Unit Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          {it.item_name}
                          {it.is_ai_suggested && (
                            <span style={{ fontSize: '0.7rem', color: '#6366f1', marginLeft: '0.4rem', fontWeight: 600 }}>✦ AI Item</span>
                          )}
                        </td>
                        <td><span className="badge badge-info">{it.category}</span></td>
                        <td>₹{it.unit_price.toFixed(2)}</td>
                        <td>{it.quantity}</td>
                        <td><strong>₹{it.subtotal_price.toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{selectedBill.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Discount:</span>
                  <span>-₹{selectedBill.discount_amount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Taxes (5% GST):</span>
                  <span>+₹{selectedBill.tax_amount.toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem' }}>
                  <span>Grand Total:</span>
                  <span>₹{selectedBill.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedBill(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={14} /> Print Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Collect Payment Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`Process Payment for ${selectedBill?.bill_number}`}
      >
        <form onSubmit={handleProcessPayment}>
          <div className="form-group">
            <label className="form-label">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <select
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
              <option value="NET_BANKING">Net Banking</option>
              <option value="INSURANCE">Insurance Claim</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={paying}>
              {paying ? 'Recording...' : `Confirm Payment of ₹${paymentAmount}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Patient QR Scanner Modal for Billing */}
      <Modal
        isOpen={showQRBillingModal}
        onClose={() => setShowQRBillingModal(false)}
        title="Scan Patient QR"
      >
        <PatientQRScanner
          module="BILLING"
          title="Scan Patient QR"
          customActionLabel="Open Invoices & AI Billing Assistant"
          onCustomAction={(patientData) => {
            setSelectedPatientForAI(patientData.patient_id.toString());
            setShowQRBillingModal(false);
            setShowAIModal(true);
          }}
          onCancel={() => setShowQRBillingModal(false)}
        />
      </Modal>
    </div>
  );
};
