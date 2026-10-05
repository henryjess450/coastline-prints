import "server-only";
import { NextResponse } from "next/server";

/** Uniform JSON error that never leaks internals. */
export function apiError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function logError(scope: string, err: unknown) {
  console.error(`[${scope}]`, err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : err);
}
