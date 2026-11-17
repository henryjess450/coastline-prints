#!/usr/bin/env node
/**
 * The LightLab stand PC's setup page (installed by setup-stand-pc.sh).
 *
 * When the stand can't get online, stand-watch.sh opens the "LightLab Stand
 * Setup" Wi-Fi. Join it from a phone and this page pops up (every address
 * points here): it shows how the stand is doing and lets you add the venue's
 * Wi-Fi or your hotspot. Only answers on the setup hotspot. No packages needed.
 */
import http from "node:http";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SETUP_CON = process.env.SETUP_CON || "stand-setup";
const HOTSPOT_IP = "10.42.0.1";
const STATE = process.env.STATE_DIR || "/run/stand";
mkdirSync(STATE, { recursive: true });

const run = (cmd, args, timeout = 20_000) =>
  new Promise((resolve) => execFile(cmd, args, { timeout }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout), err: String(stderr || err?.message || "") })));
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** nmcli -t output: fields split on unescaped ":". */
const fields = (line) => line.split(/(?<!\\):/).map((f) => f.replace(/\\:/g, ":").replace(/\\\\/g, "\\"));

async function savedWifi() {
  const { out } = await run("nmcli", ["-t", "-f", "NAME,TYPE", "con", "show"]);
  const names = out.split("\n").map(fields).filter(([n, t]) => t === "802-11-wireless" && n !== SETUP_CON).map(([n]) => n);
  return Promise.all(names.map(async (name) => ({ name, ssid: (await run("nmcli", ["-g", "802-11-wireless.ssid", "con", "show", name])).out.trim() })));
}

function scanned() {
  const best = new Map();
  for (const line of read(`${STATE}/scan`).split("\n")) {
    const [ssid, signal, security] = fields(line);
    if (!ssid) continue;
    if (!best.has(ssid) || Number(signal) > best.get(ssid).signal) best.set(ssid, { ssid, signal: Number(signal) || 0, open: !security || security === "--" });
  }
  return [...best.values()].sort((a, b) => b.signal - a.signal).slice(0, 15);
}

