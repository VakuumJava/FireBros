import Card from "../../ui/Card";
import HarmonizationChart from "../HarmonizationChart";

export default function MethodView({ active, states }) {
  return (
    <section
      className="method"
      id="method"
      hidden={!active}
      aria-labelledby="method-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="method-title">Sensor calibration</h2>
          <p>VIIRS is calibrated against overlapping MODIS observations.</p>
        </div>
      </div>
      <Card
        title="Sensor comparison"
        hideTitle
        className="method__chart"
        state={states.harmonization}
      >
        {states.harmonization.data && active && (
          <HarmonizationChart data={states.harmonization.data} />
        )}
      </Card>
    </section>
  );
}
