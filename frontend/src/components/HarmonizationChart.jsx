import { useEffect, useRef } from 'react';
import { chartTheme as T } from '../ui/chartTheme';
import { fmt, fmtPct, fmtRatio, pad2 } from '../ui/format';

const pctOver = (r) => `${r >= 1 ? '+' : ''}${Math.round((r - 1) * 100)}%`;

/** data = ответ /aoi/harmonization. Plotly подгружается лениво — не раздувает первый экран */
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
        { x, y: s.map((p) => p.lo), mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: T.band, name: 'Интервал 95%', hoverinfo: 'skip' },
        { x, y: s.map((p) => p.raw), mode: 'lines', name: 'Сырой ряд (до)', line: { color: T.raw, width: 1.5, dash: 'dot' }, hovertemplate: '%{x|%Y-%m}: %{y}<extra>сырой</extra>' },
        { x, y: s.map((p) => p.harmonized), mode: 'lines', name: 'Гармонизированный (после)', line: { color: T.harmonized, width: 2 }, hovertemplate: '%{x|%Y-%m}: %{y}<extra>гармонизир.</extra>' },
        { x, y: s.map((p) => p.modis_truth), mode: 'markers', name: 'Настоящий MODIS', marker: { color: T.truth, size: 4 }, connectgaps: false, hovertemplate: '%{x|%Y-%m}: %{y}<extra>MODIS</extra>' },
      ].map((t) => ({ type: 'scatter', ...t }));
      const kx = `${data.knot_year}-01-01`;
      const layout = {
        autosize: true, height: 340, margin: { l: 54, r: 10, t: 10, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: T.text, size: 12 },
        legend: { orientation: 'h', y: -0.18 },
        xaxis: { gridcolor: T.grid }, yaxis: { gridcolor: T.grid, title: { text: 'хотспот-дни / мес' }, rangemode: 'tozero' },
        shapes: [{ type: 'line', x0: kx, x1: kx, yref: 'paper', y0: 0, y1: 1, line: { color: T.knot, dash: 'dash', width: 1 } }],
        annotations: [{ x: kx, yref: 'paper', y: 1, text: `${data.knot_year}: MODIS → VIIRS`, showarrow: false, xanchor: 'left', font: { size: 11, color: T.text } }],
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
        aria-label={`Ряд до и после гармонизации. Скачок на ${data.knot_year}: ${fmtRatio(j.step_ratio_raw)} до, ${fmtRatio(j.step_ratio_harmonized)} после.`} />
      <div className="harm__stats">
        <dl className="stats" title={j.definition}>
          <div><dt>Скачок на {data.knot_year}, сырой</dt><dd>{fmtRatio(j.step_ratio_raw)} ({pctOver(j.step_ratio_raw)})</dd></div>
          <div><dt>После гармонизации</dt><dd>{fmtRatio(j.step_ratio_harmonized)} ({pctOver(j.step_ratio_harmonized)})</dd></div>
          <div><dt>Контрольный год (плацебо)</dt><dd>{fmtRatio(j.step_ratio_placebo)}</dd></div>
        </dl>
        <dl className="stats">
          <div><dt>Hold-out {v.holdout_years.join('–')}, n={v.n}</dt><dd>MAPE {fmtPct(v.mape)}</dd></div>
          <div><dt>RMSE (log)</dt><dd>{v.rmse_log}</dd></div>
          <div><dt>Смещение</dt><dd>{v.bias}</dd></div>
        </dl>
      </div>
      <p className="note">Цель скачка — ×{fmt(j.target)}. Гармонизация — оценка, не измерение; интервал только после {data.knot_year}.</p>
    </div>
  );
}
