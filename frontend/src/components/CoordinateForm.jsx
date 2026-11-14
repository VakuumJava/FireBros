import { useEffect, useState } from 'react';
import { REGION_BBOX } from '../api/config';

const FIELDS = [['w', 'West (W)', -180, 180], ['s', 'South (S)', -90, 90], ['e', 'East (E)', -180, 180], ['n', 'North (N)', -90, 90]];

const intersects = ([w, s, e, n], [rw, rs, re, rn]) => w < re && e > rw && s < rn && n > rs;

/** Required fallback to drawing: type the bbox by hand. A polygon is only displayed here. */
export default function CoordinateForm({ aoi, onChange }) {
  const toStrings = (a) => (a.kind === 'bbox' ? a.bbox.map(String) : ['', '', '', '']);
  const [vals, setVals] = useState(toStrings(aoi));
  const [err, setErr] = useState(null);
  useEffect(() => { setVals(toStrings(aoi)); setErr(null); }, [aoi]);

  const apply = (ev) => {
    ev.preventDefault();
    const nums = vals.map(Number);
    if (vals.some((v) => v.trim() === '') || nums.some(Number.isNaN)) return setErr('Fill in all four numbers.');
    const bad = FIELDS.find(([, , lo, hi], i) => nums[i] < lo || nums[i] > hi);
    if (bad) return setErr(`${bad[1]}: out of range.`);
    const [w, s, e, n] = nums;
    if (w >= e || s >= n) return setErr('W must be less than E, and S less than N.');
    if (!intersects(nums, REGION_BBOX)) return setErr(`Area is outside the computed region: ${REGION_BBOX.join(', ')}.`);
    setErr(null);
    onChange({ kind: 'bbox', bbox: nums });
  };

  return (
    <form className="coords" onSubmit={apply}>
      {aoi.kind === 'polygon' && <p className="coords__note">A polygon is selected ({aoi.polygon.length} vertices). Entering numbers will replace it with a rectangle.</p>}
      <div className="coords__grid">
        {FIELDS.map(([k, label], i) => (
          <label key={k}>
            <span>{label}</span>
            <input inputMode="decimal" value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value : v)))} />
          </label>
        ))}
      </div>
      {err && <p className="card__msg card__msg--error" role="alert">{err}</p>}
      <div className="row-btns">
        <button type="submit" className="btn">Apply</button>
        <button type="button" className="btn btn--ghost" onClick={() => onChange({ kind: 'bbox', bbox: [...REGION_BBOX] })}>Whole region</button>
      </div>
    </form>
  );
}
