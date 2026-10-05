/**
 * Starts the production server on PORT/HOST from .env (default 127.0.0.1:3100).
 * Works the same on Windows, macOS and Linux:  npm start
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.PORT || "3100";
const host = process.env.HOST || "127.0.0.1";

console.log(`Coastline Prints: starting on http://${host}:${port} (public: ${process.env.APP_URL ?? "not set"})`);
const child = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", host], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
