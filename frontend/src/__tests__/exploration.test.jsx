import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import TopPeriods from "../components/TopPeriods";
import CalendarHeatmap from "../components/CalendarHeatmap";
import AnomalyCard from "../components/AnomalyCard";

const renderers = [];
function render(element, options) {
  let renderer;
  act(() => {
    renderer = create(element, options);
  });
  renderers.push(renderer);
  return renderer;
}
afterEach(() => {
  act(() => {
    for (const renderer of renderers.splice(0)) renderer.unmount();
  });
});

const text = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : text(child)))
    .join("");
const button = (renderer, label) =>
  renderer.root.findAllByType("button").find((node) => text(node) === label);
const click = (node) => act(() => node.props.onClick());
const ranked = {
  months: Array.from({ length: 8 }, (_, index) => ({
    rank: index + 1,
    year: 2025,
    month: index + 1,
    count: 800 - index * 90,
  })),
  years: Array.from({ length: 7 }, (_, index) => ({
    rank: index + 1,
    year: 2025 - index,
    count: 4000 - index * 400,
  })),
};

function rankingRows(renderer) {
  return renderer.root.findByType("ol").findAllByType("li");
}

describe("ranking exploration", () => {
  it("switches between month and year rankings and resets expansion", () => {
    const view = render(<TopPeriods data={ranked} />);
    expect(button(view, "Months").props["aria-pressed"]).toBe(true);
    expect(rankingRows(view)).toHaveLength(5);
    expect(text(rankingRows(view)[0])).toContain("January 2025");

    click(button(view, "Show all 8 months"));
    expect(rankingRows(view)).toHaveLength(8);
    click(button(view, "Years"));
    expect(button(view, "Years").props["aria-pressed"]).toBe(true);
    expect(button(view, "Months").props["aria-pressed"]).toBe(false);
    expect(view.root.findByType("ol").props["aria-label"]).toBe(
      "Highest activity years",
    );
    expect(rankingRows(view)).toHaveLength(5);
    expect(text(rankingRows(view)[0])).toContain("4,000");

    click(button(view, "Show all 7 years"));
    expect(rankingRows(view)).toHaveLength(7);
    click(button(view, "Show first five"));
    expect(rankingRows(view)).toHaveLength(5);
    click(button(view, "Months"));
    expect(text(rankingRows(view)[0])).toContain("January 2025");
  });

  it("emits a padded month identifier and never presents years as month actions", () => {
    const onSelect = vi.fn();
    const view = render(<TopPeriods data={ranked} onSelect={onSelect} />);
    click(
      view.root.findByProps({
        "aria-label": "Compare March 2025: 620 hotspot-days",
      }),
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("2025-03");
    click(button(view, "Years"));
    expect(view.root.findByType("ol").findAllByType("button")).toHaveLength(0);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("clears expanded rows when a new area returns fewer periods", () => {
    const view = render(<TopPeriods data={ranked} />);
    click(button(view, "Show all 8 months"));
    act(() =>
      view.update(
        <TopPeriods data={{ months: [ranked.months[0]], years: [] }} />,
      ),
    );
    expect(rankingRows(view)).toHaveLength(1);
    expect(button(view, "Show first five")).toBeUndefined();
    click(button(view, "Years"));
    expect(text(view.root)).toContain("No observed years in this selection.");
  });
});

const calendar = {
  years: [2024, 2025],
  values: [[null, 0, 25, ...Array(9).fill(1)], Array(12).fill(7)],
  max: 25,
  unit: "hotspot_days_1km",
};
const cell = (renderer, label) =>
  renderer.root.findByProps({ role: "gridcell", "aria-label": label });
function press(node, key) {
  const preventDefault = vi.fn();
  act(() => node.props.onKeyDown({ key, preventDefault }));
  return preventDefault;
}

describe("calendar exploration", () => {
  it("toggles visible values without changing the selected month or emitting a new selection", () => {
    const onSelect = vi.fn();
    const view = render(
      <CalendarHeatmap
        data={calendar}
        selectedMonth="2024-02"
        onSelect={onSelect}
      />,
    );
    const zero = cell(view, "2024, February: 0 hotspot-days");
    expect(zero.props["aria-selected"]).toBe(true);
    expect(button(view, "Show values").props["aria-pressed"]).toBe(false);
    click(button(view, "Show values"));
    expect(button(view, "Hide values").props["aria-pressed"]).toBe(true);
    expect(
      cell(view, "2024, February: 0 hotspot-days").props["aria-selected"],
    ).toBe(true);
    expect(
      text(view.root.findByProps({ className: "cal__selection" })),
    ).toContain("0 hotspot-days");
    expect(onSelect).not.toHaveBeenCalled();
    click(button(view, "Hide values"));
    expect(button(view, "Show values").props["aria-pressed"]).toBe(false);
  });

  it("rejects missing cells for mouse and keyboard but allows an observed zero", () => {
    const onSelect = vi.fn();
    const view = render(
      <CalendarHeatmap
        data={calendar}
        selectedMonth="2024-01"
        onSelect={onSelect}
      />,
    );
    const missing = cell(view, "2024, January: no data");
    expect(missing.props["aria-disabled"]).toBe(true);
    expect(
      text(view.root.findByProps({ className: "cal__selection" })),
    ).toContain("No data");
    click(missing);
    expect(press(missing, "Enter")).toHaveBeenCalledOnce();
    press(missing, " ");
    expect(onSelect).not.toHaveBeenCalled();

    const zero = cell(view, "2024, February: 0 hotspot-days");
    expect(zero.props["aria-disabled"]).toBe(false);
    click(zero);
    press(zero, "Enter");
    press(zero, " ");
    expect(onSelect.mock.calls).toEqual([
      ["2024-02"],
      ["2024-02"],
      ["2024-02"],
    ]);
  });

  it("moves one keyboard tab stop with arrows and Home/End, clamping at grid edges", () => {
    const focused = [];
    const view = render(
      <CalendarHeatmap data={calendar} selectedMonth="2024-02" />,
      {
        createNodeMock: (element) =>
          element.props.role === "gridcell"
            ? { focus: () => focused.push(element.props["aria-label"]) }
            : null,
      },
    );
    press(cell(view, "2024, February: 0 hotspot-days"), "ArrowRight");
    expect(focused.at(-1)).toBe("2024, March: 25 hotspot-days");
    expect(cell(view, "2024, March: 25 hotspot-days").props.tabIndex).toBe(0);
    press(cell(view, "2024, March: 25 hotspot-days"), "ArrowDown");
    expect(focused.at(-1)).toBe("2025, March: 7 hotspot-days");
    press(cell(view, "2025, March: 7 hotspot-days"), "End");
    expect(focused.at(-1)).toBe("2025, December: 7 hotspot-days");
    press(cell(view, "2025, December: 7 hotspot-days"), "ArrowRight");
    expect(focused.at(-1)).toBe("2025, December: 7 hotspot-days");
    press(cell(view, "2025, December: 7 hotspot-days"), "Home");
    expect(focused.at(-1)).toBe("2025, January: 7 hotspot-days");
    expect(
      view.root
        .findAllByProps({ role: "gridcell" })
        .filter((node) => node.props.tabIndex === 0),
    ).toHaveLength(1);
  });

  it("reports partial coverage for the selected observation and hover preview", () => {
    const view = render(
      <CalendarHeatmap
        data={calendar}
        selectedMonth="2024-03"
        nrtMonths={["2024-03"]}
      />,
    );
    expect(
      text(view.root.findByProps({ className: "cal__selection" })),
    ).toContain("Partial coverage");
    const selected = cell(
      view,
      "2024, March: 25 hotspot-days, partial source coverage",
    );
    act(() => selected.props.onMouseEnter());
    expect(
      text(view.root.findByProps({ className: "cal__readout" })),
    ).toContain("March 2024 · 25 hotspot-days · Partial coverage");
  });
});

const anomaly = {
  month: "2025-10",
  observed: 12,
  partial: false,
  through_day: 31,
  baseline: {
    median: 10,
    robust_sigma: 3,
    n_years: 20,
    window: "same month, days <= 31",
  },
  robust_z: 0.67,
  percentile: 0.6,
  direction: "normal",
  series: [
    { year: 2024, count: 0 },
    { year: 2025, count: 12 },
  ],
};
function anomalyWith(patch) {
  return {
    ...anomaly,
    ...patch,
    baseline: { ...anomaly.baseline, ...patch.baseline },
  };
}
const marker = (view) =>
  view.root.findAllByProps({ className: "atlas-percentile__marker" });

describe("anomaly boundaries", () => {
  it.each([
    [10, "Equal to a constant historical baseline"],
    [
      12,
      "Above a constant historical baseline; standardized score unavailable",
    ],
    [8, "Below a constant historical baseline; standardized score unavailable"],
  ])(
    "does not invent a standardized score for zero dispersion (observed %s)",
    (observed, expected) => {
      const view = render(
        <AnomalyCard
          data={anomalyWith({
            observed,
            robust_z: 0,
            baseline: { robust_sigma: 0 },
          })}
        />,
      );
      expect(
        text(view.root.findByProps({ className: "atlas-anomaly__verdict" })),
      ).toBe(expected);
      const score = view.root
        .findAllByType("dt")
        .find((node) => text(node) === "Standardized score");
      expect(text(score.parent.findByType("dd"))).toBe("Unavailable");
    },
  );

  it.each([null, undefined, NaN, Infinity])(
    "renders percentile %s as unavailable without a marker",
    (percentile) => {
      const view = render(<AnomalyCard data={anomalyWith({ percentile })} />);
      expect(marker(view)).toHaveLength(0);
      expect(
        view.root.findByProps({ className: "atlas-percentile__track" }).props[
          "aria-label"
        ],
      ).toBe("Historical percentile unavailable");
      expect(
        text(view.root.findByProps({ className: "atlas-percentile__heading" })),
      ).toContain("Unavailable");
    },
  );

  it.each([
    [-0.1, "0%", "0th"],
    [1.4, "100%", "100th"],
    [0.21, "21%", "21st"],
    [0.11, "11%", "11th"],
  ])(
    "keeps percentile %s within the ruler and its label consistent",
    (percentile, position, label) => {
      const view = render(<AnomalyCard data={anomalyWith({ percentile })} />);
      expect(marker(view)[0].props.style.left).toBe(position);
      expect(
        text(view.root.findByProps({ className: "atlas-percentile__heading" })),
      ).toContain(`${label} percentile`);
    },
  );

  it("represents a zero historical count as a zero-height bar and identifies the selected year", () => {
    const view = render(<AnomalyCard data={anomaly} />);
    const bars = view.root.findAllByType("rect");
    expect(bars[0].props.height).toBe(0);
    expect(Number.isFinite(bars[0].props.y)).toBe(true);
    expect(text(bars[0].findByType("title"))).toBe("2024: 0 hotspot-days");
    expect(view.root.findByType("svg").props["aria-label"]).toBe(
      "Monthly historical counts; 2025 is highlighted",
    );
  });
});
