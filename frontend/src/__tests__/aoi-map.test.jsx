import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AoiMap from "../components/AoiMap";

const leaflet = vi.hoisted(() => ({
  map: vi.fn(),
  tileLayer: vi.fn(),
  rectangle: vi.fn(),
  polygon: vi.fn(),
  featureGroup: vi.fn(),
  Draw: { Event: { CREATED: "draw:created", DRAWSTOP: "draw:drawstop" } },
}));
vi.mock("../components/leafletSetup", () => ({ default: leaflet }));
vi.mock("leaflet-draw", () => ({}));

const first = { kind: "bbox", bbox: [73, 42, 74, 43] };
const second = { kind: "bbox", bbox: [75, 41, 77, 42] };
let view;
let container;
let instance;
let resize;
let disconnect;

beforeEach(() => {
  vi.clearAllMocks();
  container = { clientWidth: 0 };
  instance = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  };
  leaflet.map.mockReturnValue(instance);
  leaflet.tileLayer.mockReturnValue({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  });
  const layer = (bounds) => ({
    getBounds: () => bounds,
    addTo: vi.fn().mockReturnThis(),
  });
  leaflet.rectangle.mockImplementation(layer);
  leaflet.polygon.mockImplementation(layer);
  let layers = [];
  leaflet.featureGroup.mockReturnValue({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: () => {
      layers = [];
    },
    addLayer: (value) => layers.push(value),
    getLayers: () => layers,
    getBounds: () => layers[0]?.getBounds(),
  });
  disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: () => "#245c54",
  }));
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  vi.unstubAllGlobals();
});

function mount(aoi = first) {
  act(() => {
    view = create(<AoiMap aoi={aoi} onChange={vi.fn()} />, {
      createNodeMock: (element) =>
        element.props.className === "aoi-map atlas-map__canvas"
          ? container
          : null,
    });
  });
}

describe("collapsed mobile area editor", () => {
  it("starts with a finite view and waits for visible dimensions before fitting the area", () => {
    mount();
    const [center, zoom] = instance.setView.mock.calls[0];
    expect(center.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(zoom)).toBe(true);
    expect(instance.fitBounds).not.toHaveBeenCalled();
    act(() => resize());
    expect(instance.invalidateSize).toHaveBeenCalledOnce();
    expect(instance.fitBounds).not.toHaveBeenCalled();

    container.clientWidth = 600;
    act(() => resize());
    expect(instance.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [
        [42, 73],
        [43, 74],
      ],
      { animate: false, padding: [30, 30], maxZoom: 10 },
    );
    act(() => resize());
    expect(instance.fitBounds).toHaveBeenCalledOnce();
  });

  it("fits the latest selection after a hidden update and releases the observer on unmount", () => {
    mount();
    act(() => view.update(<AoiMap aoi={second} onChange={vi.fn()} />));
    expect(instance.fitBounds).not.toHaveBeenCalled();
    container.clientWidth = 600;
    act(() => resize());
    expect(instance.fitBounds).toHaveBeenCalledExactlyOnceWith(
      [
        [41, 75],
        [42, 77],
      ],
      { animate: false, padding: [30, 30], maxZoom: 10 },
    );
    act(() => view.unmount());
    view = undefined;
    expect(disconnect).toHaveBeenCalledOnce();
    expect(instance.remove).toHaveBeenCalledOnce();
  });
});
