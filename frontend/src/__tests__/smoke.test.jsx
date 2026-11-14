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
  it('рисует 27 лет × 12 месяцев', () => {
    expect(count(html, /role="gridcell"/g)).toBe(27 * 12);
  });
  it('null рисуется как «нет данных», а не как 0', () => {
    const nulls = calendarFx.values.flat().filter((v) => v === null).length;
    expect(nulls).toBeGreaterThan(0);
    expect(count(html, /cal__cell--null/g)).toBe(nulls + 1); // +1 образец в легенде
    expect(count(html, /нет данных/g)).toBeGreaterThanOrEqual(nulls);
    expect(html).not.toContain('NaN');
  });
  it('легенда берёт max из ответа', () => {
    expect(html).toContain(String(calendarFx.max).replace(/(\d)(?=(\d{3})+$)/, '$1\u00a0'));
  });
});

describe('остальные блоки', () => {
  it('AnomalyCard показывает label и пометку неполного месяца', () => {
    const html = renderToString(<AnomalyCard data={anomalyFx} />);
    expect(html).toContain('выше нормы');
    expect(html).toContain('месяц-к-дате');
  });
  it('TopPeriods, SummaryStats рендерятся', () => {
    expect(renderToString(<TopPeriods data={topFx} />)).toContain('Месяцы');
    expect(renderToString(<SummaryStats data={summaryFx} />)).toContain('Площадь');
  });
  it('мок помечается бейджем', () => {
    expect(renderToString(<StatusBadge meta={summaryFx.meta} />)).toContain('MOCK');
  });
});

describe('утилиты', () => {
  it('палитры: крайние точки и зажим', () => {
    expect(rgbAt('viridis', 0)).toEqual([68, 1, 84]);
    expect(rgbAt('viridis', 2)).toEqual(rgbAt('viridis', 1));
    expect(colorAt('cividis', 0.5)).toMatch(/^rgb\(/);
  });
  it('AOI -> параметры', () => {
    expect(aoiToParams({ kind: 'bbox', bbox: [1, 2, 3, 4] })).toEqual({ bbox: '1,2,3,4' });
    expect(aoiToParams({ kind: 'polygon', polygon: [[74.5, 42.8], [75.2, 42.8], [75.2, 43.2]] }))
      .toEqual({ polygon: '74.5,42.8;75.2,42.8;75.2,43.2' });
  });
});
