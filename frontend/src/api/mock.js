// Backend-free mode: serves frozen responses from contracts/fixtures.
// The AOI is ignored here (there is only one fixture); the period is filtered so the year selectors still work.
import summaryFx from '@contracts/fixtures/aoi-summary.json';
import calendarFx from '@contracts/fixtures/aoi-calendar.json';
import anomalyFx from '@contracts/fixtures/aoi-anomaly.json';
import topFx from '@contracts/fixtures/aoi-top.json';
import harmonizationFx from '@contracts/fixtures/aoi-harmonization.json';

const ym = (s) => s.split('-').map(Number);
const key = (y, m) => y * 100 + m;
const inRange = (y, m, r) => {
  const [fy, fm] = ym(r.from);
  const [ty, tm] = ym(r.to);
  return key(y, m) >= key(fy, fm) && key(y, m) <= key(ty, tm);
};
const later = (v) => new Promise((res) => setTimeout(() => res(structuredClone(v)), 120));

export const summary = (r) => {
  const fx = structuredClone(summaryFx);
  fx.series = fx.series.filter((p) => inRange(p.year, p.month, r));
  fx.period = { from: r.from, to: r.to, months: fx.series.length };
  return later(fx);
};

export const calendar = (r) => {
  const fx = structuredClone(calendarFx);
  const [fy] = ym(r.from);
  const [ty] = ym(r.to);
  const idx = fx.years.map((y, i) => [y, i]).filter(([y]) => y >= fy && y <= ty).map(([, i]) => i);
  fx.years = idx.map((i) => fx.years[i]);
  fx.values = idx.map((i) => fx.values[i]);
  return later(fx);
};

export const anomaly = () => later(anomalyFx);
export const top = () => later(topFx);

export const harmonization = (r) => {
  const fx = structuredClone(harmonizationFx);
  fx.series = fx.series.filter((p) => inRange(p.year, p.month, r));
  return later(fx);
};

export const monthlyCsv = (r) => {
  const head = 'year,month,count,lo,hi,sensor,harmonized,days_observed,days_in_month';
  const rows = summaryFx.series
    .filter((p) => inRange(p.year, p.month, r))
    .map((p) => [p.year, p.month, p.count, p.lo, p.hi, p.sensor, p.harmonized, p.days_observed, p.days_in_month].join(','));
  return { text: [head, ...rows].join('\n'), rows: rows.length };
};
