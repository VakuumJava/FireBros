import { useEffect, useState } from 'react';
import { REGION_BBOX } from '../api/config';

const FIELDS = [['w', 'Запад (W)', -180, 180], ['s', 'Юг (S)', -90, 90], ['e', 'Восток (E)', -180, 180], ['n', 'Север (N)', -90, 90]];

const intersects = ([w, s, e, n], [rw, rs, re, rn]) => w < re && e > rw && s < rn && n > rs;

/** Обязательный дубль рисования: ввод bbox руками. Полигон здесь только показывается. */
export default function CoordinateForm({ aoi, onChange }) {
  const toStrings = (a) => (a.kind === 'bbox' ? a.bbox.map(String) : ['', '', '', '']);
  const [vals, setVals] = useState(toStrings(aoi));
  const [err, setErr] = useState(null);
  useEffect(() => { setVals(toStrings(aoi)); setErr(null); }, [aoi]);

  const apply = (ev) => {
    ev.preventDefault();
    const nums = vals.map(Number);
    if (vals.some((v) => v.trim() === '') || nums.some(Number.isNaN)) return setErr('Заполните все четыре числа.');
    const bad = FIELDS.find(([, , lo, hi], i) => nums[i] < lo || nums[i] > hi);
    if (bad) return setErr(`${bad[1]}: вне диапазона.`);
    const [w, s, e, n] = nums;
    if (w >= e || s >= n) return setErr('Нужно W < E и S < N.');
    if (!intersects(nums, REGION_BBOX)) return setErr(`Область вне региона расчёта: ${REGION_BBOX.join(', ')}.`);
    setErr(null);
    onChange({ kind: 'bbox', bbox: nums });
  };

  return (
    <form className="coords" onSubmit={apply}>
      {aoi.kind === 'polygon' && <p className="coords__note">Сейчас выбран полигон ({aoi.polygon.length} вершин). Ввод чисел заменит его прямоугольником.</p>}
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
        <button type="submit" className="btn">Применить</button>
        <button type="button" className="btn btn--ghost" onClick={() => onChange({ kind: 'bbox', bbox: [...REGION_BBOX] })}>Весь регион</button>
      </div>
    </form>
  );
}
