# Ala-Too Fire Atlas design

The interface puts the product's question first: how unusual was a month in a
chosen place? A larger map and the selected-month result share the first working
area. Calendar history, calibration evidence and export follow in that order.

The UIMixes `infographic` grammar informs hierarchy and data presentation.
References are FT Visual & Data Journalism and cartographic information design:
learn clear units, explicit uncertainty and geographic context, rather than
reproducing a page. IBM Plex Sans carries interface text, and JetBrains Mono
carries compact metadata. Both are locally hosted with OFL licenses.

Flat mineral surfaces, dark green ink and an earth-red accent connect the
interface to the mountain region and thermal activity. Panels use a 2px radius;
place presets use pills. Calibration and raw sensor series remain visually
separate. Viridis/Cividis continue to encode calendar magnitude; missing data
uses hatching, partial source coverage uses a corner mark. No decorative data
points, fabricated claims, animation runtime or new UI framework were added.

Interaction paths:

- Area preset, rectangle, polygon or typed coordinates updates all AOI data.
- Calendar month selection updates only the anomaly request. Its persistent
  selected-month summary links back to the assessment.
- Ranked months select the matching month and return to the assessment.
- Numeric calendar labels can be shown without changing measurements.
- Exports retain server row counts, cancellation and visible error handling.

The interface is English, matching the existing jury-facing product. It is
responsive by source composition, but current browser evidence is unavailable.
See `frontend/QA.md` for verified checks and explicit remaining gaps. Previous
pitch screenshots and video show the older dark UI and are not current design
proof. No readiness claim or competition outcome is implied by the redesign.

Deployed as `firebros-20261115-41ec2dacd303` at https://nasa.vakuum.cc.
Public byte checks match the compiled HTML, CSS, JavaScript, font and social
preview. All five API endpoints returned 200; the sample monthly CSV header
matched its row count. See `docs/deployment/nasa-atlas-check.json`.
