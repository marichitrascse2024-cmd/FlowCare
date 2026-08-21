import React, { useState } from 'react';
import { Receipt, Sparkles, AlertTriangle, ShieldCheck, Check, Trash2, Plus, Info } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../services/api';

export const AIBillingModal = ({ isOpen, onClose, patientId, appointmentId, onBillConfirmed }) => {
  const [loading, setLoading] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleGenerateDraft = async () => {
    if (!patientId && !appointmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getBillingAssistance({
        patient_id: patientId,
        appointment_id: appointmentId
      });
      setDraftData(res);
      setItems(res.draft_items || []);
      setDiscount(res.suggested_discount || 0);
      setTax(res.suggested_tax || 0);
    } catch (err) {
      setError(err.message || 'Failed to generate AI billing draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.unit_price * (item.quantity || 1)), 0);
  const calculateTotal = () => Math.max(0, calculateSubtotal() + Number(tax) - Number(discount));

  const handleConfirmBill = async () => {
    setConfirming(true);
    setError('');
    try {
      const billData = {
        patient_id: draftData.patient_id,
        appointment_id: draftData.appointment_id,
        discount_amount: Number(discount),
        tax_amount: Number(tax),
        is_draft: false, // confirmed by human staff
        ai_flags: draftData.ai_warnings && draftData.ai_warnings.length > 0 ? draftData.ai_warnings.join(' | ') : null,
        notes: notes || 'Verified by hospital front-desk / billing staff.',
        items: items.map(item => ({
          service_code: item.service_code,
          item_name: item.item_name,
          category: item.category,
          unit_price: item.unit_price,
          quantity: item.quantity || 1,
          subtotal_price: item.unit_price * (item.quantity || 1),
          is_ai_suggested: item.is_ai_suggested ?? true
        }))
      };

      const created = await api.createBill(billData);
      if (onBillConfirmed) {
        onBillConfirmed(created);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to confirm bill.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles color="#6366f1" size={20} />
          <span>AI Automated Billing Assistant</span>
        </div>
      }
      size="lg"
      footer={
        draftData ? (
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Final Amount: <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>₹{calculateTotal().toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-success" onClick={handleConfirmBill} disabled={confirming || items.length === 0}>
                <Check size={16} />
                {confirming ? 'Confirming...' : 'Staff Verify & Confirm Bill'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        )
      }
    >
      <div>
        {!draftData ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Receipt size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
              Generate AI-Assisted Invoice Draft
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
              The AI Billing Assistant will analyze consultation notes, diagnostic lab orders, pharmacy prescriptions, and clinic procedures to prepare an itemized draft bill.
            </p>
            <button className="btn btn-ai" onClick={handleGenerateDraft} disabled={loading}>
              <Sparkles size={16} />
              {loading ? 'Analyzing Clinical Records...' : 'Generate AI Draft Bill'}
            </button>
          </div>
        ) : (
          <div>
            {/* AI Warning Alerts / Anomaly Flags */}
            {draftData.ai_warnings && draftData.ai_warnings.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#b45309', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <AlertTriangle size={16} />
                  AI Billing Anomaly / Duplicate Flags:
                </div>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#92400e' }}>
                  {draftData.ai_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Patient Header */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Patient</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{draftData.patient_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Status</span>
                <div><span className="badge badge-warning">AI Draft (Pending Staff Review)</span></div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="table-container" style={{ marginBottom: '1.25rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Item & Service</th>
                    <th>Category</th>
                    <th>Rate</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.item_name}</div>
                        {item.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Info size={12} /> {item.reasoning}
                          </div>
                        )}
                      </td>
                      <td><span className="badge badge-neutral">{item.category}</span></td>
                      <td>₹{item.unit_price.toFixed(2)}</td>
                      <td>{item.quantity || 1}</td>
                      <td style={{ fontWeight: 600 }}>₹{(item.unit_price * (item.quantity || 1)).toFixed(2)}</td>
                      <td>
                        <button 
                          onClick={() => handleRemoveItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Staff adjustments */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Subtotal</label>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>₹{calculateSubtotal().toFixed(2)}</div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount (₹)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={discount} 
                  onChange={(e) => setDiscount(e.target.value)} 
                  min="0"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Tax (5% Healthcare Tax)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={tax} 
                  onChange={(e) => setTax(e.target.value)} 
                  min="0"
                />
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.75rem', color: '#166534' }}>
                <strong>Staff Confirmation Rule:</strong> The AI Assistant prepares drafts only. Authorized hospital staff must verify and confirm the bill before final invoice release.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginTop: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
