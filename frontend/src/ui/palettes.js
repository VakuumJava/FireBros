/**
 * Color-blind safe sequential palettes (viridis, cividis) and WCAG contrast helpers.
 * Zero external dependencies.
 */

export const SUPPORTED_PALETTES = ['viridis', 'cividis'];
export const NULL_HATCH_PATTERN = 'url(#null-hatch)';

/**
 * 9-stop scientific RGB/hex control points for viridis and cividis.
 */
export const PALETTES = {
  viridis: [
    '#440154',
    '#472d7b',
    '#3b528b',
    '#2c728e',
    '#21918c',
    '#28ae80',
    '#5ec962',
    '#addc30',
    '#fde725',
  ],
  cividis: [
    '#00224e',
    '#123570',
    '#3b496c',
    '#575d6d',
    '#707173',
    '#8a8678',
    '#a59c74',
    '#c3b369',
    '#fee838',
  ],
};

function parseHex(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  if (full.length !== 6) {
    return [0, 0, 0];
  }
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) {
    return [0, 0, 0];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHex(r, g, b) {
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Map a numeric value in [min, max] to a hex color in viridis or cividis.
 * Returns null for missing values (null, undefined, NaN) so callers can
 * apply .cell-null-pattern or NULL_HATCH_PATTERN without confusing null with 0.
 */
export function getHeatmapColor(value, min, max, paletteName = 'viridis') {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  const stops = PALETTES[paletteName] || PALETTES.viridis;
  if (max <= min) {
    return stops[0];
  }

  const t = Math.max(0, Math.min(1, (numeric - min) / (max - min)));
  const scaled = t * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= stops.length - 1) {
    return stops[stops.length - 1];
  }

  const [r1, g1, b1] = parseHex(stops[idx]);
  const [r2, g2, b2] = parseHex(stops[idx + 1]);

  return toHex(
    r1 + (r2 - r1) * frac,
    g1 + (g2 - g1) * frac,
    b1 + (b2 - b1) * frac
  );
}

function relativeLuminance(hexColor) {
  const [r, g, b] = parseHex(hexColor).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Choose white (#ffffff) or dark slate (#0f172a) text for WCAG AA contrast
 * over a given cell background hex color.
 */
export function getContrastTextColor(hexColor) {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
    return '#0f172a';
  }
  const lumBg = relativeLuminance(hexColor);
  const contrastWhite = 1.05 / (lumBg + 0.05);
  const contrastDark = (lumBg + 0.05) / 0.058;
  return contrastWhite >= contrastDark ? '#ffffff' : '#0f172a';
}
