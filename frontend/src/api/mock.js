import summaryFixture from "@contracts/fixtures/aoi-summary.json";
import calendarFixture from "@contracts/fixtures/aoi-calendar.json";
import anomalyFixture from "@contracts/fixtures/aoi-anomaly.json";
import harmonizationFixture from "@contracts/fixtures/aoi-harmonization.json";

const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;
const inRange = (year, month, range) => {
  const key = monthKey(year, month);
  return key >= range.from && key <= range.to;
};
const selectedSeries = (range) =>
  summaryFixture.series.filter((point) =>
    inRange(point.year, point.month, range),
  );
const later = (value) => Promise.resolve(structuredClone(value));
const sum = (series) => series.reduce((total, point) => total + point.count, 0);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[index]
    : (sorted[index - 1] + sorted[index]) / 2;
};

export const summary = (range) => {
  const fixture = structuredClone(summaryFixture);
  fixture.series = selectedSeries(range);
  const [firstYear, firstMonth] = range.from.split("-").map(Number);
  const [lastYear, lastMonth] = range.to.split("-").map(Number);
  const months = (lastYear - firstYear) * 12 + lastMonth - firstMonth + 1;
  fixture.period = { ...range, months };
  const present = new Set(
    fixture.series.map((point) => monthKey(point.year, point.month)),
  );
  const gaps = Array.from({ length: months }, (_, index) => {
    const month = firstMonth - 1 + index;
    return monthKey(firstYear + Math.floor(month / 12), (month % 12) + 1);
  }).filter((key) => !present.has(key));
  fixture.coverage = {
    months_expected: months,
    months_present: fixture.series.length,
    gaps,
    nrt_months: fixture.coverage.nrt_months.filter(
      (key) => key >= range.from && key <= range.to,
    ),
  };
  const peak = fixture.series.reduce(
    (best, point) => (!best || point.count > best.count ? point : best),
    null,
  );
  fixture.totals = {
    hotspot_days: sum(fixture.series),
    mean_month: fixture.series.length
      ? Math.round(sum(fixture.series) / fixture.series.length)
      : 0,
    peak_year: peak?.year ?? null,
    peak_month: peak?.month ?? null,
  };
  return later(fixture);
};

export const calendar = (range) => {
  const fixture = structuredClone(calendarFixture);
  const indices = fixture.years
    .map((year, index) => [year, index])
    .filter(
      ([year]) =>
        year >= Number(range.from.slice(0, 4)) &&
        year <= Number(range.to.slice(0, 4)),
    );
  fixture.years = indices.map(([year]) => year);
  fixture.values = indices.map(([year, index]) =>
    fixture.values[index].map((value, month) =>
      inRange(year, month + 1, range) ? value : null,
    ),
  );
  return later(fixture);
};

export const anomaly = (month) => {
  if (month === anomalyFixture.month) return later(anomalyFixture);
  const [year, number] = month.split("-").map(Number);
  const points = summaryFixture.series.filter(
    (point) => point.month === number && point.year <= year,
  );
  const observed = points.find((point) => point.year === year)?.count;
  const history = points
    .filter((point) => point.year < year)
    .map((point) => point.count);
  if (observed == null || !history.length)
    return Promise.reject(
      new Error("The fixture has no comparable history for this month."),
    );
  const center = median(history);
  const mad = median(history.map((value) => Math.abs(value - center)));
  const sigma = 1.4826 * mad;
  const z = sigma ? (observed - center) / sigma : 0;
  return later({
    ...anomalyFixture,
    month,
    observed,
    partial: false,
    through_day: points.at(-1).days_in_month,
    baseline: {
      median: center,
      mad,
      robust_sigma: sigma,
      n_years: history.length,
      window: "same calendar month, full month",
    },
    robust_z: z,
    percentile:
      history.filter((value) => value <= observed).length / history.length,
    direction: z > 1 ? "above" : z < -1 ? "below" : "normal",
    series: points.map(({ year: pointYear, count }) => ({
      year: pointYear,
      count,
    })),
  });
};

export const top = (range) => {
  const series = selectedSeries(range);
  const years = new Map();
  for (const point of series)
    years.set(point.year, (years.get(point.year) || 0) + point.count);
  const ranked = (values) =>
    values
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.year - b.year ||
          (a.month || 0) - (b.month || 0),
      )
      .slice(0, 10)
      .map((point, index) => ({ ...point, rank: index + 1 }));
  return later({
    meta: summaryFixture.meta,
    aoi_id: summaryFixture.aoi.id,
    months: ranked(
      series.map(({ year, month, count }) => ({ year, month, count })),
    ),
    years: ranked([...years].map(([year, count]) => ({ year, count }))),
  });
};

export const harmonization = (range) => {
  const fixture = structuredClone(harmonizationFixture);
  fixture.series = fixture.series.filter((point) =>
    inRange(point.year, point.month, range),
  );
  fixture.jump = {
    ...fixture.jump,
    step_ratio_raw: null,
    step_ratio_harmonized: null,
    step_ratio_modis: null,
    step_ratio_placebo: null,
  };
  fixture.validation = {
    holdout_years: [],
    n: 0,
    rmse_log: null,
    mape: null,
    wape: null,
    bias: null,
  };
  return later(fixture);
};

export const monthlyCsv = (range) => {
  const header =
    "year,month,count,lo,hi,sensor,harmonized,days_observed,days_in_month";
  const rows = selectedSeries(range).map((point) =>
    [
      point.year,
      point.month,
      point.count,
      point.lo,
      point.hi,
      point.sensor,
      point.harmonized,
      point.days_observed,
      point.days_in_month,
    ].join(","),
  );
  return { text: [header, ...rows].join("\r\n"), rows: rows.length };
};
