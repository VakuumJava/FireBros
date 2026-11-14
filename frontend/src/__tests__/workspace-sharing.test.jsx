import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialSelection } from "../api/selection";
import WorkspaceTools from "../components/WorkspaceTools";
import {
  normalizeAreaName,
  readSavedAreas,
  SAVED_AREAS_KEY,
  writeSavedAreas,
} from "../workspace/savedAreas";
import {
  areaGeoJson,
  normalizeAoi,
  normalizeSelection,
  parseGeoJson,
  readSelection,
  selectionUrl,
} from "../workspace/selectionUrl";

const selection = {
  aoi: { kind: "bbox", bbox: [73.4, 42.45, 75.4, 43.2] },
  range: { from: "2023-01", to: "2025-12" },
  month: "2025-10",
  palette: "cividis",
  view: "calendar",
};
const latest = "2026-11";
const record = { id: "saved-area-001", name: "Chüy field station", selection };
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};
let tree;
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shareable selection", () => {
  it("round-trips all selection fields without leaking unrelated URL parameters", () => {
    const url = new URL(
      selectionUrl(
        selection,
        "https://user:password@example.test/?token=secret#method",
        latest,
      ),
    );
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.get("v")).toBe("1");
    expect(readSelection(url.search, latest, url.hash)).toEqual({
      ...selection,
      explicitRange: true,
      selectionWarning: null,
    });
  });

  it("round-trips bounded polygon geometry and restores the legacy date query", () => {
    const polygon = {
      kind: "polygon",
      polygon: [
        [72, 40],
        [73, 40],
        [73, 41],
      ],
    };
    const url = new URL(
      selectionUrl(
        { ...selection, aoi: polygon },
        "https://example.test/",
        latest,
      ),
    );
    expect(initialSelection(url.search, latest, url.hash).aoi).toEqual(polygon);
    expect(
      initialSelection("?from=2000-11&to=2026-11&month=2025-10", latest),
    ).toMatchObject({
      range: { from: "2000-11", to: "2026-11" },
      month: "2025-10",
    });
  });

  it.each([
    "?v=2&bbox=73,40,74,41",
    "?bbox=NaN,40,74,41",
    "?bbox=73,40,74,41&bbox=74,40,75,41",
    "?from=2025-01&from=2024-01",
    "?to=2027-01",
    "?from=2025-10&to=2025-09",
    "?from=2025-01&to=2025-12&month=2024-01",
    "?palette=unknown",
    "?bbox=73,40,74,41&polygon=73,40;74,40;74,41",
    "?bbox=0,0,1,1",
    "?polygon=72,40;73,41;72,41;73,40",
    `?bbox=${"0".repeat(9000)}`,
  ])("falls back safely for invalid URL geometry: %s", (search) => {
    const parsed = readSelection(search, latest);
    expect(parsed.aoi).toEqual({
      kind: "bbox",
      bbox: [68.5, 38.4, 80.7, 43.7],
    });
    expect(parsed.range).toEqual({ from: "2000-01", to: latest });
    expect(parsed.selectionWarning).toContain("Showing the regional archive");
  });

  it("rejects invalid date state and unsafe share protocols", () => {
    expect(() =>
      normalizeSelection({ ...selection, month: "2030-01" }, latest),
    ).toThrow(/month/);
    expect(() =>
      selectionUrl(selection, "javascript:alert(1)", latest),
    ).toThrow(/HTTP/);
  });
});

