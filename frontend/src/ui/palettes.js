/**
 * Perceptually uniform, colorblind-safe sequential colormaps (viridis & cividis)
 * for Ala-Too Fire Calendar heatmap cells and legend scales.
 *
 * Compatible with both P4 component imports (PALETTES, PALETTE_LABELS, rgbAt,
 * colorAt, textOn, gradientCss) and P5 UI helpers (PALETTE_NAMES,
 * getHeatmapColor, getContrastTextColor).
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

export const PALETTE_LABELS = {
  viridis: 'Viridis',
  cividis: 'Cividis',
};

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
 * Interpolates [r, g, b] (0..255 integers) at normalized position t in [0..1]
 * for the given palette ('viridis' or 'cividis').
 *
 * @param {'viridis'|'cividis'} name
 * @param {number} t
 * @returns {[number, number, number]}
 */
export function rgbAt(name, t) {
  const stops = PALETTES[name] || PALETTES.viridis;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const x = clamped * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = parseHex(stops[i]);
  const b = parseHex(stops[i + 1]);
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * Returns an `rgb(r,g,b)` CSS color string at normalized position t in [0..1].
 *
 * @param {'viridis'|'cividis'} name
 * @param {number} t
 * @returns {string}
 */
export const colorAt = (name, t) => `rgb(${rgbAt(name, t).join(',')})`;

/**
 * Readable text color on top of an [r, g, b] tuple or hex color string.
 *
 * @param {[number, number, number]|string} color
 * @returns {string}
 */
export function textOn(color) {
  if (typeof color === 'string') {
    return getContrastTextColor(color);
  }
  if (Array.isArray(color) && color.length >= 3) {
    const [r, g, b] = color;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? '#111' : '#fff';
  }
  return '#fff';
}

/**
 * Builds a horizontal CSS linear-gradient string sampling `steps` points
 * from the given palette ('viridis' or 'cividis').
 *
 * @param {'viridis'|'cividis'} name
 * @param {number} [steps=12]
 * @returns {string}
 */
export const gradientCss = (name, steps = 12) =>
  `linear-gradient(to right, ${Array.from({ length: steps }, (_, i) =>
    colorAt(name, i / (steps - 1))
  ).join(', ')})`;

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

  const span = max - min;
  const t = span <= 0 ? (value > min ? 1 : 0) : Math.max(0, Math.min(1, (value - min) / span));
  return toHex(rgbAt(paletteName, t));
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
