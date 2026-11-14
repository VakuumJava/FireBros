// Contract rule 5: mock data must never be passed off as measurements.
export default function StatusBadge({ meta }) {
  if (!meta) return null;
  if (meta.source === 'mock') {
    return <span className="badge badge--mock" role="status">MOCK - demo data, not measurements</span>;
  }
  return <span className="badge">data: {meta.source} - {meta.method_version}</span>;
}
