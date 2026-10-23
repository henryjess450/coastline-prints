/* eslint-disable @next/next/no-img-element */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import type { LabelDesignId } from "@config/labels";
import type { LabelData } from "./data";

/**
 * The five shipping label designs the owner picked, drawn for next/og at
 * 300 dpi: 1050 × 1500 px for a 3½ × 5 in label. Sizes below are written as
 * E(n), where E(1) is 0.1 in, so they match the design mockups.
 */
export const LABEL_PX = { width: 1050, height: 1500 };
const E = (n: number) => Math.round(n * 30 * 100) / 100;

const NAVY = "#0e4471";
const INK = "#0d1620";
const SOFT = "#5b6b7a";
const HAIR = "#b9c6d3";

const root = () => process.cwd();
const png = (rel: string) => `data:image/png;base64,${readFileSync(path.resolve(/* turbopackIgnore: true */ root(), rel)).toString("base64")}`;
/** A PNG turned a quarter turn counter-clockwise (next/og can't rotate images reliably). */
function rotatedLeft(rel: string) {
  const src = PNG.sync.read(readFileSync(path.resolve(/* turbopackIgnore: true */ root(), rel)));
  const out = new PNG({ width: src.height, height: src.width });
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const from = (y * src.width + x) * 4;
      const to = ((src.width - 1 - x) * out.width + y) * 4;
      src.data.copy(out.data, to, from, from + 4);
    }
  return `data:image/png;base64,${PNG.sync.write(out).toString("base64")}`;
}

let art: { black: string; white: string; whiteUp: string } | null = null;
/** The hand lettering, 1809 × 230 px, and a copy reading bottom to top for the Spine design. */
function lettering() {
  art ??= {
    black: png("public/brand/lettering/coastline-prints.png"),
    white: png("public/brand/lettering/coastline-prints-white.png"),
    whiteUp: rotatedLeft("public/brand/lettering/coastline-prints-white.png"),
  };
  return art;
}
const LET_RATIO = 230 / 1809;

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

async function qr(url: string) {
  return svgUri(await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }));
}

/**
 * Shrinks big address type when a line is long, so it wraps less. `widthE`
 * is the room in E units; a bold capital is about 0.68 of the type size wide.
 */
function fitSize(base: number, lines: string[], widthE: number) {
  const fits = Math.floor(E(widthE) / (base * 0.68));
  const longest = Math.max(...lines.map((l) => l.length));
  return longest <= fits ? base : Math.max(base * 0.7, (base * fits) / longest);
}

const upper = (s: string) => s.toUpperCase();
const addrLines = (d: LabelData) => [d.to.name, ...d.to.street, `${d.to.city}  ${d.to.postal}`];

function Addr({ d, size, weight = 700, color = INK }: { d: LabelData; size: number; weight?: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: size, fontWeight: weight, lineHeight: 1.22, color }}>
      {addrLines(d).map((l, i) => (
        <div key={i} style={{ display: "flex", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {upper(l)}
        </div>
      ))}
    </div>
  );
}

function Lines({ lines, size, color = SOFT, lh = 1.35 }: { lines: string[]; size: number; color?: string; lh?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: size, lineHeight: lh, color }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", whiteSpace: "pre-wrap" }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Cap({ children, color = NAVY, size = E(0.78), mb = 0 }: { children: string; color?: string; size?: number; mb?: number }) {
  return <div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: size * 0.14, color, marginBottom: mb }}>{children}</div>;
}

function Contact({ d, size }: { d: LabelData; size: number }) {
  const row = (k: string, v: string) => (
    <div style={{ display: "flex", alignItems: "baseline" }}>
      <div style={{ display: "flex", width: size * 0.62 * 5.8, flexShrink: 0, fontSize: size * 0.62, fontWeight: 700, letterSpacing: size * 0.09, color: SOFT }}>{k}</div>
      <div style={{ display: "flex", wordBreak: "break-all" }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.25, fontSize: size, color: INK }}>
      {row("PHONE", d.phone)}
      {row("EMAIL", d.email)}
    </div>
  );
}

