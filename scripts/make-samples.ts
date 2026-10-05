/** Writes sample STLs with known geometry to prisma/samples for development. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { boxTriangles, sphereTriangles, toAsciiStl, toBinaryStl } from "../tests/helpers/meshes";

const out = path.resolve(__dirname, "../prisma/samples");
mkdirSync(out, { recursive: true });

const samples: Record<string, Uint8Array> = {
  "calibration-cube-20mm.stl": toBinaryStl(boxTriangles(20, 20, 20)),
  "sphere-40mm-ascii.stl": toAsciiStl(sphereTriangles(20, 64, 32), "sphere"),
  "tall-tower-60x60x200.stl": toBinaryStl(boxTriangles(60, 60, 200)),
  "lying-panel-240x40x10.stl": toBinaryStl(boxTriangles(10, 40, 240)),
  "modelled-in-inches-3x2x1.stl": toBinaryStl(boxTriangles(3, 2, 1)),
  "open-mesh-box.stl": toBinaryStl(boxTriangles(30, 30, 30).slice(2)),
  "too-big-300mm.stl": toBinaryStl(boxTriangles(300, 300, 300)),
};

for (const [name, bytes] of Object.entries(samples)) {
  writeFileSync(path.join(out, name), bytes);
  console.log(`wrote ${name} (${bytes.byteLength} bytes)`);
}
