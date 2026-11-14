export default function StatusBadge({ meta, loading }) {
  if (!meta)
    return (
      <span className="badge" role="status">
        {loading ? "Checking data source…" : "Data source unavailable"}
      </span>
    );
  if (meta.source === "mock")
    return (
      <span className="badge badge--mock" role="status">
        MOCK · demo data, not measurements
      </span>
    );
  return (
    <span className="badge" role="status">
      {meta.source} · {meta.method_version}
    </span>
  );
}
