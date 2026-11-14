import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import calendarFx from '@contracts/fixtures/aoi-calendar.json';
import anomalyFx from '@contracts/fixtures/aoi-anomaly.json';
import topFx from '@contracts/fixtures/aoi-top.json';
import summaryFx from '@contracts/fixtures/aoi-summary.json';
import CalendarHeatmap from '../components/CalendarHeatmap';
import AnomalyCard from '../components/AnomalyCard';
import TopPeriods from '../components/TopPeriods';
import SummaryStats from '../components/SummaryStats';
import StatusBadge from '../components/StatusBadge';
import { colorAt, rgbAt } from '../ui/palettes';
import { aoiToParams } from '../api/client';

const count = (s, re) => (s.match(re) || []).length;

describe('CalendarHeatmap', () => {
  const html = renderToString(<CalendarHeatmap data={calendarFx} palette="viridis" nrtMonths={['2026-11']} />);
  it('renders 27 years x 12 months', () => {
    expect(count(html, /role="gridcell"/g)).toBe(27 * 12);
  });
  it('renders null as "no data", never as 0', () => {
    const nulls = calendarFx.values.flat().filter((v) => v === null).length;
    expect(nulls).toBeGreaterThan(0);
    expect(count(html, /cal__cell--null/g)).toBe(nulls + 1); // +1 sample swatch in the legend
    expect(count(html, /no data/g)).toBeGreaterThanOrEqual(nulls);
    expect(html).not.toContain('NaN');
  });
  it('legend uses max from the response', () => {
    expect(html).toContain(calendarFx.max.toLocaleString('en-US'));
  });
});

describe('other blocks', () => {
  it('AnomalyCard shows a headline and the incomplete-month note', () => {
    const html = renderToString(<AnomalyCard data={anomalyFx} />);
    expect(html).toContain('above normal');
    expect(html).toContain('month-to-date');
  });
  it('TopPeriods and SummaryStats render', () => {
    expect(renderToString(<TopPeriods data={topFx} />)).toContain('Months');
    expect(renderToString(<SummaryStats data={summaryFx} />)).toContain('AOI area');
  });
  it('mock data gets a badge', () => {
    expect(renderToString(<StatusBadge meta={summaryFx.meta} />)).toContain('MOCK');
  });
});

describe('utilities', () => {
  it('palettes: end points and clamping', () => {
    expect(rgbAt('viridis', 0)).toEqual([68, 1, 84]);
    expect(rgbAt('viridis', 2)).toEqual(rgbAt('viridis', 1));
    expect(colorAt('cividis', 0.5)).toMatch(/^rgb\(/);
  });
  it('AOI -> params', () => {
    expect(aoiToParams({ kind: 'bbox', bbox: [1, 2, 3, 4] })).toEqual({ bbox: '1,2,3,4' });
    expect(aoiToParams({ kind: 'polygon', polygon: [[74.5, 42.8], [75.2, 42.8], [75.2, 43.2]] }))
      .toEqual({ polygon: '74.5,42.8;75.2,42.8;75.2,43.2' });
  });
  it('frontend source has no Cyrillic characters', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const bad = walk('src').filter((f) => /[\u0400-\u04FF]/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