function Stamp({ text, w = E(6.4), h = E(7.4), color = HAIR, ink = SOFT }: { text: string; w?: number; h?: number; color?: string; ink?: string }) {
  return (
    <div style={{ display: "flex", flexShrink: 0, width: w, height: h, border: `${E(0.12)}px dashed ${color}`, borderRadius: E(0.3), alignItems: "center", justifyContent: "center", color: ink, fontSize: E(0.62), fontWeight: 700, letterSpacing: E(0.09) }}>
      {text}
    </div>
  );
}

const pieces = (d: LabelData) => `${d.pieces} ${d.pieces === 1 ? "piece" : "pieces"}`;
const pkg = (d: LabelData) => `Package ${d.pkg.n} of ${d.pkg.of}`;
const page = { display: "flex", flexDirection: "column", width: LABEL_PX.width, height: LABEL_PX.height, background: "#ffffff", color: INK, fontFamily: "Montserrat" } as const;

/* 1 Harbour */
function Harbour({ d, q }: { d: LabelData; q: string }) {
  const L = lettering();
  return (
    <div style={page}>
      <div style={{ display: "flex", background: NAVY, color: "#fff", padding: `${E(1.8)}px ${E(2)}px ${E(1.6)}px`, justifyContent: "space-between", gap: E(1.2) }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <img src={L.white} width={E(17)} height={E(17) * LET_RATIO} alt="" />
          <div style={{ display: "flex", marginTop: E(0.9) }}>
            <Lines lines={d.from} size={E(0.95)} color="#e6eef7" />
          </div>
        </div>
        <Stamp text={d.postage} color="rgba(255,255,255,0.55)" ink="rgba(255,255,255,0.85)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: `${E(2.2)}px ${E(2)}px 0`, gap: E(1.4) }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Cap mb={E(0.6)}>SHIP TO</Cap>
          <Addr d={d} size={fitSize(E(2.2), addrLines(d), 31)} />
        </div>
        <Contact d={d} size={E(1.35)} />
      </div>
      <div style={{ display: "flex", margin: `0 ${E(2)}px ${E(1.8)}px`, paddingTop: E(1.2), borderTop: `${E(0.12)}px dashed ${HAIR}`, justifyContent: "space-between", alignItems: "flex-end", gap: E(1) }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: E(1.5), color: NAVY }}>{d.orderNumber}</div>
          <Lines lines={[d.service, `${pieces(d)} · ${pkg(d)}`]} size={E(0.9)} />
        </div>
        <img src={q} width={E(6.6)} height={E(6.6)} alt="" />
      </div>
    </div>
  );
}

