import { DEFAULT_AOI, REGION_BBOX } from "../api/config";

export const MAX_AREA_VERTICES = 100;
export const MAX_SHARE_QUERY_LENGTH = 8192;
export const MAX_GEOJSON_BYTES = 32_768;
const VIEWS = ["explore", "calendar", "method", "export"];
const PALETTES = ["viridis", "cividis"];
const NUMBER = /^-?\d+(?:\.\d{1,8})?$/;
const precision = (value) => Math.round(value * 1e6) / 1e6;
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function validMonth(value, latest = currentMonth()) {
  return (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    value >= "2000-01" &&
    value <= latest
  );
}

function point(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some(
      (coordinate) =>
        typeof coordinate !== "number" || !Number.isFinite(coordinate),
    )
  )
    throw new Error("Each vertex needs longitude and latitude.");
  const [west, south, east, north] = REGION_BBOX;
  if (
    value[0] < west ||
    value[0] > east ||
    value[1] < south ||
    value[1] > north
  )
    throw new Error("Keep the whole area inside the archive boundary.");
  return value.map(precision);
}

function intersects(a, b, c, d) {
  const turn = (p, q, r) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const turns = [turn(a, b, c), turn(a, b, d), turn(c, d, a), turn(c, d, b)];
  if (turns[0] * turns[1] < 0 && turns[2] * turns[3] < 0) return true;
  return [
    [a, b, c],
    [a, b, d],
    [c, d, a],
    [c, d, b],
  ].some(
    ([p, q, r], index) =>
      Math.abs(turns[index]) < 1e-12 &&
      r[0] >= Math.min(p[0], q[0]) &&
      r[0] <= Math.max(p[0], q[0]) &&
      r[1] >= Math.min(p[1], q[1]) &&
      r[1] <= Math.max(p[1], q[1]),
  );
}

export function normalizeAoi(value) {
  if (value?.kind === "bbox") {
    if (!Array.isArray(value.bbox) || value.bbox.length !== 4)
      throw new Error(
        "A rectangle needs west, south, east and north coordinates.",
      );
    const [west, south] = point(value.bbox.slice(0, 2));
    const [east, north] = point(value.bbox.slice(2));
    if (west >= east || south >= north)
      throw new Error("The area must have a positive width and height.");
    return { kind: "bbox", bbox: [west, south, east, north] };
  }
  if (value?.kind !== "polygon" || !Array.isArray(value.polygon))
    throw new Error("Choose a rectangle or a polygon.");
  if (value.polygon.length > MAX_AREA_VERTICES + 1)
    throw new Error(`Use at most ${MAX_AREA_VERTICES} polygon vertices.`);
  const points = value.polygon.map(point);
  if (points.length > 3 && samePoint(points[0], points.at(-1))) points.pop();
  if (points.length < 3 || points.length > MAX_AREA_VERTICES)
    throw new Error(`Use 3 to ${MAX_AREA_VERTICES} polygon vertices.`);
  if (new Set(points.map((p) => p.join(","))).size !== points.length)
    throw new Error("Remove repeated polygon vertices.");
  const area = points.reduce((sum, p, index) => {
    const next = points[(index + 1) % points.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0);
  if (Math.abs(area) < 1e-10)
    throw new Error("The polygon must enclose an area.");
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (
        intersects(
          points[i],
          points[(i + 1) % points.length],
          points[j],
          points[(j + 1) % points.length],
        )
      )
        throw new Error("Polygon edges must not cross.");
    }
  }
  return { kind: "polygon", polygon: points };
}

export function normalizeSelection(value, latest = currentMonth()) {
  if (
    !validMonth(value?.range?.from, latest) ||
    !validMonth(value?.range?.to, latest) ||
    value.range.from > value.range.to
  )
    throw new Error(
      "Choose a valid date range from January 2000 through the current month.",
    );
  if (
    !validMonth(value.month, latest) ||
    value.month < value.range.from ||
    value.month > value.range.to
  )
    throw new Error("The selected month must be inside the date range.");
  return {
    aoi: normalizeAoi(value.aoi),
    range: { from: value.range.from, to: value.range.to },
    month: value.month,
    palette: PALETTES.includes(value.palette) ? value.palette : "viridis",
    view: VIEWS.includes(value.view) ? value.view : "explore",
  };
}

function parseNumbers(value, length) {
  const parts = value.split(",");
  if (parts.length !== length || parts.some((part) => !NUMBER.test(part)))
    throw new Error("Invalid coordinates.");
  return parts.map(Number);
}

