import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require(process.env.FIREBROS_SHARP_MODULE || "sharp");
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error("Usage: node crop_capture.mjs <full-page.png> <assets-dir>");
await mkdir(destination, { recursive: true });
const metadata = await sharp(source).metadata();
const regions = {
  application: { left: 176, top: 20, width: 1560, height: 1100 },
  area: { left: 184, top: 210, width: 340, height: 680 },
  anomaly: { left: 542, top: 1354, width: 618, height: 560 },
  calibration: { left: 542, top: 2160, width: 1194, height: 675 },
  export: { left: 184, top: 1566, width: 335, height: 240 },
};
for (const [name, region] of Object.entries(regions)) {
  await sharp(source)
    .extract({
      ...region,
      height: Math.min(region.height, metadata.height - region.top),
    })
    .png()
    .toFile(join(destination, `${name}.png`));
}
console.log(JSON.stringify(metadata));
