import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildEvidenceReport,
  downloadEvidenceReport,
} from "../analysis/report";

function snapshot() {
  return {
    aoi: { kind: "bbox", bbox: [73.4, 42.45, 75.4, 43.2] },
    range: { from: "2020-01", to: "2025-12" },
    month: "2025-10",
    generatedAt: "2026-11-15T00:00:00Z",
    summary: {
      meta: {
        source: "parquet",
        unit: "hotspot_days_1km",
        method_version: "harmonize-v2",
        generated_at: "2026-11-14T00:00:00Z",
      },
      aoi: {
        id: "aoi_12345678",
        kind: "bbox",
        bbox: [73.4, 42.45, 75.4, 43.2],
        area_km2: 12,
        cells_total: 10,
        cells_inside: 8,
      },
      period: { from: "2020-01", to: "2025-12" },
      coverage: {
        months_present: 70,
        months_expected: 72,
        gaps: ["2020-01"],
        nrt_months: ["2025-12"],
      },
    },
    anomaly: {
      meta: { source: "parquet", method_version: "harmonize-v2" },
      aoi_id: "aoi_12345678",
      month: "2025-10",
      observed: 0,
      partial: false,
      through_day: 31,
      label: "Below historical median",
      robust_z: -2,
      percentile: 0,
      baseline: {
        median: 12,
        robust_sigma: 6,
        n_years: 20,
        window: "same month, full month",
      },
    },
    harmonization: {
      meta: { source: "parquet", method_version: "harmonize-v2" },
      aoi_id: "aoi_12345678",
      jump: {
        step_ratio_raw: 2.7,
        step_ratio_harmonized: 0.8,
        step_ratio_modis: 0.6,
        step_ratio_placebo: null,
      },
      validation: {
        holdout_years: [2024, 2025],
        n: 24,
        wape: 0.231,
        mape: null,
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("evidence report", () => {
  it("exports a self-contained, print-friendly report with real zeros and provenance", () => {
    const report = buildEvidenceReport(snapshot());
    expect(report.filename).toBe("ala-too-fire-report-2025-10.html");
    expect(report.html).toContain('class="reading">0 <small>hotspot-days');
    expect(report.html).toContain("23.1%");
    expect(report.html).toContain("2026-11-15T00:00:00Z");
    expect(report.html).toContain("harmonize-v2");
    expect(report.html).toContain("same month, full month");
    expect(report.html).toContain("@media print");
    expect(report.html).toContain("not a confirmed wildfire");
    expect(report.html).toContain("not an untouched benchmark");
    expect(report.html).not.toMatch(/<(script|link|img|iframe)\b/i);
    expect(report.html).not.toMatch(/(?:src|href)=/i);
  });

  it("escapes hostile text from every response surface", () => {
    const data = snapshot();
    const payload = '</pre><script>alert("x")</script>&';
    data.anomaly.label = payload;
    data.anomaly.baseline.window = payload;
    data.summary.meta.method_version = payload;
    data.anomaly.meta.method_version = payload;
    data.harmonization.meta.method_version = payload;
    data.summary.coverage.gaps = [payload];
    data.harmonization.validation.holdout_years = [payload];
    data.generatedAt = payload;
    const { html } = buildEvidenceReport(data);
    expect(html).not.toContain(payload);
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;",
    );
  });

  it("marks fixtures and incomplete windows visibly", () => {
    const data = snapshot();
    for (const response of [data.summary, data.anomaly, data.harmonization])
      response.meta.source = "mock";
    data.anomaly.partial = true;
    data.anomaly.through_day = 14;
    data.anomaly.baseline.window = "same month, days <= 14";
    const { html } = buildEvidenceReport(data);
    expect(html).toContain("DEMO DATA");
    expect(html).toContain("through 14");
    expect(html).toContain("days &lt;= 14");
    expect(html).toContain("Illustrative fixture metrics");
  });

  it.each([
    (data) => {
      data.month = "../../2025-10";
    },
    (data) => {
      data.anomaly.month = "2025-09";
    },
    (data) => {
      data.summary.period.to = "2024-01";
    },
    (data) => {
      data.harmonization.aoi_id = "aoi_other";
    },
    (data) => {
      data.anomaly.observed = Infinity;
    },
    (data) => {
      data.anomaly.baseline.median = -1;
    },
    (data) => {
      data.aoi.bbox[0] = NaN;
    },
    (data) => {
      data.aoi.bbox[0] = 74;
    },
    (data) => {
      data.anomaly.meta.source = "mock";
    },
    (data) => {
      data.harmonization.meta.method_version = "another-method";
    },
    (data) => {
      data.anomaly.percentile = 1.1;
    },
    (data) => {
      data.anomaly.partial = true;
      data.anomaly.through_day = Infinity;
    },
    (data) => {
      data.anomaly.robust_z = NaN;
    },
    (data) => {
      data.anomaly.baseline.n_years = 0;
    },
  ])("rejects invalid or stale snapshots", (mutate) => {
    const data = snapshot();
    mutate(data);
    expect(() => buildEvidenceReport(data)).toThrow();
  });

  it("uses unavailable for absent metrics and a constant baseline", () => {
    const data = snapshot();
    data.harmonization = null;
    data.anomaly.baseline.robust_sigma = 0;
    expect(buildEvidenceReport(data).html).toContain(
      "Unavailable: constant baseline",
    );
    expect(buildEvidenceReport(data).html).toContain(
      "Calibration metrics were not available",
    );
  });

  it("downloads locally and revokes its temporary blob URL", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const link = { click };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:report"),
      revokeObjectURL,
    });
    expect(downloadEvidenceReport(snapshot())).toBe(
      "ala-too-fire-report-2025-10.html",
    );
    expect(link.href).toBe("blob:report");
    expect(link.download).toBe("ala-too-fire-report-2025-10.html");
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
