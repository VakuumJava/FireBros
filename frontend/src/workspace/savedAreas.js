import { normalizeSelection } from "./selectionUrl";

export const SAVED_AREAS_KEY = "firebros.saved-areas.v1";
export const MAX_SAVED_AREAS = 12;
const MAX_STORAGE_LENGTH = 65_536;
const validId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{8,80}$/.test(value);

export function normalizeAreaName(value) {
  if (typeof value !== "string") throw new Error("Give this area a name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f<>]/.test(name))
    throw new Error("Use a name of 1 to 60 characters without markup.");
  return name;
}

export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedAreas(storage, latest) {
  if (!storage)
    return { areas: [], error: "Saved areas are unavailable in this browser." };
  try {
    const raw = storage.getItem(SAVED_AREAS_KEY);
    if (raw === null) return { areas: [], error: null };
    if (typeof raw !== "string" || raw.length > MAX_STORAGE_LENGTH)
      throw new Error();
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.areas) ||
      value.areas.length > MAX_SAVED_AREAS
    )
      throw new Error();
    const ids = new Set();
    const areas = value.areas.map((area) => {
      if (!validId(area?.id) || ids.has(area.id)) throw new Error();
      ids.add(area.id);
      return {
        id: area.id,
        name: normalizeAreaName(area.name),
        selection: normalizeSelection(area.selection, latest),
      };
    });
    return { areas, error: null };
  } catch {
    return {
      areas: [],
      error: "Saved areas could not be read. Clear them to start again.",
    };
  }
}

export function writeSavedAreas(storage, areas, latest) {
  if (!storage) throw new Error("Saved areas are unavailable in this browser.");
  if (!Array.isArray(areas) || areas.length > MAX_SAVED_AREAS)
    throw new Error(
      `Keep up to ${MAX_SAVED_AREAS} saved areas. Delete one before saving another.`,
    );
  const ids = new Set();
  const checked = areas.map((area) => {
    if (!validId(area?.id) || ids.has(area.id))
      throw new Error("This saved area is invalid.");
    ids.add(area.id);
    return {
      id: area.id,
      name: normalizeAreaName(area.name),
      selection: normalizeSelection(area.selection, latest),
    };
  });
  const raw = JSON.stringify({ version: 1, areas: checked });
  if (raw.length > MAX_STORAGE_LENGTH)
    throw new Error(
      "Saved areas are too large. Delete one before saving another.",
    );
  try {
    storage.setItem(SAVED_AREAS_KEY, raw);
  } catch {
    throw new Error(
      "The browser could not save this area. Check storage permissions or free some space.",
    );
  }
  return checked;
}
