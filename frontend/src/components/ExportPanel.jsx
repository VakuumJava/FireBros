import { useEffect, useId, useRef, useState } from "react";
import { exportCsv } from "../api/client";
import { fmt } from "../ui/format";
import "./export.css";

export default function ExportPanel({
  aoi,
  range,
  source,
  unit = "hotspot_days_1km",
}) {
  const [kind, setKind] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const groupName = useId();
  const active = useRef(null);
  const selection = `${JSON.stringify(aoi)}:${range.from}:${range.to}:${kind}`;
  useEffect(() => {
    setMessage(null);
    setBusy(false);
    return () => active.current?.abort();
  }, [selection]);

  const download = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setMessage(null);
    try {
      const { blob, filename, rowCount } = await exportCsv(
        aoi,
        range,
        kind,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({
        ok: true,
        text: `${filename}${rowCount != null ? ` · ${fmt(rowCount)} rows` : ""}`,
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage({ ok: false, text: error.detail || error.message });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="export data-export" aria-busy={busy}>
      <fieldset disabled={busy} className="data-export__choices">
        <legend className="visually-hidden">CSV content</legend>
        <label className="export__opt data-export__choice">
          <input
            type="radio"
            name={groupName}
            checked={kind === "monthly"}
            onChange={() => setKind("monthly")}
          />
          <span>
            <strong>Monthly summary</strong>
            <small>Calibrated counts and uncertainty by month</small>
          </span>
        </label>
        <label className="export__opt data-export__choice">
          <input
            type="radio"
            name={groupName}
            checked={kind === "hotspots"}
            disabled={source === "mock"}
            onChange={() => setKind("hotspots")}
          />
          <span>
            <strong>Raw detections</strong>
            <small>
              {source === "mock"
                ? "Unavailable in fixture mode"
                : "Individual satellite observations"}
            </small>
          </span>
        </label>
      </fieldset>
      <p className="data-export__scope">
        {range.from} – {range.to}
        {kind === "monthly" && (
          <span>
            {unit === "hotspot_days_1km"
              ? "MODIS-equivalent hotspot-days"
              : unit}
          </span>
        )}
      </p>
      <div className="data-export__actions">
        <button
          type="button"
          className="btn"
          onClick={download}
          disabled={busy}
        >
          {busy ? "Preparing file…" : "Download CSV"}
        </button>
        {busy && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              active.current?.abort();
              setBusy(false);
            }}
          >
            Cancel export
          </button>
        )}
      </div>
      {message && (
        <p
          className={`card__msg data-export__result ${message.ok ? "" : "card__msg--error"}`}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
