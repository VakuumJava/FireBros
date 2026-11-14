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

  // "to" нельзя из будущего (422), поэтому обрезаем по текущему месяцу
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
        <Card title="Область интереса" hint="Нарисуйте прямоугольник или полигон (кнопки на карте) или введите координаты">
          <AoiMap aoi={aoi} onChange={setAoi} />
          <CoordinateForm aoi={aoi} onChange={setAoi} />
        </Card>
        <Card title="Период">
          <PeriodSelect yearFrom={years[0]} yearTo={years[1]} lastYear={LAST_YEAR} onChange={(a, b) => setYears([a, b])} />
        </Card>
        <Card title="Сводка по AOI" state={d.summary}>
          {d.summary.data && <SummaryStats data={d.summary.data} />}
        </Card>
        <Card title="Скачать CSV">
          <ExportPanel aoi={aoi} range={range} />
        </Card>
      </aside>

      <main className="main">
        <Card title="Календарь активности" hint="Хотспот-дни (1 км) по месяцам. Единый ряд MODIS + VIIRS" state={d.calendar}
          aside={<PaletteSwitch palettes={palettes} value={palette} onChange={setPalette} />}>
          {d.calendar.data && (
            <CalendarHeatmap data={d.calendar.data} palette={palette} nrtMonths={d.summary.data?.coverage.nrt_months} />
          )}
        </Card>

        <div className="row">
          <Card title="Текущий месяц vs история" state={d.anomaly}>
            {d.anomaly.data && <AnomalyCard data={d.anomaly.data} />}
          </Card>
          <Card title="Топ-периоды" state={d.top}>
            {d.top.data && <TopPeriods data={d.top.data} />}
          </Card>
        </div>

        <Card title="До и после гармонизации" hint="Сырой ряд даёт ложный скачок в 2012. Мы его убираем калибровкой на перекрытии" state={d.harmonization}>
          {d.harmonization.data && <HarmonizationChart data={d.harmonization.data} />}
        </Card>
      </main>

      <Footer />
    </div>
  );
}
