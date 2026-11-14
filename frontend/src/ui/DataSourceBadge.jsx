import React from 'react';

const SOURCE_META = {
  parquet: {
    label: 'PARQUET',
    badgeClass: 'alatoo-badge--parquet',
    title: 'Precomputed Parquet archive',
  },
  mock: {
    label: 'MOCK',
    badgeClass: 'alatoo-badge--mock',
    title: 'Contract fixture preview (not live satellite data)',
  },
  nrt: {
    label: 'NRT',
    badgeClass: 'alatoo-badge--nrt',
    title: 'Near Real-Time feed (subject to archival refinement)',
  },
};

/**
 * Displays the active data source (parquet / mock / nrt), a clear warning
 * when running on mock fixtures, and the unified measurement unit.
 */
export function DataSourceBadge({
  source = 'mock',
  unit = 'hotspot_days_1km',
  className = '',
}) {
  const normalized = String(source || 'mock').toLowerCase();
  const meta = SOURCE_META[normalized] || SOURCE_META.mock;
  const unitLabel =
    unit === 'hotspot_days_1km' ? 'hotspot-days, 1 km' : String(unit);

  return (
    <div
      className={`alatoo-source-bar ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span
        className={`alatoo-badge ${meta.badgeClass}`}
        title={meta.title}
      >
        Source: {meta.label}
      </span>

      <span className="alatoo-unit-chip" title={`API unit: ${unit}`}>
        Unit: {unitLabel}
      </span>

      {normalized === 'mock' && (
        <span className="alatoo-mock-note">
          Showing contract fixture data (not live NASA FIRMS observations)
        </span>
      )}
    </div>
  );
}

export default DataSourceBadge;
