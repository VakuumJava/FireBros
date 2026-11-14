import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import WorkspaceTools from "../components/WorkspaceTools";
import Card from "../ui/Card";
import AoiMap from "../components/AoiMap";
import CoordinateForm from "../components/CoordinateForm";
import PeriodSelect from "../components/PeriodSelect";
import CalendarHeatmap from "../components/CalendarHeatmap";
import TopPeriods from "../components/TopPeriods";
import { LimitationsView } from "../ui/LimitationsView";
import { useAoiData } from "../api/useAoiData";
import { getHealth } from "../api/client";
import { DEFAULT_AOI } from "../api/config";

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
const click = (node) => act(() => node.props.onClick());
const lastQuery = () => useAoiData.mock.calls.at(-1);

function render(element, options) {
  act(() => {
    view = create(element, options);
  });
  return view;
}

afterEach(() => {
  act(() => view?.unmount());
  view = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("workspace navigation and selection", () => {
  let scroll;
  beforeEach(() => {
    scroll = vi.fn();
    vi.stubGlobal("window", {
      location: { search: "?from=2024-01&to=2024-12&month=2024-10" },
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => ({ scrollIntoView: scroll })),
    });
    getHealth.mockImplementation(() => new Promise(() => {}));
    useAoiData.mockImplementation((_aoi, _range, month) => {
      const state = (data) => ({ data, error: null, loading: false });
      return {
        summary: state({
          aoi: { area_km2: 240 },
          coverage: { nrt_months: [] },
        }),
        calendar: state({ palettes: ["viridis", "cividis"] }),
        anomaly: state({ month }),
        top: state({}),
        harmonization: state({}),
      };
    });
  });

  it("opens the area editor, then closes it when the map changes the area", () => {
    const root = render(<App />).root;
    const toggle = root.findByProps({ "aria-controls": "area-editor" });
    expect(toggle.props["aria-expanded"]).toBe(false);
    expect(
      root.findByProps({ className: "area-picker" }).findByType("select").props
        .value,
    ).toBe("Regional archive");
    expect(root.findByProps({ id: "area-title" }).children).toEqual([
      "Regional archive",
    ]);
    click(toggle);
    expect(toggle.props["aria-expanded"]).toBe(true);
    expect(
      root.findByProps({ "aria-labelledby": "area-title" }).props[
        "data-expanded"
      ],
    ).toBe(true);

    const area = { kind: "bbox", bbox: [73.4, 42.45, 75.4, 43.2] };
    act(() => root.findByType(AoiMap).props.onChange(area));
    expect(lastQuery()[0]).toEqual(area);
    expect(root.findByProps({ id: "area-title" }).children).toEqual([
      "Chüy Valley",
    ]);
    expect(
      root.findByProps({ className: "area-picker" }).findByType("select").props
        .value,
    ).toBe("Chüy Valley");
    expect(toggle.props["aria-expanded"]).toBe(false);
    expect(
      root.findByProps({ "aria-labelledby": "area-title" }).props[
        "data-expanded"
      ],
    ).toBe(false);
  });

  it("returns focus to the area toggle before collapsing the selected editor", () => {
    const focusedStates = [];
    const toggleElement = {
      focus: vi.fn(() => {
        focusedStates.push(
          view.root.findByProps({ "aria-controls": "area-editor" }).props[
            "aria-expanded"
          ],
        );
      }),
    };
    const root = render(<App />, {
      createNodeMock: (element) =>
        element.type === "button" &&
        element.props["aria-controls"] === "area-editor"
          ? toggleElement
          : null,
    }).root;
    const toggle = root.findByProps({ "aria-controls": "area-editor" });
    click(toggle);
    expect(toggle.props["aria-expanded"]).toBe(true);

    act(() =>
      root.findByType(AoiMap).props.onChange({
        kind: "bbox",
        bbox: [73.4, 42.45, 75.4, 43.2],
      }),
    );
    expect(toggleElement.focus).toHaveBeenCalledOnce();
    expect(focusedStates).toEqual([true]);
    expect(toggle.props["aria-expanded"]).toBe(false);
    expect(text(toggle)).toBe("Edit on map");
  });

  it("lets the user close the editor without changing their selection", () => {
    const root = render(<App />).root;
    const original = lastQuery()[0];
    const toggle = root.findByProps({ "aria-controls": "area-editor" });
    click(toggle);
    expect(text(toggle)).toBe("Close map");
    click(toggle);
    expect(text(toggle)).toBe("Edit on map");
    expect(lastQuery()[0]).toEqual(original);
  });

  it("brings the revealed map tools into view and transfers focus", () => {
    const tool = { focus: vi.fn() };
    const editor = {
      querySelector: vi.fn(() => tool),
      scrollIntoView: vi.fn(),
    };
    const root = render(<App />, {
      createNodeMock: (element) =>
        element.props.id === "area-editor" ? editor : null,
    }).root;
    click(root.findByProps({ "aria-controls": "area-editor" }));
    expect(tool.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(editor.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("moves focus to the visible view and back to the chosen month", () => {
    const heading = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const month = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const root = render(<App />, {
      createNodeMock: (element) => {
        if (element.type === "h1") return heading;
        if (element.type === "input" && element.props.type === "month")
          return month;
        return null;
      },
    }).root;
    click(root.findByProps({ className: "history-link" }));
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(root.findByType(AoiMap).props.active).toBe(false);
    expect(root.findByType(CalendarHeatmap).props.active).toBe(true);
    act(() => root.findByType(CalendarHeatmap).props.onSelect("2024-06"));
    expect(month.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(root.findByType(AoiMap).props.active).toBe(true);
    expect(root.findByType(CalendarHeatmap).props.active).toBe(false);
  });

  it.each([
    ["Chüy Valley", [73.4, 42.45, 75.4, 43.2]],
    ["Issyk-Kul", [76, 41.7, 78.8, 42.8]],
    ["Osh", [72.4, 39.9, 73.3, 40.9]],
  ])("uses the %s preset across all selection controls", (name, bbox) => {
    const root = render(<App />).root;
    const picker = root
      .findByProps({ className: "area-picker" })
      .findByType("select");
    const toggle = root.findByProps({ "aria-controls": "area-editor" });
    click(toggle);
    act(() => picker.props.onChange({ target: { value: name } }));

    const expected = { kind: "bbox", bbox };
    expect(lastQuery()[0]).toEqual(expected);
    expect(root.findByType(AoiMap).props.aoi).toEqual(expected);
    expect(root.findByType(CoordinateForm).props.aoi).toEqual(expected);
    expect(picker.props.value).toBe(name);
    expect(text(root.findByProps({ id: "area-title" }))).toBe(name);
    expect(toggle.props["aria-expanded"]).toBe(false);

    act(() => picker.props.onChange({ target: { value: "Regional archive" } }));
    expect(lastQuery()[0]).toEqual(DEFAULT_AOI);
    expect(picker.props.value).toBe("Regional archive");
  });

  it("uses coordinate selection for the same named-area state", () => {
    const root = render(<App />).root;
    const polygon = {
      kind: "polygon",
      polygon: [
        [72, 40],
        [73, 40],
        [73, 41],
      ],
    };
    act(() => root.findByType(CoordinateForm).props.onChange(polygon));
    expect(lastQuery()[0]).toEqual(polygon);
    expect(text(root.findByProps({ id: "area-title" }))).toBe("Custom polygon");
    const picker = root
      .findByProps({ className: "area-picker" })
      .findByType("select");
    expect(picker.props.value).toBe("Custom polygon");
    expect(picker.findAllByType("option").map(text)).toContain(
      "Custom polygon",
    );
    expect(root.findByType(AoiMap).props.aoi).toEqual(polygon);

    const area = { kind: "bbox", bbox: [76, 41.7, 78.8, 42.8] };
    act(() => root.findByType(CoordinateForm).props.onChange(area));
    expect(lastQuery()[0]).toEqual(area);
    expect(picker.props.value).toBe("Issyk-Kul");
    expect(picker.findAllByType("option").map(text)).not.toContain(
      "Custom polygon",
    );
  });

  it("retains every navigation destination and factual page headings", () => {
    const root = render(<App />).root;
    const nav = root.findByProps({ "aria-label": "Main navigation" });
    const links = nav.findAllByType("a");
    expect(links.map((link) => link.props.href)).toEqual([
      "#explore",
      "#calendar",
      "#method",
      "#export",
    ]);
    expect(links.map(text)).toEqual(["Map", "History", "Method", "Export"]);
    for (const link of links)
      expect(
        root.findAllByProps({ id: link.props.href.slice(1) }),
      ).toHaveLength(1);
    expect(text(root.findByType("h1"))).toBe("Fire activity");
    const headings = root.findAll((node) => ["h1", "h2"].includes(node.type));
    expect(headings.some((node) => /\d{2}\s*\//.test(text(node)))).toBe(false);
    expect(
      headings.some((node) =>
        /longer perspective|take it further/i.test(text(node)),
      ),
    ).toBe(false);
  });

  it("restores a saved analysis across map, dates, palette and view", () => {
    const root = render(<App />).root;
    const selection = {
      aoi: { kind: "bbox", bbox: [76, 41.7, 78.8, 42.8] },
      range: { from: "2020-01", to: "2023-12" },
      month: "2022-08",
      palette: "cividis",
      view: "calendar",
    };
    act(() => root.findByType(WorkspaceTools).props.onRestore(selection));
    expect(lastQuery().slice(0, 3)).toEqual([
      selection.aoi,
      selection.range,
      selection.month,
    ]);
    expect(root.findByType(CalendarHeatmap).props.palette).toBe("cividis");
    expect(root.findByProps({ id: "calendar" }).props.hidden).toBe(false);
    expect(root.findByType(AoiMap).props.active).toBe(false);
  });

  it("accepts only months inside the chosen range", () => {
    const root = render(<App />).root;
    const input = root.findByProps({ type: "month" });
    act(() => input.props.onChange({ target: { value: "2024-08" } }));
    expect(lastQuery()[2]).toBe("2024-08");
    act(() => input.props.onChange({ target: { value: "2025-01" } }));
    expect(lastQuery()[2]).toBe("2024-08");
    act(() => input.props.onChange({ target: { value: "2023-12" } }));
    expect(lastQuery()[2]).toBe("2024-08");
  });

  it("shares calendar and ranking selection with the month comparison", () => {
    const root = render(<App />).root;
    act(() => root.findByType(CalendarHeatmap).props.onSelect("2024-03"));
    expect(root.findByProps({ type: "month" }).props.value).toBe("2024-03");
    expect(lastQuery()[2]).toBe("2024-03");

    act(() => root.findByType(TopPeriods).props.onSelect("2024-06"));
    expect(root.findByProps({ type: "month" }).props.value).toBe("2024-06");
    expect(lastQuery()[2]).toBe("2024-06");
    expect(document.getElementById).toHaveBeenCalledWith("explore");
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto" });
  });

  it("moves the selected month into a newly narrowed date range", () => {
    const root = render(<App />).root;
    const range = { from: "2024-02", to: "2024-04" };
    act(() => root.findByType(PeriodSelect).props.onChange(range));
    expect(lastQuery()[1]).toEqual(range);
    expect(lastQuery()[2]).toBe("2024-04");
    expect(root.findByProps({ type: "month" }).props.min).toBe("2024-02");
    expect(root.findByProps({ type: "month" }).props.max).toBe("2024-04");
  });
});

describe("compact data panels", () => {
  it("keeps a hidden panel title in the heading structure without hiding content", () => {
    const root = render(
      <Card
        title="Activity calendar"
        hideTitle
        state={{ data: {}, loading: false }}
      >
        <p>Observed activity</p>
      </Card>,
    ).root;
    expect(text(root.findByType("h2"))).toBe("Activity calendar");
    expect(root.findByType("header").props.className).toBe("visually-hidden");
    expect(text(root.findByType("p"))).toBe("Observed activity");
    expect(root.findAllByProps({ role: "status" })).toHaveLength(0);
  });

  it("reports loading with its accessible title when data has not arrived", () => {
    const root = render(
      <Card
        title="Selected month"
        hideTitle
        state={{ data: null, loading: true }}
      >
        <p>Old observation</p>
      </Card>,
    ).root;
    expect(root.findByType("section").props["aria-busy"]).toBe(true);
    expect(text(root.findByProps({ role: "status" }))).toBe(
      "Loading observations…",
    );
    expect(root.findAllByType("p")).toHaveLength(0);
    expect(text(root.findByType("h2"))).toBe("Selected month");
  });
});

describe("limitations focus lifecycle", () => {
  it("contains keyboard focus, handles Escape and restores the triggering control", () => {
    const handlers = new Map();
    const doc = {
      body: { style: { overflow: "auto" } },
      addEventListener: vi.fn((type, handler) => handlers.set(type, handler)),
      removeEventListener: vi.fn((type, handler) => {
        if (handlers.get(type) === handler) handlers.delete(type);
      }),
    };
    vi.stubGlobal("document", doc);
    const target = () => ({
      isConnected: true,
      closest: () => null,
      focus: vi.fn(function () {
        doc.activeElement = this;
      }),
    });
    const trigger = target();
    const first = target();
    const last = target();
    doc.activeElement = trigger;
    const dialog = {
      querySelectorAll: () => [first, last],
      contains: (node) => [first, last, dialog].includes(node),
      focus: () => {
        doc.activeElement = dialog;
      },
    };
    const close = vi.fn();
    render(<LimitationsView isOpen onClose={close} />, {
      createNodeMock: (element) =>
        element.props.role === "dialog" ? dialog : null,
    });
    expect(doc.body.style.overflow).toBe("hidden");
    expect(doc.activeElement).toBe(first);

    const tab = { key: "Tab", shiftKey: true, preventDefault: vi.fn() };
    handlers.get("keydown")(tab);
    expect(tab.preventDefault).toHaveBeenCalledOnce();
    expect(doc.activeElement).toBe(last);
    handlers.get("keydown")({ ...tab, shiftKey: false });
    expect(doc.activeElement).toBe(first);

    doc.activeElement = trigger;
    handlers.get("focusin")({ target: trigger });
    expect(doc.activeElement).toBe(first);
    handlers.get("keydown")({ key: "Escape", preventDefault: vi.fn() });
    expect(close).toHaveBeenCalledOnce();
    act(() => view.update(<LimitationsView isOpen={false} onClose={close} />));
    expect(doc.activeElement).toBe(trigger);
    expect(doc.body.style.overflow).toBe("auto");
    expect(handlers.size).toBe(0);
  });
});
