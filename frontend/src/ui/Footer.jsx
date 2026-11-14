// P5: заменить текст на финальный, подключить docs/limitations.md
export default function Footer() {
  return (
    <footer className="footer">
      <p>
        Данные: NASA FIRMS, MODIS / VIIRS active fire (2000–2026).{' '}
        <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">firms.modaps.eosdis.nasa.gov</a>
      </p>
      <details>
        <summary>Ограничения</summary>
        <ul>
          <li>Хотспот ≠ пожар: это 1 км² «чего-то горячего», а не подтверждённое возгорание.</li>
          <li>Облака, дым и пыль дают ложные детекции и маскируют соседние очаги.</li>
          <li>Гармонизация — оценка, а не измерение: интервал показан на графике.</li>
          <li>Текущий месяц неполный, сравнение идёт «месяц-к-дате». Свежие данные (NRT) могут дорасти.</li>
        </ul>
      </details>
    </footer>
  );
}
