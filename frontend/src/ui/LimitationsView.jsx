import React, { useEffect } from 'react';

const LIMITATION_ITEMS = [
  {
    title: 'Hotspot ≠ confirmed fire.',
    body: 'A detection marks ~1 km² of thermal anomaly (including spring agricultural burning and industrial heat), not a verified wildfire.',
  },
  {
    title: 'Clouds, smoke, and dust storms.',
    body: 'Dense clouds and smoke can mask active fires, while dust storms and sun glint may occasionally trigger false detections.',
  },
  {
    title: 'Harmonization is an estimate, not a measurement.',
    body: 'Post-2012 VIIRS counts are calibrated to MODIS 1 km equivalents and always show a [lo, hi] 95% confidence band.',
  },
  {
    title: 'Incomplete current month.',
    body: 'Anomalies are computed strictly month-to-date via days_observed, truncating past years to the same day window.',
  },
  {
    title: 'NRT data latency.',
    body: 'Near Real-Time feeds arrive with operational delay and are later refined by science-quality archives; recent months are flagged nrt.',
  },
  {
    title: 'Observation gaps (null ≠ 0).',
    body: 'In the calendar, 0 means observed with zero hotspots, while a hatched null cell indicates missing data.',
  },
];

/**
 * Concise Limitations & Methodology view (~40s read) supporting both
 * standalone page rendering and an accessible modal dialog.
 */
export function LimitationsView({
  mode = 'page',
  isOpen = true,
  onClose,
  className = '',
}) {
  useEffect(() => {
    if (mode !== 'modal' || !isOpen || typeof onClose !== 'function') {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isOpen, onClose]);

  if (mode === 'modal' && !isOpen) {
    return null;
  }

  const content = (
    <section
      className={`alatoo-limitations ${className}`.trim()}
      role={mode === 'modal' ? 'dialog' : 'region'}
      aria-modal={mode === 'modal' ? 'true' : undefined}
      aria-labelledby="alatoo-limitations-title"
    >
      <div className="alatoo-limitations__header">
        <h2 id="alatoo-limitations-title" className="alatoo-limitations__title">
          Data &amp; Method Limitations
        </h2>
        {typeof onClose === 'function' && (
          <button
            type="button"
            className="alatoo-limitations__close"
            onClick={onClose}
            aria-label="Close limitations"
          >
            Close
          </button>
        )}
      </div>

      <p className="alatoo-limitations__lead">
        Ala-Too Fire Calendar unifies 2000–2026 observations onto a single{' '}
        <code>hotspot_days_1km</code> scale across{' '}
        <code>bbox = [68.5, 38.4, 80.7, 43.7]</code>. Keep these six points in
        mind when reading the calendar and charts:
      </p>

      <ol className="alatoo-limitations__list">
        {LIMITATION_ITEMS.map((item) => (
          <li key={item.title} className="alatoo-limitations__item">
            <strong>{item.title}</strong> {item.body}
          </li>
        ))}
      </ol>

      <p className="alatoo-limitations__attribution">
        <strong>Data attribution:</strong> NASA FIRMS — MODIS/VIIRS active fire
        data (2000–2026).
      </p>
    </section>
  );

  if (mode === 'modal') {
    return (
      <div
        className="alatoo-limitations-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget && typeof onClose === 'function') {
            onClose();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

export default LimitationsView;
