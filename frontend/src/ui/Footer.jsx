import React, { useState } from 'react';
import { LimitationsView } from './LimitationsView.jsx';

/**
 * Footer component rendered by App.jsx.
 * Includes mandatory NASA FIRMS attribution, all 6 scientific limitations
 * from docs/limitations.md, and a trigger for the full LimitationsView modal.
 */
export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <footer className="footer">
      <div className="footer__bar">
        <p>
          <strong>Data attribution:</strong> NASA FIRMS &mdash; MODIS/VIIRS active fire data
          (2000&ndash;2026) &middot;{' '}
          <a
            href="https://firms.modaps.eosdis.nasa.gov/"
            target="_blank"
            rel="noreferrer"
          >
            firms.modaps.eosdis.nasa.gov
          </a>{' '}
          &middot; Team Stellar Baatyr &middot; Unit: <code>hotspot_days_1km</code>
        </p>
        <button
          type="button"
          className="btn btn--ghost footer__modal-btn"
          onClick={() => setIsModalOpen(true)}
        >
          Limitations Modal (6)
        </button>
      </div>

      <details className="footer__details">
        <summary>Data and Method Limitations (6 points)</summary>
        <ol>
          <li>
            <strong>Hotspot &ne; confirmed fire.</strong> A satellite detection represents ~1 km&sup2;
            of thermal anomaly (including spring agricultural burning and industrial heat sources),
            not a confirmed wildfire.
          </li>
          <li>
            <strong>Clouds, smoke, and dust storms.</strong> Dense cloud cover and thick smoke from
            large fires can mask nearby active burning, while dust storms and sun glint can
            occasionally produce false detections.
          </li>
          <li>
            <strong>Harmonization is an estimate, not a direct measurement.</strong> VIIRS
            observations (from 2012 onward) are calibrated into MODIS 1 km equivalents using{' '}
            <code>2&deg; &times; 2&deg;</code> tile- and season-level regression. Charts after 2012
            always display the <code>[lo, hi]</code> 95% uncertainty interval; prior to 2012, MODIS
            serves as the reference scale (<code>lo == hi == count</code>).
          </li>
          <li>
            <strong>Incomplete current month.</strong> Anomalies are calculated strictly
            month-to-date using <code>days_observed</code>&mdash;historical years are truncated to
            the same day-of-month window (<code>days &lt;= through_day</code>), preventing an
            artificial negative bias for an ongoing month.
          </li>
          <li>
            <strong>NRT data latency.</strong> Near Real-Time (<code>MODIS_NRT</code>,{' '}
            <code>VIIRS_SNPP_NRT</code>) detections arrive with operational latency and are later
            refined when superseded by standard science-quality (<code>SP</code>) archives. Recent
            months are flagged as <code>nrt</code>.
          </li>
          <li>
            <strong>Observation gaps (<code>null</code> &ne; <code>0</code>).</strong> In the year
            &times; month calendar, <code>0</code> indicates valid observations with zero detected
            hotspots, whereas <code>null</code> (rendered with a distinct hatched pattern) indicates
            missing data for that period.
          </li>
        </ol>
      </details>

      <LimitationsView isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </footer>
  );
}
