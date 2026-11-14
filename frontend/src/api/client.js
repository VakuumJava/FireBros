// The ONLY place where the frontend knows about API URLs and parameters. Contract: docs/api-contract.md
import { API_BASE, USE_MOCK } from './config';
import * as mock from './mock';

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

/** AOI -> query params. bbox: "w,s,e,n"; polygon: "lon,lat;lon,lat" (GeoJSON order) */
export function aoiToParams(aoi) {
  if (aoi.kind === 'polygon') {
    return { polygon: aoi.polygon.map(([lon, lat]) => `${lon},${lat}`).join(';') };
  }
  return { bbox: aoi.bbox.join(',') };
}

const withRange = (aoi, range) => ({ ...aoiToParams(aoi), from: range.from, to: range.to });

async function readError(res) {
  let detail = `${res.status} ${res.statusText}`;
  try {
    const d = (await res.json()).detail;
    if (typeof d === 'string') detail = d;
    else if (Array.isArray(d)) detail = d.map((x) => x.msg).join('; ');
  } catch { /* body is not JSON - keep the status text */ }
  return new ApiError(res.status, detail);
}

async function request(path, params, signal) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}?${new URLSearchParams(params)}`, { signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the server. Is the backend running (port 8000)?');
  }
  if (!res.ok) throw await readError(res);
  return res;
}
const getJson = async (path, params, signal) => (await request(path, params, signal)).json();

export const getSummary = (aoi, range, signal) =>
  USE_MOCK ? mock.summary(range) : getJson('/aoi/summary', withRange(aoi, range), signal);

export const getCalendar = (aoi, range, signal) =>
  USE_MOCK ? mock.calendar(range) : getJson('/aoi/calendar', withRange(aoi, range), signal);

export const getAnomaly = (aoi, month, signal) =>
  USE_MOCK ? mock.anomaly() : getJson('/aoi/anomaly', { ...aoiToParams(aoi), month }, signal);

export const getTop = (aoi, range, signal) =>
  USE_MOCK ? mock.top() : getJson('/aoi/top', { ...withRange(aoi, range), n: 10 }, signal);

export const getHarmonization = (aoi, range, signal) =>
  USE_MOCK ? mock.harmonization(range) : getJson('/aoi/harmonization', withRange(aoi, range), signal);

function filenameFrom(res, fallback) {
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
}

/** kind: 'hotspots' | 'monthly'. Returns { blob, filename, rowCount } */
export async function exportCsv(aoi, range, kind) {
  const fallback = `firebros_${kind}_${range.from}_${range.to}.csv`;
  if (USE_MOCK) {
    if (kind === 'hotspots') {
      throw new ApiError(501, 'Raw detections are not available in mock mode. Use the "monthly" summary.');
    }
    const { text, rows } = mock.monthlyCsv(range);
    return { blob: new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }), filename: fallback, rowCount: rows };
  }
  const res = await request('/aoi/export.csv', { ...withRange(aoi, range), kind });
  return {
    blob: await res.blob(),
    filename: filenameFrom(res, fallback),
    rowCount: Number(res.headers.get('X-Row-Count')) || null,
  };
}