/* 4 Manifest */
function Manifest({ d, q }: { d: LabelData; q: string }) {
  const L = lettering();
  const B = `${E(0.1)}px solid #000`;
  const cell = (o: { flex?: number; r?: boolean; b?: boolean; grow?: boolean } = {}) =>
    ({ display: "flex", flexDirection: "column", flex: o.flex ?? 1, borderRight: o.r ? "none" : B, borderBottom: o.b ? "none" : B, padding: `${E(0.6)}px ${E(0.8)}px`, minWidth: 0 }) as const;
  const cap = (t: string) => <Cap color="#000" size={E(0.62)} mb={E(0.35)}>{t}</Cap>;
  const v = (t: string, size = E(1.05)) => <div style={{ display: "flex", fontSize: size, fontWeight: 600 }}>{t}</div>;
  return (
    <div style={{ ...page, padding: E(1.4), color: "#000" }}>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, border: `${E(0.18)}px solid #000` }}>
        <div style={{ display: "flex" }}>
          <div style={{ ...cell({ flex: 3 }), justifyContent: "center" }}>
            <img src={L.black} width={E(15)} height={E(15) * LET_RATIO} alt="" />
          </div>
          <div style={{ ...cell({ r: true }), height: E(9), alignItems: "center", justifyContent: "center", fontSize: E(0.62), fontWeight: 700, letterSpacing: E(0.09), color: "#666" }}>{d.postage}</div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={cell({ r: true })}>
            {cap("FROM")}
            <div style={{ display: "flex", fontSize: E(1), lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{d.from.join(", ")}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexGrow: 1 }}>
          <div style={cell({ r: true })}>
            {cap("SHIP TO")}
            <Addr d={d} size={fitSize(E(2.2), addrLines(d), 30)} color="#000" />
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={cell({ flex: 2 })}>
            {cap("PHONE")}
            <div style={{ display: "flex", fontSize: E(1.05) }}>{d.phone}</div>
          </div>
          <div style={cell({ flex: 2, r: true })}>
            {cap("EMAIL")}
            <div style={{ display: "flex", fontSize: E(1.05), wordBreak: "break-all" }}>{d.email}</div>
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={cell()}>
            {cap("ORDER")}
            <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: E(1.05) }}>{d.orderNumber}</div>
          </div>
          <div style={cell()}>
            {cap("PIECES")}
            {v(String(d.pieces))}
          </div>
          <div style={cell({ flex: 2, r: true })}>
            {cap("SERVICE")}
            {v(d.service, E(0.9))}
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ ...cell({ flex: 3, b: true }), flexDirection: "row", alignItems: "center", gap: E(1) }}>
            <img src={q} width={E(5.4)} height={E(5.4)} alt="" />
            <div style={{ display: "flex", fontSize: E(0.9), lineHeight: 1.35 }}>Scan to see this order&apos;s status at coastlineprints.ca</div>
          </div>
          <div style={{ ...cell({ r: true, b: true }), alignItems: "center", justifyContent: "center" }}>
            {cap("PACKAGE")}
            {v(`${d.pkg.n} of ${d.pkg.of}`, E(1.5))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sea from the account page: five solid bands, each a little deeper. */
function seaSvg() {
  const wave = (y: number, amp: number, len: number, shift: number) => {
    let p = `M${-shift} ${y}`;
    for (let x = -shift; x < 380; x += len) p += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    return `${p} V160 H${-shift} Z`;
  };
  const cols = ["#2a5f8f", "#174a77", "#133f67", "#103558", "#0d2b49"];
  const paths = cols.map((c, i) => `<path d="${wave(14 + i * 22, 5, 90 - i * 6, i * 13)}" fill="${c}"/>`).join("");
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 160" preserveAspectRatio="none" width="1050" height="450">${paths}</svg>`);
}

/* 6 Sea Bands */
function Sea({ d }: { d: LabelData }) {
  const L = lettering();
  return (
    <div style={page}>
      <div style={{ display: "flex", padding: `${E(2)}px ${E(2)}px 0`, justifyContent: "space-between", gap: E(1) }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Cap mb={E(0.4)}>FROM</Cap>
          <Lines lines={d.from} size={E(0.95)} />
        </div>
        <Stamp text={d.postage} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: `${E(1.6)}px ${E(2)}px 0` }}>
        <Cap mb={E(0.6)}>SHIP TO</Cap>
        <Addr d={d} size={fitSize(E(2.2), addrLines(d), 31)} />
        <div style={{ display: "flex", marginTop: E(1.4) }}>
          <Contact d={d} size={E(1.3)} />
        </div>
      </div>
      <div style={{ display: "flex", marginTop: "auto", position: "relative", height: E(15) }}>
        <img src={seaSvg()} width={LABEL_PX.width} height={E(15)} style={{ position: "absolute", left: 0, top: 0 }} alt="" />
        <div style={{ display: "flex", position: "absolute", left: E(2), right: E(2), bottom: E(1.5), justifyContent: "space-between", alignItems: "flex-end", color: "#fff" }}>
          <img src={L.white} width={E(15)} height={E(15) * LET_RATIO} alt="" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: E(0.9), lineHeight: 1.4 }}>
            <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: E(1.1) }}>{d.orderNumber}</div>
            <div style={{ display: "flex" }}>{`${pieces(d)} · ${d.pkg.n} of ${d.pkg.of}`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 8 Spine */
function Spine({ d, q }: { d: LabelData; q: string }) {
  const L = lettering();
  const spineW = E(6.2);
  const letW = E(38);
  const letH = letW * LET_RATIO;
  return (
    <div style={{ ...page, flexDirection: "row" }}>
      <div style={{ display: "flex", width: spineW, flexShrink: 0, background: NAVY, position: "relative", overflow: "hidden" }}>
        <img src={L.whiteUp} width={letH} height={letW} alt="" style={{ position: "absolute", left: (spineW - letH) / 2, top: (LABEL_PX.height - letW) / 2 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: `${E(1.8)}px ${E(1.8)}px ${E(1.6)}px`, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: E(1) }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Cap mb={E(0.4)}>FROM</Cap>
            <Lines lines={d.from} size={E(0.95)} />
          </div>
          <Stamp text={d.postage} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: E(2.2) }}>
          <Cap mb={E(0.6)}>SHIP TO</Cap>
          <Addr d={d} size={fitSize(E(2), addrLines(d), 25)} />
        </div>
        <div style={{ display: "flex", marginTop: E(1.4) }}>
          <Contact d={d} size={E(1.2)} />
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end", gap: E(1) }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: E(1.25), color: NAVY }}>{d.orderNumber}</div>
            <Lines lines={[d.service, `${pieces(d)} · ${pkg(d)}`]} size={E(0.95)} color={INK} lh={1.4} />
          </div>
          <img src={q} width={E(5.6)} height={E(5.6)} alt="" />
        </div>
      </div>
    </div>
  );
}

