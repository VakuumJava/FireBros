const validCount = (value) => Number.isSafeInteger(value) && value >= 0;
const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

function quantile(sorted, fraction) {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const weight = index - lower;
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * weight;
}

export function buildSeasonalProfile(
  calendar,
  { selectedYear, nrtMonths = [], minYears = 3 } = {},
) {
  const requiredYears = Math.max(3, Number.isInteger(minYears) ? minYears : 3);
  const partial = new Set(nrtMonths);
  const rows = new Map();
  for (const [index, year] of (calendar?.years || []).entries()) {
    if (
      Number.isInteger(year) &&
      year >= 2000 &&
      year <= 9999 &&
      !rows.has(year)
    )
      rows.set(year, calendar.values?.[index] || []);
  }
  const columnMonths =
    calendar?.months || Array.from({ length: 12 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const column = columnMonths.indexOf(month);
    const baseline = [...rows]
      .filter(
        ([year, values]) =>
          year !== selectedYear &&
          column >= 0 &&
          !partial.has(monthKey(year, month)) &&
          validCount(values[column]),
      )
      .map(([year, values]) => ({ year, value: values[column] }));
    const values = baseline.map((point) => point.value).sort((a, b) => a - b);
    const selectedValue = rows.get(selectedYear)?.[column];
    const selected = validCount(selectedValue) ? selectedValue : null;
    const selectedPartial =
      selected !== null && partial.has(monthKey(selectedYear, month));
    const sufficient = values.length >= requiredYears;
    return {
      month,
      samples: values.length,
      baselineYears: baseline.map((point) => point.year),
      median: sufficient ? quantile(values, 0.5) : null,
      q1: sufficient ? quantile(values, 0.25) : null,
      q3: sufficient ? quantile(values, 0.75) : null,
      selected,
      selectedPartial,
      comparable: sufficient && selected !== null && !selectedPartial,
    };
  });
  const maximum = Math.max(
    1,
    ...months.flatMap((point) => [
      point.q3 || 0,
      !point.selectedPartial && point.selected !== null ? point.selected : 0,
    ]),
  );
  return {
    selectedYear,
    months,
    maximum,
    minYears: requiredYears,
    hasBaseline: months.some((point) => point.median !== null),
  };
}
