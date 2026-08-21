import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Tag, DollarSign, Edit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { api } from '../services/api';

export const ServicesCatalogPage = () => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Service Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    service_code: '',
    service_name: '',
    category: 'Laboratory',
    base_price: 500.0,
    description: ''
  });

  const loadServices = async () => {
    try {
      const data = await api.getHospitalServices(categoryFilter);
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [categoryFilter]);

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await api.createHospitalService({
        ...serviceForm,
        base_price: parseFloat(serviceForm.base_price)
      });
      alert('Service added to price catalog successfully!');
      setShowAddModal(false);
      await loadServices();
    } catch (err) {
      alert(err.message || 'Failed to add service.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Hospital Services Price Catalog</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Configured consultation rates, diagnostic laboratory tests, radiology procedures, and surgery items</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Billable Service
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Filter by Department/Category:</label>
          <select
            className="form-control"
            style={{ maxWidth: '250px' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Consultation">Consultations</option>
            <option value="Laboratory">Laboratory & Pathology</option>
            <option value="Radiology">Radiology & Imaging</option>
            <option value="Procedure">Clinical Procedures</option>
            <option value="Pharmacy">Pharmacy Products</option>
          </select>
        </div>
      </div>

      {/* Services Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Service Code</th>
                <th>Service Description</th>
                <th>Category</th>
                <th>Standard Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td><strong style={{ color: '#0284c7' }}>{s.service_code}</strong></td>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>{s.service_name}</td>
                  <td><span className="badge badge-primary">{s.category}</span></td>
                  <td>
                    <strong style={{ fontSize: '1rem', color: '#059669' }}>
                      ₹{s.base_price.toFixed(2)}
                    </strong>
                  </td>
                  <td><span className="badge badge-success">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Service Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Billable Hospital Service"
      >
        <form onSubmit={handleCreateService}>
          <div className="form-group">
            <label className="form-label">Service Code *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. SRV-LAB-THYROID"
              value={serviceForm.service_code}
              onChange={(e) => setServiceForm({...serviceForm, service_code: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Service Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Thyroid Stimulating Hormone (TSH) Test"
              value={serviceForm.service_name}
              onChange={(e) => setServiceForm({...serviceForm, service_name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <select
              className="form-control"
              value={serviceForm.category}
              onChange={(e) => setServiceForm({...serviceForm, category: e.target.value})}
              required
            >
              <option value="Consultation">Consultation</option>
              <option value="Laboratory">Laboratory</option>
              <option value="Radiology">Radiology</option>
              <option value="Procedure">Procedure</option>
              <option value="Pharmacy">Pharmacy</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Base Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={serviceForm.base_price}
              onChange={(e) => setServiceForm({...serviceForm, base_price: e.target.value})}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Service</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
