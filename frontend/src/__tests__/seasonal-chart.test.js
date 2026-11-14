import { describe, expect, it } from "vitest";
import { makeSeasonalChart } from "../analysis/seasonalChart";

const month = (value, extra = {}) => ({
  median: value,
  q1: value / 2,
  q3: value,
  selected: value,
  selectedPartial: false,
  ...extra,
});

describe("seasonal chart geometry", () => {
  it("shares a readable axis with headroom between the median, range and selected year", () => {
    const chart = makeSeasonalChart([month(250), month(800), month(1000)]);
    expect(chart.max).toBe(1250);
    expect(chart.ticks.map((tick) => tick.value)).toEqual([
      0, 250, 500, 750, 1000, 1250,
    ]);
    expect(chart.x(0)).toBe(56);
    expect(chart.x(2)).toBe(812);
    expect(chart.y(0)).toBe(chart.plot.bottom);
    expect(chart.y(chart.max)).toBe(chart.plot.top);
    expect(chart.y(1000)).toBeGreaterThan(chart.plot.top);
  });

  it("keeps an all-zero and empty chart finite", () => {
    for (const points of [[], [month(0), month(0)]]) {
      const chart = makeSeasonalChart(points);
      expect(chart.max).toBe(1);
      expect(chart.ticks.map((tick) => tick.value)).toEqual([
        0, 0.25, 0.5, 0.75, 1,
      ]);
      expect(
        `${chart.medianPath} ${chart.selectedPath} ${chart.bandPath}`,
      ).not.toMatch(/NaN|Infinity/);
    }
  });

  it.each([0.000012, 0.8, 15, 999, Number.MAX_SAFE_INTEGER, 1e308])(
    "produces finite bounded coordinates for %s",
    (value) => {
      const chart = makeSeasonalChart([month(value), month(value / 2)]);
      expect(Number.isFinite(chart.max)).toBe(true);
      expect(chart.max).toBeGreaterThanOrEqual(value);
      expect(chart.ticks.length).toBeGreaterThanOrEqual(5);
      expect(chart.ticks.length).toBeLessThanOrEqual(6);
      expect(
        chart.ticks.every(
          (tick) => Number.isFinite(tick.value) && Number.isFinite(tick.y),
        ),
      ).toBe(true);
      expect(chart.y(value)).toBeGreaterThanOrEqual(chart.plot.top);
      expect(chart.y(value)).toBeLessThanOrEqual(chart.plot.bottom);
      expect(
        `${chart.medianPath} ${chart.selectedPath} ${chart.bandPath}`,
      ).not.toMatch(/NaN|Infinity/);
    },
  );

  it("breaks both lines and the range at missing months", () => {
    const chart = makeSeasonalChart([
      month(10),
      month(20),
      month(null, { q1: null, q3: null, selected: null }),
      month(30),
      month(40),
    ]);
    expect(chart.medianPath.match(/M/g)).toHaveLength(2);
    expect(chart.selectedPath.match(/M/g)).toHaveLength(2);
    expect(chart.bandPath.match(/Z/g)).toHaveLength(2);
  });

  it("omits incomplete selected months from both path and scale", () => {
    const chart = makeSeasonalChart([
      month(10),
      month(20, { selected: 1e9, selectedPartial: true }),
      month(30),
    ]);
    expect(chart.max).toBeLessThan(100);
    expect(chart.selectedPath.match(/M/g)).toHaveLength(2);
    expect(chart.medianPath.match(/M/g)).toHaveLength(1);
  });

  it("retains a single-month interquartile range without bridging absent neighbours", () => {
    const chart = makeSeasonalChart([month(20)]);
    expect(chart.bandPath).toMatch(/^M.+ L.+ L.+ L.+ Z$/);
    expect(chart.medianPath).toMatch(/^M[\d.,]+$/);
  });

  it("bounds undersized or invalid viewports and invalid coordinate arguments", () => {
    const chart = makeSeasonalChart([month(10), month(20)], 0, NaN);
    expect(chart.width).toBe(280);
    expect(chart.height).toBe(280);
    expect(chart.plot.width).toBe(196);
    expect(chart.x(-100)).toBe(chart.plot.left);
    expect(chart.x(Infinity)).toBe(chart.plot.left);
    expect(chart.x(100)).toBe(chart.plot.right);
    expect(chart.y(NaN)).toBe(chart.plot.bottom);
    expect(chart.y(-1)).toBe(chart.plot.bottom);
    expect(chart.y(1e9)).toBe(chart.plot.top);
  });
});
