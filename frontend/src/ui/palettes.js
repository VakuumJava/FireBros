/**
 * Perceptually uniform, colorblind-safe sequential colormaps (viridis & cividis)
 * for Ala-Too Fire Calendar heatmap cells and legend scales.
 */

export const PALETTES = {
  viridis: [
    '#440154',
    '#482878',
    '#3E4989',
    '#31688E',
    '#26828E',
    '#1F9E89',
    '#35B779',
    '#6ECE58',
    '#B5DE2B',
    '#FDE725',
  ],
  cividis: [
    '#002051',
    '#0A326A',
    '#2B446E',
    '#4D566D',
    '#696970',
    '#7F7C75',
    '#999276',
    '#B5A872',
    '#D4C068',
    '#FDEA45',
  ],
};

export const PALETTE_NAMES = Object.freeze(['viridis', 'cividis']);

function parseHex(hexColor) {
  if (typeof hexColor !== 'string') {
    return null;
  }
  const clean = hexColor.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
  }
  return null;
}

function toHex([r, g, b]) {
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = (v) => clampByte(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function relativeLuminance([r, g, b]) {
  const linearize = (channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Maps a numeric value within [min, max] to an interpolated hex color
 * from the selected colorblind-safe palette ('viridis' or 'cividis').
 * Returns null for missing observations (null, undefined, NaN) so callers
 * can apply `.cell-null-pattern` instead of confusing missing data with 0.
 *
 * @param {number|null|undefined} value
 * @param {number} min
 * @param {number} max
 * @param {'viridis'|'cividis'} [paletteName='viridis']
 * @returns {string|null}
 */
export function getHeatmapColor(value, min, max, paletteName = 'viridis') {
  if (value === null || value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const stops = PALETTES[paletteName] || PALETTES.viridis;
  const span = max - min;
  const t = span <= 0 ? (value > min ? 1 : 0) : Math.max(0, Math.min(1, (value - min) / span));

  const scaled = t * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= stops.length - 1) {
    return stops[stops.length - 1];
  }

  const c0 = parseHex(stops[idx]);
  const c1 = parseHex(stops[idx + 1]);
  return toHex([
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ]);
}

/**
 * Returns '#FFFFFF' or '#0F172A' depending on which provides higher
 * WCAG 2.1 contrast ratio against the given background hex color.
 *
 * @param {string} hexColor
 * @returns {'#FFFFFF'|'#0F172A'}
 */
export function getContrastTextColor(hexColor) {
  const rgb = parseHex(hexColor);
  if (!rgb) {
    return '#0F172A';
  }
  const lumBg = relativeLuminance(rgb);
  const lumWhite = 1.0;
  const lumDark = relativeLuminance([15, 23, 42]); // #0F172A

  const contrastWhite = (lumWhite + 0.05) / (lumBg + 0.05);
  const contrastDark = (lumBg + 0.05) / (lumDark + 0.05);

  return contrastWhite >= contrastDark ? '#FFFFFF' : '#0F172A';
}
