import React, { useEffect } from 'react';

/**
 * Modal dialog presenting all six scientific and data limitations
 * defined in docs/limitations.md.
 */
export function LimitationsView({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="alatoo-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className="alatoo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alatoo-limitations-title"
      >
        <div className="alatoo-modal__header">
          <h2 id="alatoo-limitations-title" className="alatoo-modal__title">
            Data and Method Limitations
          </h2>
          <button
            type="button"
            className="alatoo-btn alatoo-btn--secondary"
            onClick={onClose}
            aria-label="Close limitations modal"
          >
            Close
          </button>
        </div>

        <div className="alatoo-modal__body">
          <p className="alatoo-modal__intro">
            <strong>Ala-Too Fire Calendar</strong> unifies satellite fire observations
            from 2000 to 2026 onto a single <code>hotspot_days_1km</code> scale across{' '}
            <code>bbox = [68.5, 38.4, 80.7, 43.7]</code>. Keep these six limitations
            in mind when interpreting the calendar, anomaly metrics, and time-series charts:
          </p>

          <ol className="alatoo-limitations-list">
            <li>
              <strong>Hotspot &ne; confirmed fire.</strong> A satellite detection represents
              ~1 km&sup2; of thermal anomaly (including spring agricultural burning and
              industrial heat sources), not a confirmed wildfire.
            </li>
            <li>
              <strong>Clouds, smoke, and dust storms.</strong> Dense cloud cover and thick
              smoke from large fires can mask nearby active burning, while dust storms and
              sun glint can occasionally produce false detections.
            </li>
            <li>
              <strong>Harmonization is an estimate, not a direct measurement.</strong> VIIRS
              observations (from 2012 onward) are calibrated into MODIS 1 km equivalents
              using <code>2&deg; &times; 2&deg;</code> tile- and season-level regression.
              Charts after 2012 always display the <code>[lo, hi]</code> 95% uncertainty
              interval; prior to 2012, MODIS serves as the reference scale (
              <code>lo == hi == count</code>).
            </li>
            <li>
              <strong>Incomplete current month.</strong> Anomalies are calculated strictly
              month-to-date using <code>days_observed</code>&mdash;historical years are
              truncated to the same day-of-month window (<code>days &lt;= through_day</code>),
              preventing an artificial negative bias for an ongoing month.
            </li>
            <li>
              <strong>NRT data latency.</strong> Near Real-Time (<code>MODIS_NRT</code>,{' '}
              <code>VIIRS_SNPP_NRT</code>) detections arrive with operational latency and
              are later refined when superseded by standard science-quality (<code>SP</code>)
              archives. Recent months are flagged as <code>nrt</code>.
            </li>
            <li>
              <strong>Observation gaps (<code>null</code> &ne; <code>0</code>).</strong> In
              the year &times; month calendar, <code>0</code> indicates valid observations
              with zero detected hotspots, whereas <code>null</code> (rendered with a
              distinct pattern) indicates missing data for that period.
            </li>
          </ol>

          <div className="alatoo-null-demo" aria-label="Visual legend for null cells">
            <span
              className="alatoo-null-demo__swatch cell-null-pattern"
              aria-hidden="true"
            />
            <span>
              <strong>Hatched cell (null):</strong> missing observation period, distinct from{' '}
              <code>0</code> hotspot-days.
            </span>
          </div>
        </div>

        <div className="alatoo-modal__footer">
          <span>Data attribution: NASA FIRMS &mdash; MODIS/VIIRS active fire data (2000&ndash;2026).</span>
          <button
            type="button"
            className="alatoo-btn alatoo-btn--primary"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
