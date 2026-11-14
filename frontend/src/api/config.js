// Константы, согласованные с README / contracts. Менять только вместе с P1.
export const REGION_BBOX = [68.5, 38.4, 80.7, 43.7]; // [W, S, E, N] — регион предрасчёта
export const FIRST_YEAR = 2000;
export const KNOT_YEAR = 2012; // стык MODIS -> VIIRS

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const DEFAULT_AOI = { kind: 'bbox', bbox: [...REGION_BBOX] };
// AOI = { kind:'bbox', bbox:[w,s,e,n] } | { kind:'polygon', polygon:[[lon,lat],...] }
