// Сводит одинаковые ошибки разных блоков в одну плашку (422 «вне региона» придёт сразу от пяти эндпоинтов)
export default function ErrorBanner({ states }) {
  const msgs = [...new Set(Object.values(states).filter((s) => s.error).map((s) => s.error.detail || s.error.message))];
  if (!msgs.length) return null;
  return <div className="banner banner--error" role="alert">{msgs.map((m) => <p key={m}>{m}</p>)}</div>;
}
