import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import Card from "../ui/Card";
import HarmonizationChart from "../components/HarmonizationChart";
import CalendarHeatmap from "../components/CalendarHeatmap";
import SummaryStats from "../components/SummaryStats";
import StatusBadge from "../components/StatusBadge";
import {
  filenameFrom,
  getSummary,
  exportCsv,
  parseRowCount,
} from "../api/client";
import * as mock from "../api/mock";
import { withMonthlyGaps } from "../api/series";
import { rgbAt, textOn } from "../ui/palettes";
import harmonization from "@contracts/fixtures/aoi-harmonization.json";

const aoi = { kind: "bbox", bbox: [68.5, 38.4, 80.7, 43.7] };
const range = { from: "2024-03", to: "2024-03" };
afterEach(() => vi.unstubAllGlobals());

describe("selection and empty states", () => {
  it("renders control cards without asynchronous data state", () => {
    expect(
      renderToString(
        <Card title="Area">
          <button>Draw area</button>
        </Card>,
      ),
    ).toContain("Draw area");
  });
  it("renders no-data states only for data-backed panels", () => {
    expect(
      renderToString(
        <Card title="Series" state={{ data: null, loading: false }} />,
      ),
    ).toContain("No observations");
  });
  it("handles empty calendars and absent peaks without NaN or undefined", () => {
    expect(
      renderToString(
        <CalendarHeatmap
          data={{ years: [], values: [], max: 0, unit: "hotspot_days_1km" }}
        />,
      ),
    ).not.toContain("NaN");
    const html = renderToString(
      <SummaryStats
        data={{
          aoi: { area_km2: 1, coverage_fraction: 1 },
          totals: {
            hotspot_days: 0,
            peak_year: null,
            peak_month: null,
            mean_month: 0,
          },
          coverage: { gaps: [], nrt_months: [] },
        }}
      />,
    );
    expect(html).toContain("No observations");
    expect(html).not.toContain("undefined");
  });
  it("does not call fixture calibration measured validation", () => {
    const html = renderToString(<HarmonizationChart data={harmonization} />);
    expect(html).toContain("Illustrative fixture");
    expect(html).not.toContain("MAPE");
    expect(renderToString(<StatusBadge />)).toContain("unavailable");
  });
});

describe("fixed fixture consistency", () => {
  it("filters calendar months, totals and rankings to the selected period", async () => {
    const [summary, calendar, top] = await Promise.all([
      mock.summary(range),
      mock.calendar(range),
      mock.top(range),
    ]);
    expect(summary.series).toHaveLength(1);
    expect(summary.totals.hotspot_days).toBe(summary.series[0].count);
    expect(calendar.values[0].filter((value) => value !== null)).toHaveLength(
      1,
    );
    expect(top.months).toHaveLength(1);
    expect(top.years[0].count).toBe(summary.totals.hotspot_days);
    expect(mock.monthlyCsv(range).rows).toBe(1);
  });
  it("compares the requested fixture month rather than a hardcoded current month", async () => {
    const anomaly = await mock.anomaly("2024-03");
    expect(anomaly.month).toBe("2024-03");
    expect(anomaly.series.at(-1).year).toBe(2024);
    expect(anomaly.baseline.n_years).toBe(24);
  });
});

describe("live API transport", () => {
  it("uses the backend by default and forwards exact AOI and range", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetch);
    await expect(getSummary(aoi, range)).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0][0]).toContain("from=2024-03&to=2024-03");
  });
  it("surfaces export limit errors rather than creating a download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"detail":"Narrow the AOI or period"}', {
          status: 413,
        }),
      ),
    );
    await expect(exportCsv(aoi, range, "hotspots")).rejects.toMatchObject({
      status: 413,
      detail: "Narrow the AOI or period",
    });
  });
  it("honors server filenames, rejects malformed encoding and retains zero row counts", () => {
    const response = (value) =>
      new Response("", { headers: { "Content-Disposition": value } });
    expect(
      filenameFrom(
        response("attachment; filename*=UTF-8''monthly%20summary.csv"),
        "fallback.csv",
      ),
    ).toBe("monthly summary.csv");
    expect(
      filenameFrom(
        response('attachment; filename="../../summary.csv"'),
        "fallback.csv",
      ),
    ).toBe("summary.csv");
    expect(
      filenameFrom(
        response("attachment; filename*=UTF-8''bad%ZZ.csv"),
        "fallback.csv",
      ),
    ).toBe("fallback.csv");
    expect(parseRowCount("0")).toBe(0);
    expect(parseRowCount(null)).toBeNull();
    expect(parseRowCount("9007199254740993")).toBeNull();
  });
});

it("calendar text exceeds AA contrast across both full color ramps", () => {
  const luminance = (rgb) =>
    rgb
      .map((value) => value / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (total, value, index) =>
          total + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  for (const palette of ["viridis", "cividis"])
    for (let index = 0; index <= 100; index++) {
      const rgb = rgbAt(palette, index / 100);
      const light = luminance(rgb);
      const contrast =
        textOn(rgb) === "#fff" ? 1.05 / (light + 0.05) : (light + 0.05) / 0.05;
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
});

it("leaves missing chart months as gaps instead of joining across them", () => {
  const values = withMonthlyGaps([
    { year: 2023, month: 12, raw: 12 },
    { year: 2024, month: 2, raw: 20 },
  ]);
  expect(values).toHaveLength(3);
  expect(values[1]).toMatchObject({
    year: 2024,
    month: 1,
    raw: null,
    harmonized: null,
  });
});

it("restores a valid month from a shared URL and rejects malformed ranges", async () => {
  const { initialSelection } = await import("../api/selection");
  expect(
    initialSelection("?from=2000-11&to=2026-11&month=2025-10", "2026-11"),
  ).toMatchObject({
    range: { from: "2000-11", to: "2026-11" },
    month: "2025-10",
  });
  expect(
    initialSelection("?from=2027-14&to=garbage&month=1999-01", "2026-11"),
  ).toMatchObject({
    range: { from: "2000-01", to: "2026-11" },
    month: "2026-11",
  });
});
