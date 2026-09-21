import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, X, RotateCcw, Check } from 'lucide-react';

export function ListToolbar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  sortKey = 'default',
  onSortChange,
  sortOptions = [],
  filterControls = null, // Custom JSX children for filter inputs
  activeFilterCount = 0,
  onClearFilters,
  extraActions = null // Additional buttons like Refresh or Add
}) {
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.85rem 1.15rem',
        marginBottom: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        {/* Left: Search | Filter | Sort Toolbar Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: '1 1 320px', flexWrap: 'wrap' }}>
          {/* 1. Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search
              size={17}
              color="#94a3b8"
              style={{ position: 'absolute', left: '11px', top: '10px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-control"
              style={{
                paddingLeft: '2.35rem',
                paddingRight: search ? '2rem' : '0.75rem',
                height: '38px',
                fontSize: '0.85rem',
                borderRadius: '8px'
              }}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange && onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Filter Toggle Button (if filter controls provided) */}
          {filterControls && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`btn btn-sm ${showFilterPanel || activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                style={{
                  height: '38px',
                  padding: '0 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '8px'
                }}
                title="Toggle Filters"
              >
                <Filter size={15} />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      background: showFilterPanel || activeFilterCount > 0 ? '#ffffff' : '#0284c7',
                      color: showFilterPanel || activeFilterCount > 0 ? '#0284c7' : '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '9999px',
                      marginLeft: '2px'
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* 3. Sort Selector */}
          {sortOptions && sortOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <ArrowUpDown
                  size={14}
                  color="#64748b"
                  style={{ position: 'absolute', left: '10px', pointerEvents: 'none', zIndex: 1 }}
                />
                <select
                  className="form-control"
                  style={{
                    paddingLeft: '2.1rem',
                    paddingRight: '1.75rem',
                    height: '38px',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    borderRadius: '8px',
                    width: 'auto',
                    minWidth: '150px'
                  }}
                  value={sortKey}
                  onChange={(e) => onSortChange && onSortChange(e.target.value)}
                  title="Sort List"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quick Clear Filter shortcut if active */}
          {activeFilterCount > 0 && onClearFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClearFilters}
              style={{
                height: '38px',
                padding: '0 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                color: '#dc2626',
                borderColor: '#fca5a5',
                background: '#fef2f2',
                fontSize: '0.8rem',
                borderRadius: '8px'
              }}
              title="Reset Filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Extra Action Buttons (e.g. Refresh, Add, etc.) */}
        {extraActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {extraActions}
          </div>
        )}
      </div>

      {/* Collapsible Filter Panel */}
      {filterControls && showFilterPanel && (
        <div
          style={{
            marginTop: '0.85rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid #f1f5f9',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Advanced Filter Options
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <RotateCcw size={12} /> Clear All Filters
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              alignItems: 'flex-end'
            }}
          >
            {filterControls}
          </div>
        </div>
      )}
    </div>
  );
}

export default ListToolbar;
