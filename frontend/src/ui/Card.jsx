// Обёртка блока: заголовок + состояния загрузки/ошибки. Props: state = { data, error, loading }
export default function Card({ title, hint, aside, state, className = '', children }) {
  const { data, error, loading } = state || {};
  return (
    <section className={`card ${className}`} aria-busy={loading ? 'true' : 'false'}>
      <header className="card__head">
        <div>
          <h2 className="card__title">{title}</h2>
          {hint && <p className="card__hint">{hint}</p>}
        </div>
        {aside}
      </header>
      {error && <p className="card__msg card__msg--error" role="alert">{error.detail || error.message}</p>}
      {!error && !data && <p className="card__msg">{loading ? 'Загрузка…' : 'Нет данных'}</p>}
      {data && <div className={loading ? 'is-stale' : ''}>{children}</div>}
    </section>
  );
}
