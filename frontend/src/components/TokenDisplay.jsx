import React from 'react';
import { Activity, Clock, Users, ArrowRight } from 'lucide-react';

export const TokenDisplay = ({ currentToken, nextToken, waitingCount = 0, avgWait = 15, roomNumber = '101' }) => {
  return (
    <div className="token-banner">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Activity size={16} color="#38bdf8" />
          Live Clinic Patient Flow
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>NOW CONSULTING</div>
            <div className="token-highlight">{currentToken || '—'}</div>
          </div>
          {roomNumber && (
            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
              {roomNumber}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Next in Line</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>{nextToken || '—'}</div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Users size={12} /> Waiting
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>{waitingCount}</div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} /> AI Est. Wait
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>~{avgWait}m</div>
        </div>
      </div>
    </div>
  );
};
