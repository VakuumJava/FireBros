import React from "react";

/**
 * Mandatory scientific attribution footer for Ala-Too Fire Calendar.
 */
export function AttributionFooter({
  onOpenLimitations,
  methodVersion = "harmonize-v1",
}) {
  return (
    <footer className="alatoo-footer">
      <div className="alatoo-footer__inner">
        <div className="alatoo-footer__attribution">
          <span className="alatoo-footer__source">
            NASA FIRMS &mdash; MODIS/VIIRS active fire data
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>Team Stellar Baatyr</span>
          {methodVersion && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span className="alatoo-panel__meta">{methodVersion}</span>
            </>
          )}
        </div>

        <div className="alatoo-footer__actions">
          <span>
            Unit: <code>hotspot_days_1km</code>
          </span>
          {onOpenLimitations && (
            <button
              type="button"
              className="alatoo-link-btn"
              onClick={onOpenLimitations}
            >
              Limitations &amp; Method Notes
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
