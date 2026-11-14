import { useEffect, useRef, useState } from "react";
import L from "./leafletSetup";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { REGION_BBOX } from "../api/config";
import "./map.css";

const round = (value) => Math.round(value * 1e4) / 1e4;
const boundsOf = ([west, south, east, north]) => [
  [south, west],
  [north, east],
];

function ToolIcon({ kind }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "rectangle" ? (
        <rect x="3" y="4" width="12" height="10" rx="1" />
      ) : kind === "polygon" ? (
        <path d="m4 3 10 2 1 9-9 1-3-6 1-6Z" />
      ) : (
        <>
          <path d="M3 6V3h3m6 0h3v3m0 6v3h-3M6 15H3v-3" />
          <path d="M6 9h6M9 6v6" />
        </>
      )}
    </svg>
  );
}

function shapeOptions(element) {
  const color = getComputedStyle(element).getPropertyValue("--primary").trim();
  return { color, weight: 2, fillOpacity: 0.1 };
}

function layerFor(aoi, options) {
  return aoi.kind === "polygon"
    ? L.polygon(
        aoi.polygon.map(([lon, lat]) => [lat, lon]),
        options,
      )
    : L.rectangle(boundsOf(aoi.bbox), options);
}

function isContained(aoi) {
  const [west, south, east, north] = REGION_BBOX;
  const points =
    aoi.kind === "polygon"
      ? aoi.polygon
      : boundsOf(aoi.bbox).map(([lat, lon]) => [lon, lat]);
  return points.every(
    ([lon, lat]) =>
      Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      lon >= west &&
      lon <= east &&
      lat >= south &&
      lat <= north,
  );
}

export default function AoiMap({ aoi, onChange, active = true }) {
  const element = useRef(null);
  const map = useRef(null);
  const shapes = useRef(null);
  const drawing = useRef(null);
  const tiles = useRef(null);
  const fitted = useRef(false);
  const onChangeRef = useRef(onChange);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState(null);
  const [tileError, setTileError] = useState(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    const instance = L.map(element.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([41.05, 74.6], 5, { animate: false });
    const basemap = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      },
    ).addTo(instance);
    basemap.on("tileerror", () => setTileError(true));
    L.rectangle(boundsOf(REGION_BBOX), {
      color: getComputedStyle(element.current)
        .getPropertyValue("--muted")
        .trim(),
      weight: 1,
      dashArray: "5 5",
      fill: false,
      interactive: false,
    }).addTo(instance);
    const group = L.featureGroup().addTo(instance);
    instance.on(L.Draw.Event.CREATED, (event) => {
      const selection =
        event.layerType === "rectangle"
          ? {
              kind: "bbox",
              bbox: [
                event.layer.getBounds().getWest(),
                event.layer.getBounds().getSouth(),
                event.layer.getBounds().getEast(),
                event.layer.getBounds().getNorth(),
              ].map(round),
            }
          : {
              kind: "polygon",
              polygon: event.layer
                .getLatLngs()[0]
                .map(({ lng, lat }) => [round(lng), round(lat)]),
            };
      setMode(null);
      if (!isContained(selection)) {
        setError(
          "Keep the entire selection inside the dashed archive boundary.",
        );
        return;
      }
      if (
        selection.kind === "bbox" &&
        (selection.bbox[0] >= selection.bbox[2] ||
          selection.bbox[1] >= selection.bbox[3])
      ) {
        setError("Draw a larger rectangle, or enter its coordinates.");
        return;
      }
      setError(null);
      onChangeRef.current(selection);
    });
    instance.on(L.Draw.Event.DRAWSTOP, () => {
      drawing.current = null;
      setMode(null);
    });
    const resize = new ResizeObserver(() => {
      instance.invalidateSize();
      if (element.current.clientWidth === 0) {
        drawing.current?.disable();
        drawing.current = null;
        setMode(null);
        return;
      }
      if (
        !fitted.current &&
        element.current.clientWidth > 0 &&
        group.getLayers().length
      ) {
        instance.fitBounds(group.getBounds(), {
          animate: false,
          padding: [30, 30],
          maxZoom: 10,
        });
        fitted.current = true;
      }
    });
    resize.observe(element.current);
    map.current = instance;
    shapes.current = group;
    tiles.current = basemap;
    return () => {
      resize.disconnect();
      drawing.current?.disable();
      drawing.current = null;
      instance.remove();
      map.current = null;
      shapes.current = null;
      tiles.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !shapes.current) return;
    drawing.current?.disable();
    setMode(null);
    setError(null);
    shapes.current.clearLayers();
    const layer = layerFor(aoi, shapeOptions(element.current));
    shapes.current.addLayer(layer);
    fitted.current = element.current.clientWidth > 0;
    if (fitted.current)
      map.current.fitBounds(layer.getBounds(), {
        animate: false,
        padding: [30, 30],
        maxZoom: 10,
      });
  }, [aoi]);

  useEffect(() => {
    if (active) return;
    drawing.current?.disable();
    drawing.current = null;
    setMode(null);
  }, [active]);

  const draw = (kind) => {
    drawing.current?.disable();
    setError(null);
    const options = {
      showArea: false,
      shapeOptions: shapeOptions(element.current),
    };
    const handler =
      kind === "rectangle"
        ? new L.Draw.Rectangle(map.current, options)
        : new L.Draw.Polygon(map.current, {
            ...options,
            allowIntersection: false,
          });
    drawing.current = handler;
    handler.enable();
    setMode(kind);
  };
  const cancel = () => {
    drawing.current?.disable();
    drawing.current = null;
    setMode(null);
  };

  return (
    <div className="atlas-map">
      <div
        className="atlas-map__toolbar"
        role="group"
        aria-label="Draw an area of interest"
      >
        <button
          type="button"
          className="atlas-tool"
          aria-pressed={mode === "rectangle"}
          onClick={() => draw("rectangle")}
        >
          <ToolIcon kind="rectangle" />
          Rectangle
        </button>
        <button
          type="button"
          className="atlas-tool"
          aria-pressed={mode === "polygon"}
          onClick={() => draw("polygon")}
        >
          <ToolIcon kind="polygon" />
          Polygon
        </button>
        <button
          type="button"
          className="atlas-tool atlas-tool--extent"
          onClick={() => {
            cancel();
            map.current?.fitBounds(boundsOf(REGION_BBOX), {
              animate: false,
              padding: [18, 18],
            });
          }}
        >
          <ToolIcon kind="extent" />
          Regional view
        </button>
        {mode && (
          <button
            type="button"
            className="atlas-tool atlas-tool--cancel"
            onClick={cancel}
          >
            Cancel drawing
          </button>
        )}
      </div>
      <div
        ref={element}
        className="aoi-map atlas-map__canvas"
        role="region"
        aria-label="Area selection map. Use the coordinate fields for keyboard selection."
      />
      {(mode || error || tileError) && (
        <div className="atlas-map__status" aria-live="polite">
          {error ? (
            <p className="atlas-message atlas-message--error" role="alert">
              {error}
            </p>
          ) : mode ? (
            <p>
              {mode === "polygon"
                ? "Click to add corners. Select the first corner to finish."
                : "Drag across the map to define your area."}
            </p>
          ) : null}
          {tileError && (
            <p className="atlas-message">
              Map tiles could not load. Coordinate selection still works.{" "}
              <button
                type="button"
                className="atlas-text-button"
                onClick={() => {
                  setTileError(false);
                  tiles.current?.redraw();
                }}
              >
                Retry map
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
