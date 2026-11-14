import { FIRST_YEAR } from "../api/config";

export default function PeriodSelect({ range, currentMonth, onChange }) {
  const update = (key, value) => {
    if (
      !/^\d{4}-\d{2}$/.test(value) ||
      value < `${FIRST_YEAR}-01` ||
      value > currentMonth
    )
      return;
    const next = { ...range, [key]: value };
    if (next.from > next.to) next[key === "from" ? "to" : "from"] = value;
    onChange(next);
  };
  return (
    <div className="period">
      <label>
        <span>From month</span>
        <input
          type="month"
          value={range.from}
          min={`${FIRST_YEAR}-01`}
          max={currentMonth}
          onChange={(e) => update("from", e.target.value)}
        />
      </label>
      <label>
        <span>Through month</span>
        <input
          type="month"
          value={range.to}
          min={`${FIRST_YEAR}-01`}
          max={currentMonth}
          onChange={(e) => update("to", e.target.value)}
        />
      </label>
    </div>
  );
}