describe("GeoJSON boundaries", () => {
  it("exports closed longitude-latitude rings and accepts one feature", () => {
    const geojson = areaGeoJson(selection.aoi);
    expect(geojson.geometry.coordinates[0]).toEqual([
      [73.4, 42.45],
      [75.4, 42.45],
      [75.4, 43.2],
      [73.4, 43.2],
      [73.4, 42.45],
    ]);
    expect(parseGeoJson(JSON.stringify(geojson))).toEqual({
      kind: "polygon",
      polygon: geojson.geometry.coordinates[0].slice(0, -1),
    });
    expect(
      parseGeoJson(
        JSON.stringify({ type: "FeatureCollection", features: [geojson] }),
      ),
    ).toEqual(parseGeoJson(JSON.stringify(geojson)));
  });

  it("rejects explicit CRS declarations at every GeoJSON level", () => {
    const crs = { type: "name", properties: { name: "EPSG:3857" } };
    const feature = areaGeoJson(selection.aoi);
    const values = [
      { ...feature, crs },
      { ...feature, geometry: { ...feature.geometry, crs } },
      { type: "FeatureCollection", crs, features: [feature] },
      { type: "FeatureCollection", features: [{ ...feature, crs }] },
      { ...feature.geometry, crs: null },
    ];
    for (const value of values)
      expect(() => parseGeoJson(JSON.stringify(value))).toThrow(/WGS84/);
  });

  it.each([
    { type: "FeatureCollection", features: [] },
    { type: "Point", coordinates: [73, 41] },
    {
      type: "Polygon",
      coordinates: [
        [
          [72, 40],
          [73, 40],
          [73, 41],
        ],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [72, 40],
          [73, 40],
          [73, 41],
          [72, 40],
        ],
        [[72.1, 40.1]],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [72, 40],
          [73, 41],
          [72, 41],
          [73, 40],
          [72, 40],
        ],
      ],
    },
  ])("rejects unsupported or invalid geometry", (geojson) => {
    expect(() => parseGeoJson(JSON.stringify(geojson))).toThrow();
  });

  it("bounds input before parsing and rejects excessive vertices", () => {
    expect(() => parseGeoJson(" ".repeat(32_769))).toThrow(/32 KB/);
    expect(() => parseGeoJson("invalid JSON")).toThrow(/valid GeoJSON/);
    expect(() =>
      normalizeAoi({ kind: "polygon", polygon: Array(102).fill([73, 41]) }),
    ).toThrow(/100/);
    expect(() =>
      normalizeAoi({ kind: "bbox", bbox: [73, 41, 73, 42] }),
    ).toThrow(/positive/);
  });
});

describe("bounded local saved areas", () => {
  it("stores only versioned, normalized records", () => {
    const storage = memoryStorage();
    writeSavedAreas(
      storage,
      [{ ...record, name: "  Chüy   field station  ", unexpected: "ignored" }],
      latest,
    );
    expect(JSON.parse(storage.getItem(SAVED_AREAS_KEY))).toEqual({
      version: 1,
      areas: [record],
    });
    expect(readSavedAreas(storage, latest)).toEqual({
      areas: [record],
      error: null,
    });
  });

  it.each([
    "not JSON",
    JSON.stringify({ version: 2, areas: [] }),
    JSON.stringify({ version: 1, areas: [record, record] }),
    JSON.stringify({ version: 1, areas: Array(13).fill(record) }),
    JSON.stringify({
      version: 1,
      areas: [
        {
          ...record,
          selection: {
            ...selection,
            aoi: { kind: "bbox", bbox: [0, 0, 1, 1] },
          },
        },
      ],
    }),
    "x".repeat(65_537),
  ])("rejects corrupt or oversized browser storage", (raw) => {
    const storage = { getItem: () => raw };
    expect(readSavedAreas(storage, latest)).toEqual({
      areas: [],
      error: expect.stringContaining("could not be read"),
    });
  });

  it("handles blocked storage, quota failures and unsafe names", () => {
    expect(readSavedAreas(null, latest).error).toContain("unavailable");
    expect(() =>
      writeSavedAreas(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        [record],
        latest,
      ),
    ).toThrow(/browser could not save/);
    expect(() => normalizeAreaName("<script>unsafe</script>")).toThrow(
      /without markup/,
    );
    expect(() => normalizeAreaName("x".repeat(61))).toThrow(/60/);
  });
});

