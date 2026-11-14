export function chartColors(element) {
  const styles = getComputedStyle(element);
  const read = (name) => styles.getPropertyValue(name).trim();
  const harmonized = read("--secondary");
  const channels = harmonized
    .match(/[a-f\d]{2}/gi)
    ?.map((value) => parseInt(value, 16));
  return {
    text: read("--text"),
    grid: read("--rule"),
    raw: read("--accent"),
    harmonized,
    band:
      channels?.length === 3 ? `rgba(${channels.join(",")},0.15)` : harmonized,
    truth: read("--text"),
    knot: read("--border-strong"),
  };
}
