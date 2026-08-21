import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

export const PasswordInput = ({
  label,
  value,
  onChange,
  name = 'password',
  id,
  placeholder = '••••••••',
  required = false,
  className = '',
  style = {},
  disabled = false,
  autoComplete = 'current-password',
  showLeftIcon = true
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`form-group ${className}`} style={{ ...style }}>
      {label && <label className="form-label" htmlFor={id || name}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {showLeftIcon && (
          <Lock
            size={18}
            color="#94a3b8"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          />
        )}
        <input
          id={id || name}
          name={name}
          type={showPassword ? 'text' : 'password'}
          className="form-control"
          style={{
            paddingLeft: showLeftIcon ? '2.4rem' : '0.85rem',
            paddingRight: '2.5rem',
            width: '100%'
          }}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex="-1"
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: showPassword ? '#0284c7' : '#94a3b8',
            borderRadius: '4px',
            transition: 'color 0.2s ease'
          }}
          title={showPassword ? 'Hide password' : 'Show password'}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;
