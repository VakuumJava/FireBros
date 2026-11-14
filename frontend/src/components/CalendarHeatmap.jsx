import { useMemo, useRef, useState } from 'react';
import { colorAt, rgbAt, textOn, gradientCss } from '../ui/palettes';
import { MONTHS_SHORT, MONTHS_FULL, fmt, fmtCompact, pad2 } from '../ui/format';

/**
 * Year x month calendar. data = response of /aoi/calendar.
 * Contract rules: null != 0 (null is hatched), scale = data.max (never recompute), keyboard: arrows/Home/End.
 */
export default function CalendarHeatmap({ data, palette = 'viridis', nrtMonths = [] }) {
  const { years, values, max, unit } = data;
  const nrt = useMemo(() => new Set(nrtMonths), [nrtMonths]);
  const cells = useRef({});
  const [focus, setFocus] = useState({ r: years.length - 1, c: 0 });
  const [active, setActive] = useState(null);

  const fr = Math.min(focus.r, years.length - 1);
  const shown = active ? { r: Math.min(active.r, years.length - 1), c: active.c } : null;

  const move = (r, c) => {
    const nr = Math.max(0, Math.min(years.length - 1, r));
    const nc = Math.max(0, Math.min(11, c));
    setFocus({ r: nr, c: nc });
    setActive({ r: nr, c: nc });
    cells.current[`${nr}-${nc}`]?.focus();
  };
  const onKey = (e, r, c) => {
    const d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
    if (d) { e.preventDefault(); move(r + d[0], c + d[1]); }
    else if (e.key === 'Home') { e.preventDefault(); move(r, 0); }
    else if (e.key === 'End') { e.preventDefault(); move(r, 11); }
  };

  const readout = (() => {
    if (!shown) return 'Hover a cell or move with the arrow keys.';
    const v = values[shown.r][shown.c];
    const key = `${years[shown.r]}-${pad2(shown.c + 1)}`;
    return `${years[shown.r]}, ${MONTHS_FULL[shown.c]}: ${v === null ? 'no data' : `${fmt(v)} hotspot-days`}${nrt.has(key) ? ' - incomplete data (NRT)' : ''}`;
  })();

  return (
    <div className="cal">
      <div className="cal__grid" role="grid" aria-label={`Activity calendar, ${unit}`}>
        <div className="cal__row cal__row--head" role="row">
          <span />
          {MONTHS_SHORT.map((m) => <span key={m} role="columnheader" className="cal__colhead">{m}</span>)}
        </div>
        {years.map((y, r) => (
          <div className="cal__row" role="row" key={y}>
            <span role="rowheader" className="cal__rowhead">{y}</span>
            {values[r].map((v, c) => {
              const key = `${y}-${pad2(c + 1)}`;
              const isNrt = nrt.has(key);
              const rgb = v === null ? null : rgbAt(palette, max > 0 ? v / max : 0);
              const style = rgb ? { background: `rgb(${rgb.join(',')})`, color: textOn(rgb) } : undefined;
              return (
                <div
                  key={c}
                  role="gridcell"
                  ref={(node) => { cells.current[`${r}-${c}`] = node; }}
                  tabIndex={r === fr && c === focus.c ? 0 : -1}
                  className={`cal__cell ${v === null ? 'cal__cell--null' : ''} ${isNrt ? 'cal__cell--nrt' : ''}`}
                  style={style}
                  aria-label={`${y}, ${MONTHS_FULL[c]}: ${v === null ? 'no data' : `${fmt(v)} hotspot-days`}${isNrt ? ', incomplete data' : ''}`}
                  onKeyDown={(e) => onKey(e, r, c)}
                  onFocus={() => { setFocus({ r, c }); setActive({ r, c }); }}
                  onMouseEnter={() => setActive({ r, c })}
                  onMouseLeave={() => setActive(null)}
                >
                  {v === null ? '' : fmtCompact(v)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="cal__readout" aria-live="polite">{readout}</p>

      <div className="legend">
        <span className="legend__bar" style={{ background: gradientCss(palette) }} />
        <div className="legend__ticks">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t}>{fmt(Math.round(max * t))}</span>)}
        </div>
        <p className="legend__cap">
          {unit === 'hotspot_days_1km' ? 'hotspot-days, 1 km' : unit} - scale 0-{fmt(max)} set by the server
        </p>
        <p className="legend__keys">
          <span className="cal__cell cal__cell--null legend__swatch" /> no data (not zero)
          <span className="cal__cell cal__cell--nrt legend__swatch" style={{ background: colorAt(palette, 0.5) }} /> incomplete month (NRT)
        </p>
      </div>
    </div>
  );
}
