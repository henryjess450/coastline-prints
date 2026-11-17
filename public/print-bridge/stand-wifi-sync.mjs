#!/usr/bin/env node
/**
 * Copies the stand's Wi-Fi list from Admin > Receipts onto the stand PC
 * (installed by setup-stand-pc.sh; stand-watch.sh runs it every 10 min while
 * online). Each network becomes a NetworkManager connection named
 * "site-<name>"; ones removed on the site are removed here. Networks added on
 * the PC itself (the setup page, "wifi-<name>") are left alone.
 * Top of the list gets the highest priority. No packages needed.
 */
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.env.ENV_FILE || "/etc/print-bridge.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SERVER = (env.SERVER || "https://coastlineprints.ca").replace(/\/$/, "");
const STATE = process.env.STATE_DIR || "/run/stand";

const nmcli = (...args) =>
  new Promise((resolve) => execFile("nmcli", args, { timeout: 20_000 }, (err, out, stderr) => resolve({ ok: !err, out: String(out), err: String(stderr || err?.message || "") })));

const res = await fetch(`${SERVER}/api/print-bridge/wifi`, { headers: { Authorization: `Bearer ${env.BRIDGE_KEY}` }, signal: AbortSignal.timeout(20_000) });
if (!res.ok) {
  console.error(`The site answered ${res.status} for the Wi-Fi list`);
  process.exit(1);
}
const { networks } = await res.json();
if (!Array.isArray(networks)) process.exit(1);

const fields = (line) => line.split(/(?<!\\):/).map((f) => f.replace(/\\:/g, ":").replace(/\\\\/g, "\\"));
const existing = (await nmcli("-t", "-f", "NAME,TYPE", "con", "show")).out
  .split("\n")
  .map(fields)
  .filter(([name, type]) => type === "802-11-wireless" && name.startsWith("site-"))
  .map(([name]) => name);

const want = new Set();
let changed = 0;
for (const [i, n] of networks.entries()) {
  const con = `site-${n.ssid}`;
  want.add(con);
  const priority = String(50 - Math.min(i, 40)); // top of the list first; printer-lan is 100, unrelated
  const sec = n.psk ? ["wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", n.psk] : [];
  if (existing.includes(con)) {
    const cur = (await nmcli("-s", "-g", "802-11-wireless-security.psk,connection.autoconnect-priority", "con", "show", con)).out.split("\n");
    if ((cur[0] ?? "") === n.psk && (cur[1] ?? "").trim() === priority) continue;
    // Password or order changed: simplest to make it again.
    await nmcli("con", "delete", con);
  }
  const r = await nmcli("con", "add", "type", "wifi", "con-name", con, "ssid", n.ssid, ...sec,
    "connection.autoconnect", "yes", "connection.autoconnect-retries", "0", "connection.autoconnect-priority", priority);
  if (r.ok) changed++;
  else console.error(`Couldn't save ${n.ssid}: ${r.err.trim()}`);
}
for (const con of existing.filter((c) => !want.has(c))) {
  await nmcli("con", "delete", con);
  changed++;
}
if (changed) console.log(`Wi-Fi list updated from the site (${networks.length} networks)`);
mkdirSync(STATE, { recursive: true });
writeFileSync(`${STATE}/wifi-synced`, networks.map((n) => n.ssid).join("\n"));
