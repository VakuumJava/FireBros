import { useCallback, useState } from "react";
import { LimitationsView } from "./LimitationsView.jsx";
import "./limitations.css";

export default function Footer({ firstMonth, lastMonth }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <footer className="data-footer">
      <div className="data-footer__main">
        <p>
          <a
            href="https://firms.modaps.eosdis.nasa.gov/"
            target="_blank"
            rel="noreferrer"
          >
            NASA FIRMS
          </a>
          <span>MODIS / VIIRS active fire observations</span>
          {lastMonth && (
            <span className="data-footer__coverage">
              {firstMonth || "2000-01"} — {lastMonth}
            </span>
          )}
        </p>
        <button
          type="button"
          className="data-footer__limitations"
          onClick={() => setIsModalOpen(true)}
        >
          Data &amp; method limitations
        </button>
      </div>
      <div className="data-footer__notes">
        <p>
          Reporting uses whole 0.25° cells. Available source days do not imply
          cloud-free observation.
        </p>
        <p>Team Stellar Baatyr</p>
      </div>
      <LimitationsView isOpen={isModalOpen} onClose={closeModal} />
    </footer>
  );
}
