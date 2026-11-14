import React from 'react';

const SOURCE_CONFIG = {
  parquet: {
    label: 'Parquet archive',
    description: 'Verified pre-aggregated satellite archive (MODIS/VIIRS SP)',
    className: 'alatoo-badge--parquet',
  },
  mock: {
    label: 'Mock fixtures (demo)',
    description: 'Warning: displaying static contract fixtures, not live satellite Parquet data',
    className: 'alatoo-badge--mock',
  },
  nrt: {
    label: 'NRT (Near Real-Time)',
    description: 'Near Real-Time observations subject to operational latency and later SP refinement',
    className: 'alatoo-badge--nrt',
  },
};

function BadgeIcon({ source }) {
  if (source === 'parquet') {
    return (
      <svg
        className="alatoo-badge__icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M5.25 8.25 7 10l3.75-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (source === 'nrt') {
    return (
      <svg
        className="alatoo-badge__icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg
      className="alatoo-badge__icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M8 2.25 14.25 13.25H1.75L8 2.25Z"
        strokeLinejoin="round"
      />
      <path d="M8 6.5v3" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Displays the active data source status (`parquet`, `mock`, or `nrt`).
 * Renders a prominent warning style when `source === 'mock'`.
 */
export function DataSourceBadge({ source = 'mock', label, className = '' }) {
  const normalized = SOURCE_CONFIG[source] ? source : 'mock';
  const cfg = SOURCE_CONFIG[normalized];
  const displayLabel = label || cfg.label;

  return (
    <span
      role="status"
      title={cfg.description}
      aria-label={`Data source: ${displayLabel}. ${cfg.description}`}
      className={`alatoo-badge ${cfg.className} ${className}`.trim()}
      data-source={normalized}
    >
      <BadgeIcon source={normalized} />
      <span>{displayLabel}</span>
    </span>
  );
}
