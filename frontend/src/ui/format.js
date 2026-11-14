export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const fmt = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 3 })
    : "—";
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const fmtCompact = (n) => (Number.isFinite(n) ? compact.format(n) : "");
export const fmtRatio = (r) =>
  Number.isFinite(r) ? `x${r.toFixed(2)}` : "Unavailable";
export const fmtPct = (x, d = 1) =>
  Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : "Unavailable";
export const pad2 = (n) => String(n).padStart(2, "0");
export const ymLabel = (y, m) => `${y}-${pad2(m)}`;
