import { useEffect, useState } from "react";
import { downloadEvidenceReport } from "../analysis/report";

export default function EvidenceExport({ aoi, range, month, states }) {
  const [message, setMessage] = useState(null);
  const required = [states.anomaly, states.summary, states.harmonization];
  const ready = required.every(
    (state) => state.data && !state.loading && !state.error,
  );

  useEffect(() => {
    setMessage(null);
  }, [aoi, range.from, range.to, month]);

  const download = () => {
    try {
      const filename = downloadEvidenceReport({
        aoi,
        range,
        month,
        anomaly: states.anomaly.data,
        summary: states.summary.data,
        harmonization: states.harmonization.data,
      });
      setMessage({
        text: `Downloaded ${filename}. Open it to print or save as PDF.`,
        error: false,
      });
    } catch (error) {
      setMessage({ text: error.message, error: true });
    }
  };

  return (
    <section className="evidence-export" aria-label="Analysis report">
      <h3>Analysis report</h3>
      <p>
        A portable snapshot with the selected month, coverage and calibration
        evidence.
      </p>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={!ready}
        onClick={download}
      >
        Download report
      </button>
      {!ready && (
        <p className="note">
          The report is available when all analysis data has loaded.
        </p>
      )}
      {message && (
        <p
          className={message.error ? "card__msg--error" : "note"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
