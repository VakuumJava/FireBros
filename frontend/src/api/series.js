export function withMonthlyGaps(series) {
  if (!series.length) return [];
  const index = (point) => point.year * 12 + point.month - 1;
  const ordered = [...series].sort((a, b) => index(a) - index(b));
  const byMonth = new Map(ordered.map((point) => [index(point), point]));
  const result = [];
  for (let month = index(ordered[0]); month <= index(ordered.at(-1)); month++) {
    result.push(
      byMonth.get(month) || {
        year: Math.floor(month / 12),
        month: (month % 12) + 1,
        raw: null,
        harmonized: null,
        lo: null,
        hi: null,
        modis_truth: null,
      },
    );
  }
  return result;
}
