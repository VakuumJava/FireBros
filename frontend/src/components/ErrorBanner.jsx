// Merges identical errors from different blocks into one banner (a 422 "outside region" arrives from all five endpoints)
export default function ErrorBanner({ states }) {
  const msgs = [...new Set(Object.values(states).filter((s) => s.error).map((s) => s.error.detail || s.error.message))];
  if (!msgs.length) return null;
  return <div className="banner banner--error" role="alert">{msgs.map((m) => <p key={m}>{m}</p>)}</div>;
}