/* 11 Big Type */
function BigType({ d }: { d: LabelData }) {
  const L = lettering();
  const nameSize = fitSize(E(3.2), [d.to.name], 31);
  const streetSize = fitSize(E(2.4), d.to.street, 31);
  return (
    <div style={{ ...page, padding: `${E(1.6)}px ${E(1.8)}px` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: E(1) }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: E(0.9), lineHeight: 1.4 }}>
          <div style={{ display: "flex", fontWeight: 700, color: NAVY }}>FROM</div>
          {d.from.map((l, i) => (
            <div key={i} style={{ display: "flex", whiteSpace: "pre-wrap" }}>
              {l}
            </div>
          ))}
        </div>
        <Stamp text={d.postage} w={E(5.6)} h={E(6.6)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: E(1.6) }}>
        <div style={{ display: "flex", fontSize: nameSize, fontWeight: 800, lineHeight: 1.05, color: NAVY, wordBreak: "break-word" }}>{upper(d.to.name)}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: E(0.6) * (streetSize / E(1)), fontSize: streetSize, fontWeight: 700, lineHeight: 1.15 }}>
          {d.to.street.map((l, i) => (
            <div key={i} style={{ display: "flex", wordBreak: "break-word" }}>
              {upper(l)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: E(1), marginTop: E(1.4), fontSize: E(2.4), fontWeight: 700 }}>
        <div style={{ display: "flex" }}>{upper(d.to.city)}</div>
        <div style={{ display: "flex", background: NAVY, color: "#fff", padding: `${E(0.1)}px ${E(0.7)}px`, borderRadius: E(0.3), fontFamily: "DM Mono", fontWeight: 500 }}>{d.to.postal}</div>
      </div>
      <div style={{ display: "flex", marginTop: "auto" }}>
        <Contact d={d} size={E(1.3)} />
      </div>
      <div style={{ display: "flex", marginTop: E(1.4), paddingTop: E(0.9), borderTop: `${E(0.12)}px solid ${NAVY}`, justifyContent: "space-between", alignItems: "center", fontSize: E(0.9) }}>
        <img src={L.black} width={E(10)} height={E(10) * LET_RATIO} alt="" />
        <div style={{ display: "flex", fontFamily: "DM Mono" }}>{`${d.orderNumber} · ${d.pkg.n} of ${d.pkg.of}`}</div>
      </div>
    </div>
  );
}

export async function labelTree(design: LabelDesignId, d: LabelData) {
  const q = await qr(d.url);
  switch (design) {
    case "manifest":
      return <Manifest d={d} q={q} />;
    case "sea":
      return <Sea d={d} />;
    case "spine":
      return <Spine d={d} q={q} />;
    case "bigtype":
      return <BigType d={d} />;
    default:
      return <Harbour d={d} q={q} />;
  }
}
