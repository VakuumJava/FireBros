export default function Card({
  title,
  hint,
  aside,
  state,
  className = "",
  hideTitle = false,
  children,
}) {
  const { data, error, loading } = state || {};
  return (
    <section className={`card ${className}`} aria-busy={Boolean(loading)}>
      <header className={hideTitle ? "visually-hidden" : "card__head"}>
        <div>
          <h2 className="card__title">{title}</h2>
          {hint && <p className="card__hint">{hint}</p>}
        </div>
        {aside}
      </header>
      {state && error && (
        <p className="card__msg card__msg--error" role="alert">
          {error.detail || error.message}
        </p>
      )}
      {state && !error && !data && (
        <div className={loading ? "card__skeleton" : "card__msg"} role="status">
          {loading
            ? "Loading observations…"
            : "No observations available for this selection."}
        </div>
      )}
      {(!state || data) && children}
    </section>
  );
}
