// Sequential, colour-blind-safe scales (viridis / cividis anchor points, linear RGB interpolation).
export const PALETTES = {
  viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#fde725'],
  cividis: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838'],
};
export const PALETTE_LABELS = { viridis: 'Viridis', cividis: 'Cividis' };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** t in [0..1] -> [r,g,b] */
export function rgbAt(name, t) {
  const stops = PALETTES[name] || PALETTES.viridis;
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = hex(stops[i]);
  const b = hex(stops[i + 1]);
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

export const colorAt = (name, t) => `rgb(${rgbAt(name, t).join(',')})`;

/** Readable text colour on top of a fill */
export function textOn([r, g, b]) {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}

export const gradientCss = (name, steps = 12) =>
  `linear-gradient(to right, ${Array.from({ length: steps }, (_, i) => colorAt(name, i / (steps - 1))).join(', ')})`;
