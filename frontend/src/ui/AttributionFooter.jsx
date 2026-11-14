import React from 'react';

export const FIRMS_ATTRIBUTION =
  'NASA FIRMS — MODIS/VIIRS active fire data (2000–2026)';

/**
 * Footer with mandatory NASA FIRMS attribution and a trigger for the
 * Limitations & Methodology view.
 */
export function AttributionFooter({
  onOpenLimitations,
  methodVersion,
  className = '',
}) {
  return (
    <footer className={`alatoo-footer ${className}`.trim()}>
      <span>
        {FIRMS_ATTRIBUTION}
        {methodVersion ? ` · Method: ${methodVersion}` : ''}
      </span>

      {typeof onOpenLimitations === 'function' && (
        <button
          type="button"
          className="alatoo-footer__link"
          onClick={onOpenLimitations}
        >
          Limitations &amp; Methodology
        </button>
      )}
    </footer>
  );
}

export default AttributionFooter;
