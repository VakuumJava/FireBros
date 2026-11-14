const validValue = (value) => Number.isFinite(value) && value >= 0;
const completeValue = (point) =>
  !point?.selectedPartial && validValue(point?.selected);
const validBand = (point) =>
  validValue(point?.q1) && validValue(point?.q3) && point.q1 <= point.q3;
const coordinate = (value) => Number(value.toFixed(2));

function axisDomain(maximum) {
  if (maximum === 0) return { max: 1, intervals: 4 };
  const target = maximum * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const candidates = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2]
    .flatMap((factor) =>
      [4, 5].map((intervals) => ({
        intervals,
        max: magnitude * factor * intervals,
      })),
    )
    .filter(
      (candidate) => Number.isFinite(candidate.max) && candidate.max >= target,
    )
    .sort(
      (a, b) =>
        a.max / maximum +
        Math.abs(a.intervals - 5) * 0.03 -
        (b.max / maximum + Math.abs(b.intervals - 5) * 0.03),
    );
  return candidates[0] || { max: maximum, intervals: 4 };
}

function segments(points, includes) {
  const result = [];
  let current = [];
  points.forEach((point, index) => {
    if (includes(point)) current.push({ point, index });
    else if (current.length) {
      result.push(current);
      current = [];
    }
  });
  if (current.length) result.push(current);
  return result;
}

export function makeSeasonalChart(months, width = 840, height = 280) {
  const points = Array.isArray(months) ? months : [];
  const chartWidth = Math.max(280, Number.isFinite(width) ? width : 840);
  const chartHeight = Math.max(180, Number.isFinite(height) ? height : 280);
  const plot = {
    left: 56,
    right: chartWidth - 28,
    top: 24,
    bottom: chartHeight - 36,
  };
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;
  const values = points.flatMap((point) => [
    ...(validValue(point?.median) ? [point.median] : []),
    ...(validBand(point) ? [point.q3] : []),
    ...(completeValue(point) ? [point.selected] : []),
  ]);
  const maximum = values.reduce((max, value) => Math.max(max, value), 0);
  const domain = axisDomain(maximum);
  const count = Math.max(2, points.length);
  const x = (index) =>
    plot.left +
    (Math.max(0, Math.min(count - 1, Number.isFinite(index) ? index : 0)) /
      (count - 1)) *
      plot.width;
  const y = (value) =>
    plot.bottom -
    (validValue(value) ? Math.min(value / domain.max, 1) : 0) * plot.height;
  const position = (index, value) =>
    `${coordinate(x(index))},${coordinate(y(value))}`;
  const line = (includes, read) =>
    segments(points, includes)
      .map((segment) =>
        segment
          .map(
            ({ point, index }, i) =>
              `${i === 0 ? "M" : "L"}${position(index, read(point))}`,
          )
          .join(" "),
      )
      .join(" ");
  const bandPath = segments(points, validBand)
    .map((segment) => {
      if (segment.length === 1) {
        const { point, index } = segment[0];
        const halfWidth = Math.min(6, plot.width / (count - 1) / 3);
        const left = coordinate(Math.max(plot.left, x(index) - halfWidth));
        const right = coordinate(Math.min(plot.right, x(index) + halfWidth));
        const top = coordinate(y(point.q3));
        const bottom = coordinate(y(point.q1));
        return `M${left},${top} L${right},${top} L${right},${bottom} L${left},${bottom} Z`;
      }
      const upper = segment.map(
        ({ point, index }, i) =>
          `${i === 0 ? "M" : "L"}${position(index, point.q3)}`,
      );
      const lower = [...segment]
        .reverse()
        .map(({ point, index }) => `L${position(index, point.q1)}`);
      return [...upper, ...lower, "Z"].join(" ");
    })
    .join(" ");
  const ticks = Array.from({ length: domain.intervals + 1 }, (_, index) => {
    const value = domain.max * (index / domain.intervals);
    return { value, y: y(value) };
  });

  return {
    width: chartWidth,
    height: chartHeight,
    plot,
    ticks,
    x,
    y,
    medianPath: line(
      (point) => validValue(point?.median),
      (point) => point.median,
    ),
    selectedPath: line(completeValue, (point) => point.selected),
    bandPath,
    max: domain.max,
  };
}
