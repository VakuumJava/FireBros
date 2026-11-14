import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserStorage,
  MAX_SAVED_AREAS,
  normalizeAreaName,
  readSavedAreas,
  SAVED_AREAS_KEY,
  writeSavedAreas,
} from "./savedAreas";
import { normalizeSelection } from "./selectionUrl";

export function useSavedAreas() {
  const [state, setState] = useState(() => readSavedAreas(browserStorage()));
  const current = useRef(state.areas);
  current.current = state.areas;

  useEffect(() => {
    const refresh = (event) => {
      if (event.key === SAVED_AREAS_KEY || event.key === null)
        setState(readSavedAreas(browserStorage()));
    };
    window.addEventListener?.("storage", refresh);
    return () => window.removeEventListener?.("storage", refresh);
  }, []);

  const persist = useCallback((areas) => {
    const checked = writeSavedAreas(browserStorage(), areas);
    current.current = checked;
    setState({ areas: checked, error: null });
  }, []);

  const save = useCallback(
    (name, selection) => {
      if (current.current.length >= MAX_SAVED_AREAS)
        throw new Error(
          `Keep up to ${MAX_SAVED_AREAS} saved areas. Delete one before saving another.`,
        );
      const id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      persist([
        ...current.current,
        {
          id,
          name: normalizeAreaName(name),
          selection: normalizeSelection(selection),
        },
      ]);
    },
    [persist],
  );
  const remove = useCallback(
    (id) => persist(current.current.filter((area) => area.id !== id)),
    [persist],
  );
  const clear = useCallback(() => persist([]), [persist]);
  return { ...state, save, remove, clear };
}
