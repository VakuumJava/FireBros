import { useEffect, useRef } from 'react';
import { chartTheme as T } from '../ui/chartTheme';
import { fmt, fmtPct, fmtRatio, pad2 } from '../ui/format';

const pctOver = (r) => `${r >= 1 ? '+' : ''}${Math.round((r - 1) * 100)}%`;

/** data = response of /aoi/harmonization. Plotly is lazy-loaded so it does not bloat the first screen */
export default function HarmonizationChart({ data }) {
  const el = useRef(null);

  useEffect(() => {
    let alive = true;
    let Plotly;
    let ro;
    const node = el.current;
    import('plotly.js-dist-min').then((mod) => {
      if (!alive) return;
      Plotly = mod.default;
      const s = data.series;
      const x = s.map((p) => `${p.year}-${pad2(p.month)}-01`);
      const traces = [
        { x, y: s.map((p) => p.hi), mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', showlegend: false },
        { x, y: s.map((p) => p.lo), mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: T.band, name: '95% interval', hoverinfo: 'skip' },
        { x, y: s.map((p) => p.raw), mode: 'lines', name: 'Raw series (before)', line: { color: T.raw, width: 1.5, dash: 'dot' }, hovertemplate: '%{x|%Y-%m}: %{y}<extra>raw</extra>' },
        { x, y: s.map((p) => p.harmonized), mode: 'lines', name: 'Harmonized (after)', line: { color: T.harmonized, width: 2 }, hovertemplate: '%{x|%Y-%m}: %{y}<extra>harmonized</extra>' },
        { x, y: s.map((p) => p.modis_truth), mode: 'markers', name: 'Actual MODIS', marker: { color: T.truth, size: 4 }, connectgaps: false, hovertemplate: '%{x|%Y-%m}: %{y}<extra>MODIS</extra>' },
      ].map((t) => ({ type: 'scatter', ...t }));
      const kx = `${data.knot_year}-01-01`;
      const layout = {
        autosize: true, height: 340, margin: { l: 54, r: 10, t: 10, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: T.text, size: 12 },
        legend: { orientation: 'h', y: -0.18 },
        xaxis: { gridcolor: T.grid }, yaxis: { gridcolor: T.grid, title: { text: 'hotspot-days / month' }, rangemode: 'tozero' },
        shapes: [{ type: 'line', x0: kx, x1: kx, yref: 'paper', y0: 0, y1: 1, line: { color: T.knot, dash: 'dash', width: 1 } }],
        annotations: [{ x: kx, yref: 'paper', y: 1, text: `${data.knot_year}: MODIS -> VIIRS`, showarrow: false, xanchor: 'left', font: { size: 11, color: T.text } }],
      };
      Plotly.react(node, traces, layout, { displaylogo: false, responsive: true });
      ro = new ResizeObserver(() => Plotly.Plots.resize(node));
      ro.observe(node);
    });
    return () => { alive = false; ro?.disconnect(); if (Plotly) Plotly.purge(node); };
  }, [data]);

  const { jump: j, validation: v } = data;
  return (
    <div className="harm">
      <div ref={el} className="harm__chart" role="img"
        aria-label={`Series before and after harmonization. Jump at ${data.knot_year}: ${fmtRatio(j.step_ratio_raw)} before, ${fmtRatio(j.step_ratio_harmonized)} after.`} />
      <div className="harm__stats">
        <dl className="stats" title={j.definition}>
          <div><dt>Jump at {data.knot_year}, raw</dt><dd>{fmtRatio(j.step_ratio_raw)} ({pctOver(j.step_ratio_raw)})</dd></div>
          <div><dt>After harmonization</dt><dd>{fmtRatio(j.step_ratio_harmonized)} ({pctOver(j.step_ratio_harmonized)})</dd></div>
          <div><dt>Control year (placebo)</dt><dd>{fmtRatio(j.step_ratio_placebo)}</dd></div>
        </dl>
        <dl className="stats">
          <div><dt>Hold-out {v.holdout_years.join('–')}, n={v.n}</dt><dd>MAPE {fmtPct(v.mape)}</dd></div>
          <div><dt>RMSE (log)</dt><dd>{v.rmse_log}</dd></div>
          <div><dt>Bias</dt><dd>{v.bias}</dd></div>
        </dl>
      </div>
      <p className="note">Target jump is x{fmt(j.target)}. Harmonization is an estimate, not a measurement; the interval is shown only after {data.knot_year}.</p>
    </div>
  );
}
