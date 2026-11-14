import { act, create } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { useSectionNavigation } from "../ui/useSectionNavigation";

let tree;
afterEach(() => {
  act(() => tree?.unmount());
  vi.unstubAllGlobals();
});

function mount(hash = "") {
  const listeners = new Map();
  const window = {
    location: { hash, pathname: "/", search: "?month=2025-10" },
    history: { replaceState: vi.fn() },
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
  };
  vi.stubGlobal("window", window);
  let navigation;
  function Probe() {
    navigation = useSectionNavigation();
    return null;
  }
  act(() => {
    tree = create(<Probe />);
  });
  return {
    get navigation() {
      return navigation;
    },
    window,
    listeners,
  };
}

it("selects views without dropping the current page query", () => {
  const state = mount();
  expect(state.navigation.active).toBe("explore");
  act(() => state.navigation.select("calendar"));
  expect(state.navigation.active).toBe("calendar");
  expect(state.window.history.replaceState).toHaveBeenCalledWith(
    null,
    "",
    "/?month=2025-10#calendar",
  );
  act(() => state.navigation.select("invalid"));
  expect(state.navigation.active).toBe("calendar");
});

it("restores bookmarked views and responds to hash navigation", () => {
  const state = mount("#method");
  expect(state.navigation.active).toBe("method");
  state.window.location.hash = "#export";
  act(() => state.listeners.get("hashchange")());
  expect(state.navigation.active).toBe("export");
  state.window.location.hash = "#missing";
  act(() => state.listeners.get("hashchange")());
  expect(state.navigation.active).toBe("explore");
  act(() => tree.unmount());
  expect(state.listeners.size).toBe(0);
});
