import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { bridgeKeyOk, bridgeSeen, PRINTER_PROBLEMS, takeNextJob, waitForBridge, type BridgeReport } from "@/lib/receipt/bridge";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** How long a request waits for a job before answering empty. */
const HOLD_MS = 25_000;

/**
 * The print bridge asks here for the next thing to print
 * (bridge/print-bridge.mjs). The request stays open until a job is queued
 * or HOLD_MS passes, so a receipt prints within a second of the sale.
 * ?printer=ok|missing&host=<ip>&status=<problems>&v=<version> says how the
 * bridge is doing; with &take=0 it only reports (no job is handed out).
 */
export async function GET(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`print-bridge:${ip}`, 40, 60_000).ok) return apiError(429, "Too many requests.");
  if (!(await bridgeKeyOk(req.headers.get("authorization")))) return apiError(401, "Unknown bridge key.");

  const url = new URL(req.url);
  const printer = url.searchParams.get("printer");
  const report: BridgeReport = {
    ip,
    version: url.searchParams.get("v")?.slice(0, 20) ?? null,
    printer: printer === "ok" || printer === "missing" ? printer : null,
    printerHost: url.searchParams.get("host")?.slice(0, 60) ?? null,
    problems: (url.searchParams.get("status") ?? "").split(",").filter((p) => p in PRINTER_PROBLEMS),
  };

  if (url.searchParams.get("take") === "0") {
    bridgeSeen(report);
    return NextResponse.json({ job: null }, { headers: { "Cache-Control": "no-store" } });
  }

  bridgeSeen(report, 1);
  let job = null;
  try {
    const until = Date.now() + (url.searchParams.get("wait") === "0" ? 0 : HOLD_MS);
    while (!req.signal.aborted) {
      job = await takeNextJob();
      if (job || Date.now() >= until) break;
      // Woken straight away by queueBridgeJob; the timeout is just a safety net.
      await waitForBridge(Math.min(5_000, until - Date.now()), req.signal);
    }
  } finally {
    bridgeSeen(report, -1);
  }

  return NextResponse.json(
    { job: job ? { id: job.id, label: job.label, data: Buffer.from(job.bytes).toString("base64") } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
