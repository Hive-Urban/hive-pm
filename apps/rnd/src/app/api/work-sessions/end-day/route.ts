import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `(code ${e.code})` : null].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  return "unknown error";
}

// POST /api/work-sessions/end-day
// Bulk close every open work session — the "End of day" button on the
// team page. Affects the whole team in one shot. No body.
export async function POST() {
  try {
    const db = supabaseAdmin();
    const { error } = await db
      .from("rnd_work_sessions")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("work-sessions end-day error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