function mountTools(storage = memoryStorage(), clipboard) {
  vi.stubGlobal("window", {
    localStorage: storage,
    location: { href: "https://example.test/" },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("navigator", { clipboard });
  const onRestore = vi.fn();
  act(() => {
    tree = create(<WorkspaceTools {...selection} onRestore={onRestore} />);
  });
  return { root: tree.root, onRestore, storage };
}
const text = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : text(child)))
    .join("");
const button = (root, label) =>
  root.findAllByType("button").find((node) => text(node) === label);

describe("workspace tools", () => {
  it("saves a named selection, reopens it and deletes it", () => {
    const { root, onRestore, storage } = mountTools();
    const name = root
      .findAllByType("input")
      .find((node) => node.props.maxLength === 60);
    act(() => name.props.onChange({ target: { value: "Valley watch" } }));
    act(() =>
      root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }),
    );
    expect(readSavedAreas(storage).areas[0].name).toBe("Valley watch");
    act(() =>
      root.findByProps({ className: "workspace-tools__open" }).props.onClick(),
    );
    expect(onRestore).toHaveBeenCalledWith(selection);
    act(() =>
      root.findByProps({ "aria-label": "Delete Valley watch" }).props.onClick(),
    );
    expect(readSavedAreas(storage).areas).toEqual([]);
  });

  it("exposes a selectable URL when clipboard access is unavailable or denied", async () => {
    const { root } = mountTools(memoryStorage(), {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    await act(async () => button(root, "Copy analysis link").props.onClick());
    const link = root
      .findAllByType("input")
      .find((node) => node.props.readOnly);
    expect(
      readSelection(new URL(link.props.value).search, latest, "#calendar").aoi,
    ).toEqual(selection.aoi);
    expect(text(root.findByProps({ role: "status" }))).toContain(
      "Clipboard unavailable",
    );
  });

  it("imports an area and rejects oversized files without reading them", async () => {
    const { root, onRestore } = mountTools();
    const upload = root.findByProps({ type: "file" });
    const read = vi
      .fn()
      .mockResolvedValue(JSON.stringify(areaGeoJson(selection.aoi)));
    await act(async () =>
      upload.props.onChange({
        target: { files: [{ size: 100, text: read }], value: "file.geojson" },
      }),
    );
    expect(onRestore).toHaveBeenCalledWith({
      ...selection,
      aoi: expect.objectContaining({ kind: "polygon" }),
    });
    const hugeRead = vi.fn();
    await act(async () =>
      upload.props.onChange({
        target: {
          files: [{ size: 40_000, text: hugeRead }],
          value: "big.geojson",
        },
      }),
    );
    expect(hugeRead).not.toHaveBeenCalled();
    expect(text(root.findByProps({ role: "alert" }))).toContain("32 KB");
  });

  it("does not apply a file that finishes reading after the selection changes", async () => {
    const { root, onRestore } = mountTools();
    let finish;
    const file = {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    let pending;
    act(() => {
      pending = root
        .findByProps({ type: "file" })
        .props.onChange({ target: { files: [file], value: "area.geojson" } });
    });
    act(() =>
      tree.update(
        <WorkspaceTools {...selection} month="2025-09" onRestore={onRestore} />,
      ),
    );
    await act(async () => {
      finish(JSON.stringify(areaGeoJson(selection.aoi)));
      await pending;
    });
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("keeps existing saved areas when the browser rejects a write", () => {
    const storage = memoryStorage();
    writeSavedAreas(storage, [record], latest);
    const { root } = mountTools(storage);
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    act(() =>
      root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }),
    );
    expect(
      root.findAllByProps({ className: "workspace-tools__open" }),
    ).toHaveLength(1);
    expect(text(root.findByProps({ role: "alert" }))).toContain(
      "could not save",
    );
  });
});
