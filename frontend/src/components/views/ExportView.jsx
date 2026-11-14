import { areaLabel } from "../../api/areas";
import Card from "../../ui/Card";
import EvidenceExport from "../EvidenceExport";
import ExportPanel from "../ExportPanel";
import SummaryStats from "../SummaryStats";

export default function ExportView({ active, aoi, range, month, states }) {
  const source = Object.values(states).find((state) => state.data?.meta)?.data
    .meta.source;
  return (
    <section
      className="export-section"
      id="export"
      hidden={!active}
      aria-labelledby="export-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="export-title">Export this selection</h2>
          <p>
            {areaLabel(aoi)} · {range.from} — {range.to}
          </p>
        </div>
      </div>
      <div className="export-section__grid">
        <Card
          title="Selection summary"
          state={states.summary}
          className="summary-panel"
        >
          {states.summary.data && <SummaryStats data={states.summary.data} />}
        </Card>
        <Card title="CSV download" className="export-panel">
          {active && <ExportPanel aoi={aoi} range={range} source={source} />}
          <EvidenceExport
            aoi={aoi}
            range={range}
            month={month}
            states={states}
          />
        </Card>
      </div>
    </section>
  );
}
