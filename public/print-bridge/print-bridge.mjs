#!/usr/bin/env node
/**
 * Coastline Prints / LightLab print bridge.
 *
 * Runs on a Raspberry Pi (or any computer with Node 18+) that is plugged
 * into the Star receipt printer by ethernet and online through Wi-Fi, e.g. a
 * phone hotspot at a market. It keeps a request open to the site, and when
 * the register sells something it receives the receipt (already rendered as
 * printer commands) and sends it to the printer on port 9100. The printer
 * itself never needs Wi-Fi or internet.
 *
 *   BRIDGE_KEY=pb_... node print-bridge.mjs
 *
 * Optional: SERVER (default https://coastlineprints.ca), PRINTER_HOST (else
 * it finds the Star printer on the local networks), PRINTER_PORT (9100),
 * BRIDGE_JSON=1 (one JSON event per line, for the Coastline Printer Mac app).
 * No packages needed.
 */
import net from "node:net";
import os from "node:os";

const VERSION = "1.1";
const KEY = process.env.BRIDGE_KEY ?? process.argv[2];
const SERVER = (process.env.SERVER ?? "https://coastlineprints.ca").replace(/\/$/, "");
const PORT = Number(process.env.PRINTER_PORT ?? 9100);
if (!KEY?.startsWith("pb_")) {
  console.error("Set BRIDGE_KEY (make one on Admin > Receipts).");
  process.exit(1);
}

const JSON_OUT = process.env.BRIDGE_JSON === "1";
const log = (...a) => !JSON_OUT && console.log(new Date().toLocaleTimeString(), ...a);
/** For the Mac app: what happened, as one JSON line. */
const event = (type, data = {}) => JSON_OUT && console.log(JSON.stringify({ type, at: Date.now(), ...data }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Finding the printer ──────────────────────────────────────────────────

/**
 * Star printers send a status message (ASB) as soon as something connects
 * to port 9100: first byte has bit 0 set and bits 4 and 7 clear (e.g. 0x23).
 * That tells it apart from other printers on the network.
 */
function probe(host, timeout = 900) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port: PORT });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeout, () => finish(false));
    s.on("error", () => finish(false));
    s.on("data", (d) => finish((d[0] & 0x91) === 0x01));
    // Ask for status if it didn't offer one.
    s.on("connect", () => setTimeout(() => !done && s.write(Buffer.from([0x1b, 0x06, 0x01])), 400));
  });
}

/** Every address on this computer's small (/22 or narrower) IPv4 networks, ethernet first. */
function candidates() {
  const out = [];
  const ifaces = Object.entries(os.networkInterfaces()).sort(([a], [b]) => Number(!/^(eth|en)/.test(a)) - Number(!/^(eth|en)/.test(b)));
  for (const [, addrs] of ifaces) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const ip = a.address.split(".").map(Number);
      const mask = a.netmask.split(".").map(Number);
      const bits = mask.reduce((n, m) => n + m.toString(2).replace(/0/g, "").length, 0);
      if (bits < 22) continue;
      const base = ip.map((o, i) => o & mask[i]);
      const count = 2 ** (32 - bits);
      const start = (base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3];
      for (let i = 1; i < count - 1; i++) {
        const n = (start + i) >>> 0;
        const host = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
        if (host !== a.address) out.push(host);
      }
    }
  }
  return [...new Set([...out, "192.168.192.168"])]; // Star's own fallback address
}

let printerHost = process.env.PRINTER_HOST || null;
let checkedOnce = false;

async function findPrinter() {
  if (process.env.PRINTER_HOST) return (await probe(process.env.PRINTER_HOST, 2500)) ? process.env.PRINTER_HOST : null;
  if (printerHost && (await probe(printerHost, 2500))) return printerHost;
  const hosts = candidates();
  let found = null;
  for (let i = 0; i < hosts.length && !found; i += 64) {
    const batch = hosts.slice(i, i + 64);
    const hits = await Promise.all(batch.map((h) => probe(h).then((ok) => (ok ? h : null))));
    found = hits.find(Boolean) ?? null;
  }
  if (found !== printerHost || !checkedOnce) {
    log(found ? `Found the printer at ${found}` : "Can't find the printer yet");
    event("printer", { host: found });
  }
  checkedOnce = true;
  printerHost = found;
  return found;
}

// ── Printing ─────────────────────────────────────────────────────────────

function send(host, bytes) {
  return new Promise((resolve, reject) => {
    const s = net.connect({ host, port: PORT });
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      s.destroy();
      if (err) reject(err);
      else resolve();
    };
    s.setTimeout(20_000, () => done(new Error(`Printer at ${host} timed out`)));
    s.on("error", (e) => done(new Error(`Can't reach the printer at ${host}: ${e.message}`)));
    // Star printers reply with status; read it so the connection can close.
    s.on("data", () => {});
    s.on("connect", () => s.end(bytes));
    s.on("close", (hadError) => !hadError && done());
  });
}

async function report(id, ok, error) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${SERVER}/api/print-bridge/${id}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ok, error }) });
      if (r.ok) return;
    } catch {}
    await sleep(2000 * (i + 1));
  }
}

// ── Main loop ────────────────────────────────────────────────────────────

let lastCheck = 0;
let failures = 0;
let online = false;
log(`Print bridge ${VERSION} → ${SERVER}`);
event("start", { version: VERSION, server: SERVER });

for (;;) {
  // Look for the printer at start and every 30 s, so the site can show whether it's there.
  if (Date.now() - lastCheck > 30_000 || !printerHost) {
    lastCheck = Date.now();
    await findPrinter();
  }
  try {
    // Until it has heard back, ask without waiting, so it knows straight away that it's online.
    const q = new URLSearchParams({ v: VERSION, printer: printerHost ? "ok" : "missing", host: printerHost ?? "", wait: online ? "1" : "0" });
    const res = await fetch(`${SERVER}/api/print-bridge?${q}`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(40_000) });
    if (res.status === 401) {
      log("The site doesn't know this bridge key. Make a new one on Admin > Receipts.");
      event("badkey");
      await sleep(60_000);
      continue;
    }
    if (!res.ok) throw new Error(`Site answered ${res.status}`);
    if (failures) log("Back online");
    if (failures || !online) event("online");
    online = true;
    failures = 0;
    const { job } = await res.json();
    if (!job) continue;
    log(`Printing ${job.label}`);
    event("printing", { id: job.id, label: job.label });
    const host = printerHost ?? (await findPrinter());
    if (!host) {
      await report(job.id, false, "The bridge can't find the printer. Check the ethernet cable and that it's on.");
      event("failed", { id: job.id, label: job.label, error: "Can't find the printer" });
      continue;
    }
    try {
      await send(host, Buffer.from(job.data, "base64"));
      await report(job.id, true);
      log("Printed");
      event("printed", { id: job.id, label: job.label });
    } catch (err) {
      printerHost = null;
      await report(job.id, false, err.message);
      log(err.message);
      event("failed", { id: job.id, label: job.label, error: err.message });
    }
  } catch (err) {
    failures++;
    if (failures === 1) event("offline", { error: err.message });
    online = false;
    if (failures === 1 || failures % 10 === 0) log(`Can't reach ${SERVER} (${err.message}). Is the hotspot on?`);
    await sleep(Math.min(30_000, 2000 * failures));
  }
}
