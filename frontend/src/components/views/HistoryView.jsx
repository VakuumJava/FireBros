import { areaLabel } from "../../api/areas";
import Card from "../../ui/Card";
import CalendarHeatmap from "../CalendarHeatmap";
import PaletteSwitch from "../PaletteSwitch";
import PeriodSelect from "../PeriodSelect";
import SeasonalProfile from "../SeasonalProfile";
import TopPeriods from "../TopPeriods";

export default function HistoryView({
  active,
  aoi,
  range,
  month,
  palette,
  palettes,
  states,
  availability,
  currentMonth,
  onRangeChange,
  onPaletteChange,
  onMonthSelect,
}) {
  return (
    <section
      className="history"
      id="calendar"
      hidden={!active}
      aria-labelledby="history-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="history-title">Activity history</h2>
          <p>{areaLabel(aoi)} · MODIS-equivalent hotspot-days</p>
        </div>
        <div className="dock-actions">
          <PaletteSwitch
            palettes={palettes}
            value={palette}
            onChange={onPaletteChange}
          />
        </div>
      </div>
      <div className="history__controls">
        <PeriodSelect
          range={range}
          currentMonth={availability?.last_month || currentMonth}
          onChange={onRangeChange}
        />
        <p>Choose a month in the calendar to update the comparison.</p>
      </div>
      <div className="history__grid">
        <Card
          title="Activity calendar"
          hideTitle
          className="calendar-panel"
          state={states.calendar}
        >
          {states.calendar.data && (
            <CalendarHeatmap
              data={states.calendar.data}
              active={active}
              palette={palette}
              nrtMonths={states.summary.data?.coverage.nrt_months}
              selectedMonth={month}
              onSelect={onMonthSelect}
            />
          )}
        </Card>
        <div>
          <Card
            title="Most active periods"
            className="ranking-panel"
            hint="Within this area and date range"
            state={states.top}
          >
            {states.top.data && (
              <TopPeriods data={states.top.data} onSelect={onMonthSelect} />
            )}
          </Card>
        </div>
      </div>
      {states.calendar.data && states.summary.data && (
        <SeasonalProfile
          data={states.calendar.data}
          selectedMonth={month}
          nrtMonths={states.summary.data.coverage.nrt_months}
          onSelect={onMonthSelect}
        />
      )}
    </section>
  );
}
