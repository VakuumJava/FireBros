export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US'));
export const fmtCompact = (n) => (n == null ? '' : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
export const fmtRatio = (r) => (r == null ? '-' : `x${r.toFixed(2)}`);
export const fmtPct = (x, d = 1) => (x == null ? '-' : `${(x * 100).toFixed(d)}%`);
export const pad2 = (n) => String(n).padStart(2, '0');
export const ymLabel = (y, m) => `${y}-${pad2(m)}`;
