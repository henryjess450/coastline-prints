/**
 * Backs up the database and uploaded files into ./backups/<timestamp>/.
 * Safe while the site is running (uses SQLite's online backup).
 *   npm run backup
 */
import "dotenv/config";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const Database = require(require.resolve("better-sqlite3", { paths: [path.dirname(require.resolve("@prisma/adapter-better-sqlite3"))] }));

const dbFile = path.resolve((process.env.DATABASE_URL ?? "file:./coastline.db").replace(/^file:/, ""));
const storage = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const out = path.resolve("backups", stamp);
mkdirSync(out, { recursive: true });

const db = new Database(dbFile, { readonly: true, fileMustExist: true });
await db.backup(path.join(out, path.basename(dbFile)));
db.close();
if (existsSync(storage)) cpSync(storage, path.join(out, "storage"), { recursive: true });
console.log(`Backup saved to ${out}`);
