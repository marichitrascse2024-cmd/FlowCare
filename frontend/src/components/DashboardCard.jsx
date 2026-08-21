import React from 'react';

export const DashboardCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend }) => {
  return (
    <div className="stat-card">
      <div>
        <span className="stat-label">{title}</span>
        <div className="stat-value">{value}</div>
        {subtitle && <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{subtitle}</p>}
        {trend && (
          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            {trend}
          </span>
        )}
      </div>
      {Icon && (
        <div className={`stat-icon ${color}`}>
          <Icon size={24} />
        </div>
      )}
    </div>
  );
};
