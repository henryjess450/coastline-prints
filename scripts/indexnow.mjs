// Tells Bing (and through it ChatGPT search), Yandex, Seznam and Naver that
// the site's pages changed, so they re-read them now instead of in weeks.
// Run after a deploy that changes public pages:
//   node scripts/indexnow.mjs              (uses https://coastlineprints.ca)
//   node scripts/indexnow.mjs https://other.example
import { readFileSync } from "node:fs";

const site = (process.argv[2] ?? process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, "");
const key = readFileSync(new URL("../config/site.ts", import.meta.url), "utf8").match(/indexNowKey:\s*"([0-9a-f]+)"/)?.[1];
if (!key) throw new Error("indexNowKey not found in config/site.ts");

const keyFile = await fetch(`${site}/${key}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== key) throw new Error(`${site}/${key}.txt isn't live yet. Deploy first.`);

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});
// 200 = accepted, 202 = accepted and the key is still being checked.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} pages`);
if (res.status >= 400) process.exitCode = 1;
