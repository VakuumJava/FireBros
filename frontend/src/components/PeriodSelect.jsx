import { FIRST_YEAR } from '../api/config';

export default function PeriodSelect({ yearFrom, yearTo, lastYear, onChange }) {
  const years = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  return (
    <div className="period">
      <label>
        <span>From year</span>
        <select value={yearFrom} onChange={(e) => onChange(Math.min(+e.target.value, yearTo), yearTo)}>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
      </label>
      <label>
        <span>To year</span>
        <select value={yearTo} onChange={(e) => onChange(yearFrom, Math.max(+e.target.value, yearFrom))}>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
      </label>
    </div>
  );
}
