import { REGION_BBOX } from "./config";

export const AREA_PRESETS = [
  { name: "Chüy Valley", bbox: [73.4, 42.45, 75.4, 43.2] },
  { name: "Issyk-Kul", bbox: [76, 41.7, 78.8, 42.8] },
  { name: "Osh", bbox: [72.4, 39.9, 73.3, 40.9] },
];

const matches = (first, second) =>
  first.every((value, index) => value === second[index]);

export function areaLabel(aoi) {
  if (aoi.kind === "polygon") return "Custom polygon";
  if (matches(aoi.bbox, REGION_BBOX)) return "Regional archive";
  return (
    AREA_PRESETS.find((preset) => matches(aoi.bbox, preset.bbox))?.name ||
    "Custom area"
  );
}
