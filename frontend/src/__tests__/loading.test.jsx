import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAoiData } from "../api/useAoiData";
import * as api from "../api/client";

vi.mock("../api/client", () => ({
  getSummary: vi.fn(),
  getCalendar: vi.fn(),
  getAnomaly: vi.fn(),
  getTop: vi.fn(),
  getHarmonization: vi.fn(),
}));

const range = { from: "2024-01", to: "2024-12" };
const first = { kind: "bbox", bbox: [69, 39, 70, 40] };
const second = { kind: "bbox", bbox: [70, 40, 71, 41] };
let tree;
afterEach(() => {
  act(() => tree?.unmount());
  vi.resetAllMocks();
});

describe("request ownership", () => {
  it("ignores a late response from the previous AOI", async () => {
    const pending = [];
    for (const method of Object.values(api))
      method.mockImplementation(
        () => new Promise((resolve) => pending.push(resolve)),
      );
    let latest;
    function Probe({ aoi }) {
      latest = useAoiData(aoi, range, "2024-10");
      return null;
    }
    act(() => {
      tree = create(<Probe aoi={first} />);
    });
    act(() => tree.update(<Probe aoi={second} />));
    await act(async () => {
      for (const resolve of pending.slice(0, 5)) resolve({ area: "old" });
    });
    expect(latest.summary.data).toBeNull();
    expect(latest.summary.loading).toBe(true);
    await act(async () => {
      for (const resolve of pending.slice(5)) resolve({ area: "new" });
    });
    expect(latest.summary.data).toEqual({ area: "new" });
  });

  it("updates only the anomaly when the selected month changes", async () => {
    for (const method of Object.values(api))
      method.mockResolvedValue({ ok: true });
    function Probe({ month }) {
      useAoiData(first, range, month);
      return null;
    }
    await act(async () => {
      tree = create(<Probe month="2024-09" />);
    });
    await act(async () => tree.update(<Probe month="2024-10" />));
    expect(api.getAnomaly).toHaveBeenCalledTimes(2);
    expect(api.getSummary).toHaveBeenCalledTimes(1);
    expect(api.getCalendar).toHaveBeenCalledTimes(1);
    expect(api.getHarmonization).toHaveBeenCalledTimes(1);
  });
});
