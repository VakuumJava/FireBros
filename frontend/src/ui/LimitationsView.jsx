import { useEffect, useRef } from "react";
import "./limitations.css";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function LimitationsView({ isOpen, onClose }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      [...dialog.current.querySelectorAll(FOCUSABLE)].filter(
        (element) => !element.closest('[hidden], [aria-hidden="true"]'),
      );
    const focusFirst = () => (controls()[0] || dialog.current)?.focus();
    focusFirst();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      const active = document.activeElement;
      const outside = !dialog.current.contains(active);
      if (!first) {
        event.preventDefault();
        dialog.current.focus();
      } else if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    const keepFocusInside = (event) => {
      if (!dialog.current?.contains(event.target)) focusFirst();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="limitations-backdrop">
      <div
        ref={dialog}
        className="limitations"
        role="dialog"
        aria-modal="true"
        aria-labelledby="limitations-title"
        aria-describedby="limitations-intro"
        tabIndex={-1}
      >
        <header className="limitations__header">
          <h2 id="limitations-title">Data &amp; method limitations</h2>
          <button
            type="button"
            className="limitations__close"
            onClick={onClose}
            aria-label="Close limitations"
          >
            Close
          </button>
        </header>
        <div className="limitations__body">
          <p id="limitations-intro" className="limitations__intro">
            The atlas estimates historical fire activity from satellite
            observations. It does not confirm individual wildfires or measure
            burned area.
          </p>
          <ol className="limitations__list">
            <li>
              <h3>A hotspot is a thermal anomaly</h3>
              <p>
                Detections can include agricultural burning and industrial heat
                sources. One detection does not establish a wildfire.
              </p>
            </li>
            <li>
              <h3>Observation conditions affect detection</h3>
              <p>
                Clouds, smoke and dust can hide active burning. Sun glint and
                other effects can also produce false detections.
              </p>
            </li>
            <li>
              <h3>Calibration is an estimate</h3>
              <p>
                VIIRS is calibrated to the MODIS reference scale using 2° tiles
                and seasonal regression. The 95% interval represents approximate
                calibration uncertainty; it does not cover every measurement
                error. Earlier MODIS counts use the reference scale directly.
              </p>
              <p>
                Holdout diagnostics informed the model revision. Validation is
                internal, rather than an untouched external benchmark.
              </p>
            </li>
            <li>
              <h3>Incomplete months use matching day windows</h3>
              <p>
                Where daily coverage is available, the selected month and
                historical years use days up to the same cutoff. More source
                data may change the result.
              </p>
            </li>
            <li>
              <h3>Recent data may be revised</h3>
              <p>
                Near Real-Time (NRT) observations arrive with latency. Standard
                science-quality archives replace them when available. Partial
                source coverage is flagged separately.
              </p>
            </li>
            <li>
              <h3>Missing observations are not zero activity</h3>
              <p>
                A hatched calendar cell means no usable data. Zero means the
                available observations contain no detected hotspots.
              </p>
            </li>
          </ol>
          <div className="limitations__resolution">
            <h3>Spatial resolution and units</h3>
            <p>
              Areas use whole 0.25° reporting cells, so small polygons are
              approximations. Detections are snapped to a 0.01° angular grid,
              not equal-area 1 km pixels. The unit is{" "}
              <code>hotspot_days_1km</code>. Available source days do not imply
              cloud-free coverage.
            </p>
          </div>
        </div>
        <footer className="limitations__footer">
          <span>Source: NASA FIRMS · MODIS / VIIRS</span>
          <button type="button" className="limitations__done" onClick={onClose}>
            Back to the atlas
          </button>
        </footer>
      </div>
    </div>
  );
}
