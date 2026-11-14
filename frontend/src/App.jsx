import { useMemo, useState } from 'react';
import { DEFAULT_AOI, FIRST_YEAR } from './api/config';
import { useAoiData } from './api/useAoiData';
import Card from './ui/Card';
import Footer from './ui/Footer';
import AoiMap from './components/AoiMap';
import CoordinateForm from './components/CoordinateForm';
import PeriodSelect from './components/PeriodSelect';
import CalendarHeatmap from './components/CalendarHeatmap';
import PaletteSwitch from './components/PaletteSwitch';
import AnomalyCard from './components/AnomalyCard';
import TopPeriods from './components/TopPeriods';
import HarmonizationChart from './components/HarmonizationChart';
import SummaryStats from './components/SummaryStats';
import ExportPanel from './components/ExportPanel';
import StatusBadge from './components/StatusBadge';
import ErrorBanner from './components/ErrorBanner';

const now = new Date();
const LAST_YEAR = now.getFullYear();
const CURRENT_MONTH = `${LAST_YEAR}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export default function App() {
  const [aoi, setAoi] = useState(DEFAULT_AOI);
  const [years, setYears] = useState([FIRST_YEAR, LAST_YEAR]);
  const [palette, setPalette] = useState('viridis');

  // "to" cannot be in the future (422), so clamp it to the current month
  const range = useMemo(() => {
    const to = `${years[1]}-12`;
    return { from: `${years[0]}-01`, to: to > CURRENT_MONTH ? CURRENT_MONTH : to };
  }, [years]);

  const d = useAoiData(aoi, range, CURRENT_MONTH);
  const meta = (d.calendar.data || d.summary.data)?.meta;
  const palettes = d.calendar.data?.palettes || ['viridis', 'cividis'];

  return (
    <div className="app">
      <header className="header">
        <h1>Ala-Too Fire Calendar</h1>
        <StatusBadge meta={meta} />
      </header>

      <ErrorBanner states={d} />

      <aside className="sidebar">
        <Card title="Area of interest" hint="Draw a rectangle or polygon (buttons on the map) or type coordinates">
          <AoiMap aoi={aoi} onChange={setAoi} />
          <CoordinateForm aoi={aoi} onChange={setAoi} />
        </Card>
        <Card title="Period">
          <PeriodSelect yearFrom={years[0]} yearTo={years[1]} lastYear={LAST_YEAR} onChange={(a, b) => setYears([a, b])} />
        </Card>
        <Card title="AOI summary" state={d.summary}>
          {d.summary.data && <SummaryStats data={d.summary.data} />}
        </Card>
        <Card title="Download CSV">
          <ExportPanel aoi={aoi} range={range} />
        </Card>
      </aside>

      <main className="main">
        <Card title="Activity calendar" hint="Hotspot-days (1 km) by month. One continuous MODIS + VIIRS series" state={d.calendar}
          aside={<PaletteSwitch palettes={palettes} value={palette} onChange={setPalette} />}>
          {d.calendar.data && (
            <CalendarHeatmap data={d.calendar.data} palette={palette} nrtMonths={d.summary.data?.coverage.nrt_months} />
          )}
        </Card>

        <div className="row">
          <Card title="Current month vs history" state={d.anomaly}>
            {d.anomaly.data && <AnomalyCard data={d.anomaly.data} />}
          </Card>
          <Card title="Top periods" state={d.top}>
            {d.top.data && <TopPeriods data={d.top.data} />}
          </Card>
        </div>

        <Card title="Before and after harmonization" hint="The raw series shows a false jump in 2012. We remove it by calibrating on the overlap years" state={d.harmonization}>
          {d.harmonization.data && <HarmonizationChart data={d.harmonization.data} />}
        </Card>
      </main>

      <Footer />
    </div>
  );
}
