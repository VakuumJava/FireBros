import { API_BASE, USE_MOCK } from "./config";
import * as mock from "./mock";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function aoiToParams(aoi) {
  if (aoi.kind === "polygon")
    return {
      polygon: aoi.polygon.map(([lon, lat]) => `${lon},${lat}`).join(";"),
    };
  return { bbox: aoi.bbox.join(",") };
}

const withRange = (aoi, range) => ({
  ...aoiToParams(aoi),
  from: range.from,
  to: range.to,
});

async function readError(response) {
  let detail = `Request failed (${response.status}). Please try again.`;
  try {
    const value = (await response.json()).detail;
    if (typeof value === "string") detail = value;
    else if (Array.isArray(value))
      detail = value.map((entry) => entry.msg).join("; ");
  } catch {
    /* Preserve the HTTP status when the response is not JSON. */
  }
  return new ApiError(response.status, detail);
}

async function request(path, params, signal, read) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 60_000);
  try {
    const response = await fetch(
      `${API_BASE}${path}?${new URLSearchParams(params)}`,
      { signal: controller.signal },
    );
    if (!response.ok) throw await readError(response);
    return await read(response);
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        408,
        "The request timed out. Narrow the area or period, then try again.",
      );
    throw new ApiError(
      0,
      "Cannot reach the data service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

const getJson = (path, params, signal) =>
  request(path, params, signal, (response) => response.json());

export const getSummary = (aoi, range, signal) =>
  USE_MOCK
    ? mock.summary(range)
    : getJson("/aoi/summary", withRange(aoi, range), signal);
export const getCalendar = (aoi, range, signal) =>
  USE_MOCK
    ? mock.calendar(range)
    : getJson("/aoi/calendar", withRange(aoi, range), signal);
export const getAnomaly = (aoi, month, signal) =>
  USE_MOCK
    ? mock.anomaly(month)
    : getJson("/aoi/anomaly", { ...aoiToParams(aoi), month }, signal);
export const getTop = (aoi, range, signal) =>
  USE_MOCK
    ? mock.top(range)
    : getJson("/aoi/top", { ...withRange(aoi, range), n: 10 }, signal);
export const getHarmonization = (aoi, range, signal) =>
  USE_MOCK
    ? mock.harmonization(range)
    : getJson("/aoi/harmonization", withRange(aoi, range), signal);

export function filenameFrom(response, fallback) {
  const value = response.headers.get("Content-Disposition") || "";
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(value);
  const plain = /filename=(?:"([^"]+)"|([^;]+))/i.exec(value);
  let filename = extended?.[1] || plain?.[1] || plain?.[2];
  if (!filename) return fallback;
  try {
    filename = decodeURIComponent(filename.trim());
  } catch {
    return fallback;
  }
  filename = filename
    .split(/[\\/]/)
    .pop()
    .replace(/[\x00-\x1f\x7f]/g, "");
  return filename && filename.endsWith(".csv") ? filename : fallback;
}

export function parseRowCount(value) {
  if (value === null || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}

export async function exportCsv(aoi, range, kind, signal) {
  const fallback = `firebros_${kind}_${range.from}_${range.to}.csv`;
  if (USE_MOCK) {
    if (kind === "hotspots")
      throw new ApiError(
        501,
        "Raw detections are unavailable in fixture mode. Choose the monthly summary.",
      );
    const { text, rows } = mock.monthlyCsv(range);
    return {
      blob: new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }),
      filename: fallback,
      rowCount: rows,
    };
  }
  return request(
    "/aoi/export.csv",
    { ...withRange(aoi, range), kind },
    signal,
    async (response) => ({
      blob: await response.blob(),
      filename: filenameFrom(response, fallback),
      rowCount: parseRowCount(response.headers.get("X-Row-Count")),
    }),
  );
}

export const getHealth = (signal) => getJson("/meta/health", {}, signal);
