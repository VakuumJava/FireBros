// P5: replace with the final text, link docs/limitations.md
export default function Footer() {
  return (
    <footer className="footer">
      <p>
        Data: NASA FIRMS, MODIS / VIIRS active fire (2000-2026).{' '}
        <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">firms.modaps.eosdis.nasa.gov</a>
      </p>
      <details>
        <summary>Limitations</summary>
        <ul>
          <li>A hotspot is not a fire: it is 1 km2 of "something hot", not a confirmed burn.</li>
          <li>Clouds, smoke and dust cause false detections and can mask neighbouring fires.</li>
          <li>Harmonization is an estimate, not a measurement: the interval is shown on the chart.</li>
          <li>The current month is incomplete, so it is compared month-to-date. Fresh (NRT) data may still grow.</li>
        </ul>
      </details>
    </footer>
  );
}