export function readSelection(search, latest = currentMonth(), hash = "") {
  const fallback = {
    aoi: normalizeAoi(DEFAULT_AOI),
    range: { from: "2000-01", to: latest },
    month: latest,
    palette: "viridis",
    view: VIEWS.includes(hash.slice(1)) ? hash.slice(1) : "explore",
    explicitRange: false,
    selectionWarning: null,
  };
  const rejected = (reason) => ({
    ...fallback,
    selectionWarning: `${reason} Showing the regional archive with default dates.`,
  });
  if (typeof search !== "string" || search.length > MAX_SHARE_QUERY_LENGTH)
    return rejected("The analysis link is too long or malformed.");
  const params = new URLSearchParams(search);
  const keys = ["v", "from", "to", "month", "palette", "bbox", "polygon"];
  if (keys.some((key) => params.getAll(key).length > 1))
    return rejected("The analysis link contains duplicate settings.");
  if (params.has("v") && params.get("v") !== "1")
    return rejected("This analysis link uses an unsupported version.");
  if (params.has("bbox") && params.has("polygon"))
    return rejected("The analysis link specifies more than one area.");
  if (
    ["from", "to", "month"].some(
      (key) => params.has(key) && !validMonth(params.get(key), latest),
    )
  )
    return rejected("The analysis link contains an invalid date.");
  if (params.has("palette") && !PALETTES.includes(params.get("palette")))
    return rejected("The analysis link contains an unknown palette.");
  const from = params.get("from") || fallback.range.from;
  const to = params.get("to") || latest;
  const month = params.get("month") || to;
  if (from > to || month < from || month > to)
    return rejected("The analysis link has conflicting dates.");
  let aoi = fallback.aoi;
  try {
    if (params.has("bbox"))
      aoi = normalizeAoi({
        kind: "bbox",
        bbox: parseNumbers(params.get("bbox"), 4),
      });
    if (params.has("polygon")) {
      const raw = params.get("polygon");
      if (raw.length > 4096) throw new Error("Polygon is too long.");
      aoi = normalizeAoi({
        kind: "polygon",
        polygon: raw.split(";").map((pair) => parseNumbers(pair, 2)),
      });
    }
  } catch {
    return rejected("The analysis link contains an invalid area.");
  }
  return {
    ...fallback,
    aoi,
    range: { from, to },
    month,
    palette: params.get("palette") || fallback.palette,
    explicitRange: params.has("to"),
  };
}

export function selectionUrl(value, baseUrl, latest = currentMonth()) {
  const selection = normalizeSelection(value, latest);
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use an HTTP or HTTPS address to share this analysis.");
  url.username = "";
  url.password = "";
  const params = new URLSearchParams({
    v: "1",
    from: selection.range.from,
    to: selection.range.to,
    month: selection.month,
    palette: selection.palette,
  });
  params.set(
    selection.aoi.kind === "bbox" ? "bbox" : "polygon",
    selection.aoi.kind === "bbox"
      ? selection.aoi.bbox.join(",")
      : selection.aoi.polygon.map((p) => p.join(",")).join(";"),
  );
  url.search = params.toString();
  url.hash = selection.view;
  return url.href;
}

export function areaGeoJson(aoi) {
  const normalized = normalizeAoi(aoi);
  let points = normalized.polygon;
  if (normalized.kind === "bbox") {
    const [west, south, east, north] = normalized.bbox;
    points = [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
    ];
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[...points, [...points[0]]]] },
  };
}

export function parseGeoJson(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_GEOJSON_BYTES
  )
    throw new Error("Use a GeoJSON file smaller than 32 KB.");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid GeoJSON.");
  }
  const rejectCrs = (object) => {
    if (object && Object.hasOwn(object, "crs"))
      throw new Error(
        "Re-export the area as WGS84 longitude/latitude GeoJSON without a crs member.",
      );
  };
  rejectCrs(value);
  if (value?.type === "FeatureCollection") {
    if (!Array.isArray(value.features) || value.features.length !== 1)
      throw new Error("Choose a GeoJSON file containing exactly one polygon.");
    value = value.features[0];
  }
  rejectCrs(value);
  const geometry = value?.type === "Feature" ? value.geometry : value;
  rejectCrs(geometry);
  if (
    geometry?.type !== "Polygon" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length !== 1
  )
    throw new Error("Use one polygon without holes or multiple parts.");
  const ring = geometry.coordinates[0];
  if (
    !Array.isArray(ring) ||
    ring.length < 4 ||
    !Array.isArray(ring[0]) ||
    !Array.isArray(ring.at(-1)) ||
    !samePoint(ring[0], ring.at(-1))
  )
    throw new Error("The GeoJSON polygon ring must be closed.");
  return normalizeAoi({ kind: "polygon", polygon: ring });
}
