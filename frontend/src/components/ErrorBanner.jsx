export default function ErrorBanner({ states, onRetry }) {
  const messages = [
    ...new Set(
      Object.values(states)
        .filter((s) => s.error)
        .map((s) => s.error.detail || s.error.message),
    ),
  ];
  if (!messages.length) return null;
  return (
    <div className="banner banner--error" role="alert">
      <div>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
      <button type="button" className="btn btn--ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