async function bridgeLines() {
  const { out } = await run("journalctl", ["-u", "print-bridge", "-n", "40", "-o", "cat", "--no-pager"]);
  const lines = out.trim().split("\n").filter(Boolean);
  const printer = [...lines].reverse().find((l) => /Found the printer|Can't find the printer/.test(l));
  return { printer: printer?.replace(/^\S+\s+/, "") ?? "Still looking for the printer", recent: lines.slice(-6) };
}

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LightLab stand</title><style>
:root{--bg:#faf8f4;--fg:#1d1b18;--muted:#6d665c;--line:#e4ded3;--accent:#c4622d}
@media (prefers-color-scheme:dark){:root{--bg:#171513;--fg:#f2ede6;--muted:#a59d91;--line:#35302a;--accent:#e58a52}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,-apple-system,sans-serif}
main{max-width:30rem;margin:0 auto;padding:20px 16px 40px}h1{font-size:1.5rem;margin:.2em 0}h2{font-size:1.05rem;margin:1.6em 0 .4em}
p,li{color:var(--muted)}.card{border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:8px 0}
label{display:block;font-weight:600;margin:.8em 0 .3em}input{box-sizing:border-box;width:100%;font:inherit;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit}
button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:11px 18px;background:var(--accent);color:#fff;margin-top:12px}
button.link{background:none;color:var(--accent);padding:4px 0;margin:0}.net{display:flex;justify-content:space-between;gap:8px;align-items:center}
.pick{all:unset;cursor:pointer;display:block;width:100%;padding:9px 0;border-bottom:1px solid var(--line)}.pick:last-child{border:0}
code{font-size:.85em;white-space:pre-wrap;color:var(--muted)}</style></head><body><main>${body}</main></body></html>`;

async function home(msg = "") {
  const [saved, bridge] = await Promise.all([savedWifi(), bridgeLines()]);
  const nets = scanned();
  const status = Object.fromEntries(read(`${STATE}/status`).split("\n").filter(Boolean).map((l) => l.split("=")));
  return page(`
<h1>LightLab stand</h1>
<p>${status.state === "setup" ? "The stand can't find a Wi-Fi it knows, so it opened this setup network." : "Stand status."} Add the Wi-Fi it should use below. It closes this network and joins it.</p>
${msg ? `<div class="card"><b>${msg}</b></div>` : ""}
<div class="card"><b>Printer:</b> ${esc(bridge.printer)}</div>

<h2>Add a Wi-Fi</h2>
<form method="post" action="/add">
  ${nets.length ? `<div class="card">${nets.map((n) => `<button type="button" class="pick" onclick="document.getElementById('ssid').value=this.dataset.s;document.getElementById('psk').focus()" data-s="${esc(n.ssid)}">${esc(n.ssid)} <span style="color:var(--muted)">${n.open ? "· open" : ""}</span></button>`).join("")}</div>` : `<p>Nearby networks show up here after the next scan.</p>`}
  <label for="ssid">Wi-Fi name</label><input id="ssid" name="ssid" required maxlength="32" autocapitalize="none" autocorrect="off">
  <label for="psk">Password</label><input id="psk" name="psk" type="password" maxlength="63" autocapitalize="none" autocorrect="off" placeholder="Leave blank if it has none">
  <p style="font-size:.9em">iPhone hotspot: turn on Maximize Compatibility.</p>
  <button>Save and join</button>
</form>

<h2>Saved Wi-Fi</h2>
${saved.length ? saved.map((s) => `<div class="card net"><span>${esc(s.ssid || s.name)}</span><form method="post" action="/forget"><input type="hidden" name="name" value="${esc(s.name)}"><button class="link">Forget</button></form></div>`).join("") : "<p>None yet.</p>"}

<h2>Bridge log</h2>
<div class="card"><code>${esc(bridge.recent.join("\n") || "Nothing yet.")}</code></div>
`);
}

function body(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (d) => { data += d; if (data.length > 4096) req.destroy(); });
    req.on("end", () => resolve(new URLSearchParams(data)));
  });
}

async function add(ssid, psk) {
  if (!ssid || Buffer.byteLength(ssid) > 32) return "That Wi-Fi name doesn't look right.";
  if (psk && (psk.length < 8 || psk.length > 63)) return "Wi-Fi passwords are 8 to 63 characters.";
  const con = `wifi-${ssid}`;
  await run("nmcli", ["con", "delete", con]);
  const sec = psk ? ["wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", psk] : [];
  const r = await run("nmcli", ["con", "add", "type", "wifi", "con-name", con, "ssid", ssid, ...sec, "connection.autoconnect", "yes", "connection.autoconnect-retries", "0"]);
  if (!r.ok) return `Couldn't save it: ${esc(r.err.trim())}`;
  // Answer first: switching closes this network and the phone drops off it.
  setTimeout(async () => {
    await run("nmcli", ["con", "down", SETUP_CON]);
    const up = await run("nmcli", ["con", "up", con], 45_000);
    console.log(up.ok ? `Joined ${ssid}` : `Couldn't join ${ssid}: ${up.err.trim()}`);
  }, 3000);
  return null;
}

const server = http.createServer(async (req, res) => {
  const local = (req.socket.localAddress || "").replace(/^::ffff:/, "");
  if (local !== HOTSPOT_IP && local !== "127.0.0.1") { res.writeHead(403).end(); return; }
  writeFileSync(`${STATE}/portal-seen`, "");
  try {
    let html;
    if (req.method === "POST" && req.url === "/add") {
      const f = await body(req);
      const ssid = (f.get("ssid") || "").trim();
      const err = await add(ssid, f.get("psk") || "");
      html = err
        ? await home(err)
        : page(`<h1>Saved ${esc(ssid)}</h1><p>The stand is closing this setup network and joining ${esc(ssid)} now. Your phone will drop off this network; that's expected.</p><p>Check Admin &gt; Receipts in a minute: the bridge should say online. If the password was wrong, this setup network comes back in about two minutes.</p>`);
    } else if (req.method === "POST" && req.url === "/forget") {
      const name = (await body(req)).get("name") || "";
      if ((await savedWifi()).some((s) => s.name === name)) await run("nmcli", ["con", "delete", name]);
      html = await home("Forgotten.");
    } else {
      html = await home();
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(html);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end(String(e?.message || e));
  }
});
server.listen(Number(process.env.PORT || 80), "0.0.0.0", () => console.log("Setup page listening"));
