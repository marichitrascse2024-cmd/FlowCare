import React from 'react';

export const Badge = ({ status, type = 'status' }) => {
  if (!status) return null;

  let badgeClass = 'badge-neutral';
  const s = status.toUpperCase();

  if (['COMPLETED', 'CONFIRMED', 'PAID', 'ACTIVE', 'NORMAL'].includes(s)) {
    badgeClass = 'badge-success';
  } else if (['WAITING', 'PENDING', 'BOOKED', 'CALLED', 'PARTIAL', 'URGENT'].includes(s)) {
    badgeClass = 'badge-warning';
  } else if (['CANCELLED', 'SUSPENDED', 'NO_SHOW', 'EMERGENCY', 'HIGH'].includes(s)) {
    badgeClass = 'badge-danger';
  } else if (['IN_CONSULTATION', 'CHECKED_IN', 'SPECIALIST', 'ELDERLY'].includes(s)) {
    badgeClass = 'badge-primary';
  }

  const formatText = (text) => text.replace(/_/g, ' ');

  return (
    <span className={`badge ${badgeClass}`}>
      {formatText(status)}
    </span>
  );
};
