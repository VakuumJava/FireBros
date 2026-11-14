import { PALETTE_LABELS, gradientCss } from '../ui/palettes';

export default function PaletteSwitch({ palettes, value, onChange }) {
  return (
    <div className="palette-switch" role="radiogroup" aria-label="Colour scale">
      {palettes.map((p) => (
        <button key={p} type="button" role="radio" aria-checked={p === value}
          className={`palette-switch__btn ${p === value ? 'is-on' : ''}`} onClick={() => onChange(p)}>
          <span className="palette-switch__sw" style={{ background: gradientCss(p, 6) }} />
          {PALETTE_LABELS[p] || p}
        </button>
      ))}
    </div>
  );
}
