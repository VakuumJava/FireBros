import { useEffect, useRef, useState } from "react";
import { areaLabel } from "../api/areas";
import { MAX_SAVED_AREAS } from "../workspace/savedAreas";
import {
  areaGeoJson,
  MAX_GEOJSON_BYTES,
  parseGeoJson,
  selectionUrl,
} from "../workspace/selectionUrl";
import { useSavedAreas } from "../workspace/useSavedAreas";
import "./workspace-tools.css";

export default function WorkspaceTools({
  aoi,
  range,
  month,
  palette,
  view,
  onRestore,
}) {
  const saved = useSavedAreas();
  const [name, setName] = useState("");
  const [status, setStatus] = useState(null);
  const [share, setShare] = useState("");
  const [importing, setImporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const request = useRef(0);
  const selection = { aoi, range, month, palette, view };
  const key = JSON.stringify(selection);

  useEffect(() => {
    request.current += 1;
    setShare("");
    setStatus(null);
    setCopying(false);
    setImporting(false);
    return () => {
      request.current += 1;
    };
  }, [key]);

  const run = (action, message) => {
    try {
      action();
      setStatus({ text: message, error: false });
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };

  const copyLink = async () => {
    const version = request.current;
    setCopying(true);
    let url;
    try {
      url = selectionUrl(selection, window.location.href);
    } catch (error) {
      setStatus({ text: error.message, error: true });
      setCopying(false);
      return;
    }
    try {
      setShare(url);
      if (!navigator.clipboard?.writeText) {
        setStatus({
          text: "Copy the link below to share this selection.",
          error: false,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      if (request.current === version)
        setStatus({ text: "Link copied.", error: false });
    } catch {
      if (request.current === version)
        setStatus({
          text: "Clipboard unavailable. Copy the link below.",
          error: false,
        });
    } finally {
      if (request.current === version) setCopying(false);
    }
  };

  const downloadArea = () =>
    run(() => {
      const blob = new Blob([JSON.stringify(areaGeoJson(aoi), null, 2)], {
        type: "application/geo+json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "firebros-area.geojson";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Area downloaded as GeoJSON.");

  const importArea = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = request.current;
    setImporting(true);
    setStatus(null);
    try {
      if (file.size > MAX_GEOJSON_BYTES)
        throw new Error("Use a GeoJSON file smaller than 32 KB.");
      const imported = parseGeoJson(await file.text());
      if (request.current === version)
        onRestore({ ...selection, aoi: imported });
    } catch (error) {
      if (request.current === version)
        setStatus({ text: error.message, error: true });
    } finally {
      if (request.current === version) setImporting(false);
    }
  };

  return (
    <details className="workspace-tools">
      <summary>Saved areas &amp; sharing</summary>
      <div className="workspace-tools__content">
        <div className="workspace-tools__share">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={copyLink}
            disabled={copying}
          >
            {copying ? "Copying…" : "Copy analysis link"}
          </button>
          {share && (
            <label className="workspace-tools__label">
              <span>Analysis link</span>
              <input
                type="text"
                value={share}
                readOnly
                onFocus={(event) => event.target.select()}
              />
            </label>
          )}
        </div>
        <form
          className="workspace-tools__save"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => {
              saved.save(name || areaLabel(aoi), selection);
              setName("");
            }, "Area saved in this browser.");
          }}
        >
          <label className="workspace-tools__label">
            <span>Area name</span>
            <input
              value={name}
              maxLength={60}
              placeholder={areaLabel(aoi)}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn--ghost"
            disabled={saved.areas.length >= MAX_SAVED_AREAS}
          >
            Save area
          </button>
        </form>
        {saved.areas.length > 0 ? (
          <ul className="workspace-tools__areas">
            {saved.areas.map((area) => (
              <li key={area.id}>
                <button
                  type="button"
                  className="workspace-tools__open"
                  onClick={() => onRestore(area.selection)}
                >
                  <span>{area.name}</span>
                  <small>{area.selection.month}</small>
                </button>
                <button
                  type="button"
                  className="workspace-tools__delete"
                  aria-label={`Delete ${area.name}`}
                  onClick={() =>
                    run(() => saved.remove(area.id), "Saved area removed.")
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workspace-tools__note">
            Saved areas stay in this browser.
          </p>
        )}
        {saved.error && (
          <div className="workspace-tools__storage-error">
            <p role="status">{saved.error}</p>
            <button
              type="button"
              className="workspace-tools__delete"
              onClick={() => run(saved.clear, "Saved areas cleared.")}
            >
              Clear saved areas
            </button>
          </div>
        )}
        {saved.areas.length >= MAX_SAVED_AREAS && (
          <p className="workspace-tools__note">
            12 areas saved. Delete one to make room.
          </p>
        )}
        <div className="workspace-tools__files">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={downloadArea}
          >
            Export GeoJSON
          </button>
          <label className="workspace-tools__label">
            <span>{importing ? "Reading GeoJSON…" : "Import GeoJSON"}</span>
            <input
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              onChange={importArea}
              disabled={importing}
            />
          </label>
        </div>
        {status && (
          <p
            className={`workspace-tools__status${status.error ? " workspace-tools__status--error" : ""}`}
            role={status.error ? "alert" : "status"}
          >
            {status.text}
          </p>
        )}
      </div>
    </details>
  );
}
