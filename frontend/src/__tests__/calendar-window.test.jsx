import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import CalendarHeatmap from "../components/CalendarHeatmap";

let view;
afterEach(() => act(() => view?.unmount()));

const archive = {
  years: Array.from({ length: 12 }, (_, index) => 2014 + index),
  values: Array.from({ length: 12 }, () => Array(12).fill(1)),
  max: 1,
  unit: "hotspot_days_1km",
};
const label = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : label(child)))
    .join("");
const button = (name) =>
  view.root.findAllByType("button").find((node) => label(node) === name);

function mount(options = {}) {
  act(() => {
    view = create(
      <CalendarHeatmap data={archive} selectedMonth="2025-10" />,
      options,
    );
  });
}

describe("archive window", () => {
  it("keeps every month and its keyboard guide available in the compact dock", () => {
    act(() => {
      view = create(
        <CalendarHeatmap data={archive} compact selectedMonth="2025-10" />,
      );
    });
    expect(
      view.root.findByProps({ className: "cal cal--compact" }),
    ).toBeDefined();
    expect(view.root.findAllByProps({ role: "gridcell" })).toHaveLength(144);
    const grid = view.root.findByProps({ role: "grid" });
    expect(
      label(view.root.findByProps({ id: grid.props["aria-describedby"] })),
    ).toContain("Arrow keys to move");
    act(() => button("Show full archive").props.onClick());
    expect(
      view.root.findByProps({ className: "cal cal--compact cal--expanded" }),
    ).toBeDefined();
    expect(view.root.findAllByProps({ role: "gridcell" })).toHaveLength(144);
  });

  it("expands and collapses the archive without dropping observations", () => {
    mount();
    const cells = () => view.root.findAllByProps({ role: "gridcell" });
    expect(cells()).toHaveLength(144);
    const expand = button("Show full archive");
    expect(expand.props["aria-expanded"]).toBe(false);
    const region = view.root.findByProps({ id: expand.props["aria-controls"] });
    expect(region.props.role).toBe("region");

    act(() => expand.props.onClick());
    expect(button("Collapse archive").props["aria-expanded"]).toBe(true);
    expect(cells()).toHaveLength(144);
    expect(view.root.findAllByProps({ "aria-selected": true })).toHaveLength(1);

    act(() => button("Collapse archive").props.onClick());
    expect(button("Show full archive").props["aria-expanded"]).toBe(false);
    expect(cells()).toHaveLength(144);
  });

  it("reveals keyboard focus inside the archive without scrolling the page", () => {
    const focus = vi.fn();
    const viewport = {
      clientHeight: 440,
      clientWidth: 640,
      scrollTop: 0,
      scrollLeft: 0,
      getBoundingClientRect: () => ({ top: 100, left: 0 }),
    };
    mount({
      createNodeMock(element) {
        if (element.props.className === "cal__scroll") return viewport;
        if (element.props.role === "gridcell")
          return {
            focus,
            getBoundingClientRect: () => ({
              top: 600,
              bottom: 644,
              left: 44,
              right: 92,
              height: 44,
            }),
          };
        return null;
      },
    });
    viewport.scrollTop = 0;
    const current = view.root.findByProps({
      role: "gridcell",
      "aria-label": "2025, October: 1 hotspot-days",
    });
    const preventDefault = vi.fn();
    act(() => current.props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(viewport.scrollTop).toBe(104);
    expect(
      view.root.findByProps({
        role: "gridcell",
        "aria-label": "2025, November: 1 hotspot-days",
      }).props.tabIndex,
    ).toBe(0);
  });

  it("reveals the latest selected month when its hidden view becomes active", () => {
    const measure = vi.fn(() => ({
      top: 800,
      bottom: 844,
      left: 44,
      right: 92,
      height: 44,
    }));
    const viewport = {
      clientHeight: 440,
      clientWidth: 640,
      scrollTop: 0,
      scrollLeft: 0,
      getBoundingClientRect: vi.fn(() => ({ top: 100, left: 0 })),
    };
    act(() => {
      view = create(
        <CalendarHeatmap
          data={archive}
          selectedMonth="2025-10"
          active={false}
        />,
        {
          createNodeMock(element) {
            if (element.props.className === "cal__scroll") return viewport;
            if (element.props.role === "gridcell")
              return {
                getBoundingClientRect:
                  element.props["aria-label"] === "2024, April: 1 hotspot-days"
                    ? measure
                    : vi.fn(),
              };
            return null;
          },
        },
      );
    });
    expect(viewport.getBoundingClientRect).not.toHaveBeenCalled();

    act(() => {
      view.update(
        <CalendarHeatmap
          data={archive}
          selectedMonth="2024-04"
          active={false}
        />,
      );
    });
    expect(viewport.scrollTop).toBe(0);
    expect(measure).not.toHaveBeenCalled();

    act(() => {
      view.update(
        <CalendarHeatmap data={archive} selectedMonth="2024-04" active />,
      );
    });
    expect(measure).toHaveBeenCalledOnce();
    expect(viewport.scrollTop).toBe(502);

    act(() => {
      view.update(
        <CalendarHeatmap
          data={archive}
          selectedMonth="2024-04"
          active={false}
        />,
      );
    });
    viewport.scrollTop = 0;
    act(() => {
      view.update(
        <CalendarHeatmap data={archive} selectedMonth="2024-04" active />,
      );
    });
    expect(measure).toHaveBeenCalledTimes(2);
    expect(viewport.scrollTop).toBe(502);
  });
});
