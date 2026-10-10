/** Uploading STL and 3MF files, and pricing them from what was stored. */
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { cartItem } from "../helpers/fixtures";

const { POST: upload } = await import("@/app/api/uploads/route");
const { POST: quote } = await import("@/app/api/quote/route");
const { db } = await import("@/lib/db");
const { getStorage } = await import("@/lib/storage");

const send = (bytes: Uint8Array, name: string) =>
  upload(new Request("http://test/api/uploads", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(name), "x-forwarded-for": crypto.randomUUID() }, body: bytes as BodyInit }));

/** A painted 20 mm cube: top in filament 2, everything else filament 1. */
function paintedCube3mf() {
  const v = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const model = `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${v
    .map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`)
    .join("")}</vertices><triangles>${t.map(([a, b, c], i) => `<triangle v1="${a}" v2="${b}" v3="${c}"${i === 2 || i === 3 ? ' paint_color="8"' : ""}/>`).join("")}</triangles></mesh></object></resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 100 100 0"/></build></model>`;
  return zipSync({
    "3D/3dmodel.model": strToU8(model),
    "Metadata/project_settings.config": strToU8(JSON.stringify({ filament_colour: ["#FF0000", "#FFFFFF"], filament_type: ["PLA", "PLA"] })),
  });
}

describe("3MF uploads", () => {
  it("stores the original 3MF with its size, volume and colours", async () => {
    const res = await send(paintedCube3mf(), "Painted Cube.3mf");
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.upload).toMatchObject({ name: "Painted Cube.3mf", format: "3mf", size: { x: 20, y: 20, z: 20 } });
    expect(body.upload.volumeMm3).toBeCloseTo(8000);
    // The top is 1 of the cube's 6 faces.
    expect(body.upload.colorInfo).toMatchObject({ filaments: [{ hex: "#FF0000", type: "PLA" }, { hex: "#FFFFFF", type: "PLA" }], used: [1, 2], notes: [], shares: { 1: 0.8333, 2: 0.1667 } });
    // Which colours appear at each height: the top slice has the painted top (filament 2, bit 4).
    const z = body.upload.colorInfo.profile.axes[2];
    expect(z.at(-1) & 4).toBe(4);
    expect(z[0] & 4).toBe(0);
    const row = await db.upload.findUniqueOrThrow({ where: { id: body.upload.id } });
    expect(row.storageKey).toMatch(/\.3mf$/);
    expect((await getStorage().get(row.storageKey)).byteLength).toBe(paintedCube3mf().byteLength);
  });

  it("prices a stretched 3MF by re-reading the stored file", async () => {
    const { upload: up } = await (await send(paintedCube3mf(), "cube.3mf")).json();
    const res = await quote(new Request("http://test/api/quote", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() }, body: JSON.stringify({ items: [cartItem(up.id, { scale: { x: 2, y: 1, z: 1 } })] }) }));
    const { quote: q } = await res.json();
    expect(res.status).toBe(200);
    expect(q.ok).toBe(true);
    expect(q.items[0].assignment.orientedSize.x + q.items[0].assignment.orientedSize.y).toBeCloseTo(60);
  });

  it("names the file by what it really is, and rejects files that are neither", async () => {
    const { upload: up } = await (await send(paintedCube3mf(), "renamed.stl")).json();
    expect(up.name).toBe("renamed.3mf");
    const bad = await send(strToU8("not a model"), "x.3mf");
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).toMatch(/STL or 3MF/);
  });
});

describe("multicolour 3MF pricing", () => {
  const priceWith = async (over: Record<string, unknown>) => {
    const { upload: up } = await (await send(paintedCube3mf(), "cube.3mf")).json();
    const { priceCart, CartError } = await import("@/lib/pricing/server-quote");
    return { run: () => priceCart([cartItem(up.id, { colorId: "orange", ...over })] as never), CartError };
  };

  it("names the colours, keeps which file colour prints in which, and weights the price by surface", async () => {
    const { run } = await priceWith({ colorMap: { 1: "red-matte", 2: "green" } });
    const priced = await run();
    expect(priced.ok).toBe(true);
    expect(priced.lines[0].colorName).toBe("Red Matte and Green"); // most-covered first
    expect(priced.lines[0].colorId).toBe("red-matte");
    expect(priced.lines[0].colorSlots).toEqual([
      { filament: 1, fileHex: "#FF0000", colorId: "red-matte", colorName: "Red Matte", hex: "#c8322b" },
      { filament: 2, fileHex: "#FFFFFF", colorId: "green", colorName: "Green", hex: "#2e9e4b" },
    ]);
  });

  it("saves which stock colour each file colour prints in on the order", async () => {
    const { run } = await priceWith({ colorMap: { 1: "red-matte", 2: "green" } });
    const priced = await run();
    const { finalizeCheckout } = await import("@/lib/orders/finalize");
    const { config: _c, ...quote } = priced;
    void _c;
    const co = await db.checkout.create({
      data: { idempotencyKey: crypto.randomUUID(), cart: JSON.stringify({ lines: priced.lines, quote }), totalCents: priced.totalCents, customerName: "Mo", customerEmail: `mo-${crypto.randomUUID().slice(0, 8)}@example.com`, customerPhone: "604 555 0123", squareCustomerId: "SQ-MULTI" },
    });
    const r = await finalizeCheckout(co.id, { id: `pay_${co.id}`, status: "COMPLETED", amountCents: priced.totalCents, currency: "CAD" });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: r!.order.id } });
    expect(item.colorName).toBe("Red Matte and Green");
    expect(JSON.parse(item.colorSlots!).map((x: { filament: number; colorId: string }) => [x.filament, x.colorId])).toEqual([
      [1, "red-matte"],
      [2, "green"],
    ]);
  });

  it("refuses a colour map that doesn't match the file", async () => {
    const { run, CartError } = await priceWith({ colorMap: { 1: "red-matte", 3: "green" } });
    await expect(run()).rejects.toThrow(CartError);
  });

  it("prints in one colour when no map is sent", async () => {
    const { run } = await priceWith({});
    const priced = await run();
    expect(priced.lines[0]).toMatchObject({ colorId: "orange", colorName: "Orange", colorSlots: null });
  });
});
