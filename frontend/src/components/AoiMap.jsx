import { useEffect, useRef } from 'react';
import L from './leafletSetup';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { REGION_BBOX } from '../api/config';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const SHAPE = { color: '#5ec8ff', weight: 2, fillOpacity: 0.12 };

function aoiLayer(aoi) {
  if (aoi.kind === 'polygon') return L.polygon(aoi.polygon.map(([lon, lat]) => [lat, lon]), SHAPE);
  const [w, s, e, n] = aoi.bbox;
  return L.rectangle([[s, w], [n, e]], SHAPE);
}

/** Map + AOI drawing (rectangle or polygon). onChange(aoi) receives the format from api/config.js */
export default function AoiMap({ aoi, onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const group = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // once: create the map
  useEffect(() => {
    const [w, s, e, n] = REGION_BBOX;
    const m = L.map(el.current, { zoomControl: true }).fitBounds([[s, w], [n, e]]);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    // precomputed region - outside it the API returns 422
    L.rectangle([[s, w], [n, e]], { color: '#9aa5b1', weight: 1, dashArray: '6 6', fill: false, interactive: false }).addTo(m);

    const g = L.featureGroup().addTo(m);
    m.addControl(new L.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: { showArea: false, shapeOptions: SHAPE },
        polygon: { showArea: false, allowIntersection: false, shapeOptions: SHAPE },
        polyline: false, circle: false, marker: false, circlemarker: false,
      },
      edit: false,
    }));
    m.on(L.Draw.Event.CREATED, (ev) => {
      if (ev.layerType === 'rectangle') {
        const b = ev.layer.getBounds();
        onChangeRef.current({ kind: 'bbox', bbox: [r4(b.getWest()), r4(b.getSouth()), r4(b.getEast()), r4(b.getNorth())] });
      } else {
        const pts = ev.layer.getLatLngs()[0].map((p) => [r4(p.lng), r4(p.lat)]);
        onChangeRef.current({ kind: 'polygon', polygon: pts });
      }
    });

    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    map.current = m;
    group.current = g;
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // when the AOI changes (from the map or the form), redraw the current shape
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    g.addLayer(aoiLayer(aoi));
  }, [aoi]);

  return <div ref={el} className="aoi-map" role="application" aria-label="Map: draw your area of interest" />;
}
