// Контракт, правило 5: мок никогда не выдаётся за измерение.
export default function StatusBadge({ meta }) {
  if (!meta) return null;
  if (meta.source === 'mock') {
    return <span className="badge badge--mock" role="status">MOCK · демонстрационные данные, не измерения</span>;
  }
  return <span className="badge">данные: {meta.source} · {meta.method_version}</span>;
}
