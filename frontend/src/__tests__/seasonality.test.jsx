import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSeasonalProfile } from "../analysis/seasonality";
import SeasonalProfile from "../components/SeasonalProfile";

const calendar = (years, january) => ({
  years,
  months: Array.from({ length: 12 }, (_, i) => i + 1),
  values: january.map((value) => [value, ...Array(11).fill(null)]),
});

let view;
afterEach(() => act(() => view?.unmount()));

describe("seasonal baseline", () => {
  it("keeps observed zeros, excludes selected year and partial source months", () => {
    const data = calendar(
      [2020, 2021, 2022, 2023, 2024],
      [0, 10, 20, 900, 1000],
    );
    const profile = buildSeasonalProfile(data, {
      selectedYear: 2024,
      nrtMonths: ["2023-01"],
    });
    expect(profile.months[0]).toMatchObject({
      samples: 3,
      baselineYears: [2020, 2021, 2022],
      q1: 5,
      median: 10,
      q3: 15,
      selected: 1000,
      comparable: true,
    });
    expect(profile.maximum).toBe(1000);
    expect(profile.months[1]).toMatchObject({
      samples: 0,
      median: null,
      selected: null,
    });
  });

  it("does not treat missing, negative or nonfinite counts as an observed zero", () => {
    const data = calendar(
      [2020, 2021, 2022, 2023, 2024, 2025],
      [null, Infinity, -1, NaN, 0, 9],
    );
    const result = buildSeasonalProfile(data, {
      selectedYear: 2025,
      minYears: 1,
    });
    expect(result.months[0]).toMatchObject({
      samples: 1,
      median: null,
      selected: 9,
      comparable: false,
    });
    expect(result.minYears).toBe(3);
    expect(result.hasBaseline).toBe(false);
  });

  it("reports partial selected months separately and excludes them from the chart scale", () => {
    const data = calendar([2020, 2021, 2022, 2023], [0, 0, 0, 10000]);
    const result = buildSeasonalProfile(data, {
      selectedYear: 2023,
      nrtMonths: ["2023-01"],
    });
    expect(result.months[0]).toMatchObject({
      median: 0,
      q1: 0,
      q3: 0,
      selected: 10000,
      selectedPartial: true,
      comparable: false,
    });
    expect(result.maximum).toBe(1);
  });

  it("honours explicit month order and does not count a repeated year twice", () => {
    const data = {
      years: [2020, 2021, 2021, 2022, 2023],
      months: [2, 1],
      values: [
        [4, 10],
        [8, 20],
        [800, 900],
        [12, 30],
        [16, 40],
      ],
    };
    const result = buildSeasonalProfile(data, { selectedYear: 2023 });
    expect(result.months[0].median).toBe(20);
    expect(result.months[1].median).toBe(8);
    expect(result.months[0].samples).toBe(3);
  });
});

it("offers only available selected-year months and labels partial data in the table", () => {
  const data = calendar([2020, 2021, 2022, 2023], [0, 10, 20, 8]);
  const onSelect = vi.fn();
  act(() => {
    view = create(
      <SeasonalProfile
        data={data}
        selectedMonth="2023-01"
        nrtMonths={["2023-01"]}
        onSelect={onSelect}
      />,
    );
  });
  const buttons = view.root.findAllByType("button");
  expect(buttons).toHaveLength(12);
  expect(buttons[0].props.disabled).toBe(false);
  expect(buttons[1].props.disabled).toBe(true);
  expect(buttons[0].props["aria-label"]).toContain("incomplete month");
  act(() => buttons[0].props.onClick());
  expect(onSelect).toHaveBeenCalledWith("2023-01");
  expect(view.root.findAllByType("circle")).toHaveLength(0);
  expect(
    view.root
      .findAllByType("td")
      .some((cell) => cell.children.includes("Partial: 8")),
  ).toBe(true);
  expect(
    view.root
      .findAllByType("td")
      .some((cell) => cell.children.includes("No data")),
  ).toBe(true);
});
