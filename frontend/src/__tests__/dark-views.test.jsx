import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App";
import AoiMap from "../components/AoiMap";
import CalendarHeatmap from "../components/CalendarHeatmap";
import HarmonizationChart from "../components/HarmonizationChart";
import { useAoiData } from "../api/useAoiData";
import { getHealth } from "../api/client";

vi.mock("../api/useAoiData", () => ({ useAoiData: vi.fn() }));
vi.mock("../api/client", () => ({ getHealth: vi.fn() }));
vi.mock("../components/AoiMap", () => ({ default: () => null }));
vi.mock("../components/CoordinateForm", () => ({ default: () => null }));
vi.mock("../components/PeriodSelect", () => ({ default: () => null }));
vi.mock("../components/CalendarHeatmap", () => ({ default: () => null }));
vi.mock("../components/PaletteSwitch", () => ({ default: () => null }));
vi.mock("../components/AnomalyCard", () => ({ default: () => null }));
vi.mock("../components/TopPeriods", () => ({ default: () => null }));
vi.mock("../components/HarmonizationChart", () => ({ default: () => null }));
vi.mock("../components/SummaryStats", () => ({ default: () => null }));
vi.mock("../components/ExportPanel", () => ({ default: () => null }));
vi.mock("../components/StatusBadge", () => ({ default: () => null }));
vi.mock("../components/ErrorBanner", () => ({ default: () => null }));
vi.mock("../ui/Footer", () => ({ default: () => null }));

let view;
const text = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : text(child)))
    .join("");
const nav = (destination) =>
  view.root
    .findByProps({ "aria-label": "Main navigation" })
    .findByProps({ href: `#${destination}` });
const changeView = (destination) => {
  const preventDefault = vi.fn();
  act(() => nav(destination).props.onClick({ preventDefault }));
  expect(preventDefault).toHaveBeenCalledOnce();
};
const expectActiveView = (active) => {
  for (const id of ["explore", "calendar", "method", "export"]) {
    expect(view.root.findByProps({ id }).props.hidden).toBe(id !== active);
    expect(nav(id).props["aria-current"]).toBe(
      id === active ? "location" : undefined,
    );
  }
};

beforeEach(() => {
  vi.stubGlobal("window", {
    location: {
      search: "?from=2024-01&to=2024-12&month=2024-10",
      pathname: "/",
      hash: "",
    },
    history: { replaceState: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    getElementById: () => ({ scrollIntoView: vi.fn() }),
  });
  getHealth.mockImplementation(() => new Promise(() => {}));
  useAoiData.mockImplementation((_aoi, _range, month) => {
    const state = (data) => ({ data, error: null, loading: false });
    return {
      summary: state({ aoi: { area_km2: 240 }, coverage: { nrt_months: [] } }),
      calendar: state({ palettes: ["viridis", "cividis"] }),
      anomaly: state({ month }),
      top: state({}),
      harmonization: state({}),
    };
  });
  act(() => {
    view = create(<App />);
  });
});

afterEach(() => {
  act(() => view?.unmount());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("switches dedicated views and only mounts the expensive chart in Method", () => {
  expectActiveView("explore");
  expect(view.root.findByType(CalendarHeatmap).props.compact).not.toBe(true);
  expect(view.root.findAllByType(HarmonizationChart)).toHaveLength(0);
  changeView("method");
  expectActiveView("method");
  expect(text(view.root.findByType("h1"))).toBe("Method");
  expect(view.root.findAllByType(HarmonizationChart)).toHaveLength(1);
  changeView("export");
  expectActiveView("export");
  expect(text(view.root.findByType("h1"))).toBe("Export");
  expect(view.root.findAllByType(HarmonizationChart)).toHaveLength(0);
});

it("retains the chosen area and month across views", () => {
  const aoi = { kind: "bbox", bbox: [73.4, 42.45, 75.4, 43.2] };
  act(() => view.root.findByType(AoiMap).props.onChange(aoi));
  act(() => view.root.findByType(CalendarHeatmap).props.onSelect("2024-07"));
  changeView("export");
  changeView("explore");
  expect(view.root.findByType(AoiMap).props.aoi).toEqual(aoi);
  expect(view.root.findByType(CalendarHeatmap).props.selectedMonth).toBe(
    "2024-07",
  );
  expect(text(view.root.findByProps({ id: "area-title" }))).toBe("Chüy Valley");
  expect(view.root.findByType("select").props.value).toBe("Chüy Valley");
  expect(view.root.findByProps({ type: "month" }).props.value).toBe("2024-07");
  expectActiveView("explore");
});

it("opens dedicated history from the selection panel without duplicating the calendar", () => {
  expect(view.root.findByProps({ id: "calendar" }).props.hidden).toBe(true);
  const open = view.root
    .findAllByType("button")
    .find((node) => text(node).startsWith("View history"));
  act(() => open.props.onClick());
  expectActiveView("calendar");
  expect(text(view.root.findByType("h1"))).toBe("History");
  expect(view.root.findAllByType(CalendarHeatmap)).toHaveLength(1);
  expect(view.root.findByType(CalendarHeatmap).props.compact).not.toBe(true);
  expect(
    view.root.findByProps({ id: "calendar" }).findAllByType(CalendarHeatmap),
  ).toHaveLength(1);
  expect(
    view.root.findByProps({ id: "explore" }).findAllByType(CalendarHeatmap),
  ).toHaveLength(0);

  act(() => view.root.findByType(CalendarHeatmap).props.onSelect("2024-08"));
  expectActiveView("explore");
  expect(view.root.findByProps({ type: "month" }).props.value).toBe("2024-08");
  expect(view.root.findByType(CalendarHeatmap).props.selectedMonth).toBe(
    "2024-08",
  );
});
