import { NextResponse } from "next/server";
import { syncNotionStatus } from "@/lib/sync-notion-status";

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string; body?: unknown };
    const parts = [e.message, e.details, e.hint, e.code ? `(code ${e.code})` : null].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  return "unknown error";
}

export async function POST() {
  try {
    const result = await syncNotionStatus();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("sync-from-notion error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
