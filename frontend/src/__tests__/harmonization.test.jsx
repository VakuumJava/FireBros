import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HarmonizationChart from "../components/HarmonizationChart";

const plotly = vi.hoisted(() => ({
  react: vi.fn(),
  purge: vi.fn(),
  Plots: { resize: vi.fn() },
}));
vi.mock("plotly.js-dist-min", () => ({ default: plotly }));

const point = (month, raw = 12) => ({
  year: 2025,
  month,
  sensor: "VIIRS_SNPP",
  raw,
  harmonized: raw / 2,
  lo: raw / 3,
  hi: raw,
  modis_truth: null,
});
const response = (series) => ({
  meta: { source: "mock" },
  knot_year: 2012,
  series,
  jump: {},
  validation: {},
});
const node = { isConnected: true };
let view;
let disconnect;

beforeEach(() => {
  plotly.react.mockReset().mockResolvedValue(undefined);
  plotly.purge.mockClear();
  plotly.Plots.resize.mockClear();
  disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name) =>
      ({
        "--text": "#1d312f",
        "--rule": "#d1d9d1",
        "--accent": "#964225",
        "--secondary": "#245c54",
        "--border-strong": "#7e8e86",
      })[name] || "",
  }));
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  vi.unstubAllGlobals();
});

async function render(data) {
  await act(async () => {
    view = create(<HarmonizationChart data={data} />, {
      createNodeMock: (element) =>
        element.props.className === "harm__chart" ? node : null,
    });
  });
}

describe("sensor comparison rendering", () => {
  it("shows isolated monthly observations and keeps its legend outside Plotly", async () => {
    await render(response([point(10)]));
    expect(plotly.react).toHaveBeenCalledTimes(1);
    const [, traces, layout] = plotly.react.mock.calls[0];
    for (const name of ["Native sensor count", "MODIS-equivalent"]) {
      const trace = traces.find((item) => item.name === name);
      expect(trace.mode).toContain("markers");
      expect(trace.x).toEqual(["2025-10-01"]);
      expect(trace.y).toHaveLength(1);
    }
    expect(layout.showlegend).toBe(false);
    const legend = view.root.findByProps({ "aria-label": "Chart series" });
    expect(legend.type).toBe("ul");
    expect(legend.findAllByType("li")).toHaveLength(4);
    expect(view.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it("redraws changed data, preserves missing months and releases the previous plot", async () => {
    await render(response([point(1)]));
    await act(async () => {
      view.update(
        <HarmonizationChart data={response([point(1), point(3, 30)])} />,
      );
    });
    expect(plotly.react).toHaveBeenCalledTimes(2);
    expect(plotly.purge).toHaveBeenCalledWith(node);
    expect(disconnect).toHaveBeenCalledOnce();
    const [, traces] = plotly.react.mock.calls[1];
    for (const trace of traces) {
      expect(trace.x).toEqual(["2025-01-01", "2025-02-01", "2025-03-01"]);
      expect(trace.connectgaps).toBe(false);
      expect(trace.y[1]).toBeNull();
    }
    expect(
      traces.find((item) => item.name === "Native sensor count").y,
    ).toEqual([12, null, 30]);
  });

  it("judges the calibrated step against what MODIS alone observed", async () => {
    await render({
      ...response([point(10)]),
      meta: { source: "parquet" },
      jump: {
        step_ratio_raw: 2.778,
        step_ratio_harmonized: 0.783,
        step_ratio_modis: 0.579,
        step_ratio_placebo: 0.611,
        definition: "median ratio",
      },
      validation: { holdout_years: [2024, 2025], n: 19, wape: 0.231 },
    });
    const metrics = Object.fromEntries(
      view.root
        .findAllByType("dt")
        .map((term) => [term.children.join(""), term.parent.findByType("dd")]),
    );
    expect(metrics["MODIS alone"].children.join("")).toBe("x0.58");
    expect(metrics["Calibrated"].children.join("")).toBe("x0.78");
    expect(metrics["Weighted error (WAPE)"].children.join("")).toBe("23.1%");
  });

  it("provides an accessible fallback when chart initialization fails", async () => {
    plotly.react.mockRejectedValueOnce(new Error("renderer failed"));
    await render(response([point(10)]));
    const alert = view.root.findByProps({ role: "alert" });
    expect(alert.children.join(" ")).toContain("calendar and CSV export");
    expect(
      view.root.findByProps({ "aria-label": "Chart series" }),
    ).toBeDefined();
  });
});
