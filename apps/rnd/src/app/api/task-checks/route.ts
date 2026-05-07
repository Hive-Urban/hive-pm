import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Supabase errors are PostgrestError plain objects, not JS Error instances —
// `err.message` alone hides the actual cause behind 'unknown error'. This
// helper extracts a readable string from anything we might catch.
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

// GET /api/task-checks?member_id=...
// Returns currently-open checks for one member (or all members if no filter).
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("member_id");
    const db = supabaseAdmin();
    let q = db.from("rnd_task_checks")
      .select("*")
      .is("ended_at", null);
    if (memberId) q = q.eq("member_id", memberId);
    const { data, error } = await q.order("started_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("task-checks GET error:", err);
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }
}

// POST /api/task-checks
//   body: { member_id, notion_page_id, notion_id?, notion_name? }
// Opens a check on a task. If a check is already open for the same
// (member, notion_page_id) pair, the unique partial index forces a no-op.
// Side effect: if the member has no open work session, we clock them in
// automatically — checking a task is an explicit "I'm working right now"
// signal and shouldn't require a separate Clock in click.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_id, notion_page_id, notion_id, notion_name, notes } = body ?? {};
    if (!member_id || !notion_page_id) {
      return NextResponse.json({ error: "member_id and notion_page_id required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_task_checks")
      .insert({
        member_id,
        notion_page_id,
        notion_id: typeof notion_id === "number" ? notion_id : null,
        notion_name: typeof notion_name === "string" ? notion_name : null,
        notes: notes ?? null,
      })
      .select()
      .single();
    let alreadyOpen = false;
    let checkRow = data;
    if (error) {
      if (error.code === "23505") {
        // Unique violation = the check is already open. That's fine, return existing.
        const { data: existing } = await db
          .from("rnd_task_checks")
          .select("*")
          .eq("member_id", member_id)
          .eq("notion_page_id", notion_page_id)
          .is("ended_at", null)
          .maybeSingle();
        checkRow = existing;
        alreadyOpen = true;
      } else {
        throw error;
      }
    }

    // Auto clock-in: only when the member has no open session right now.
    // We never close an existing session here — clock-out stays manual.
    let autoClockedIn = false;
    let clockError: string | null = null;
    try {
      const { data: openSession } = await db
        .from("rnd_work_sessions")
        .select("id")
        .eq("member_id", member_id)
        .is("ended_at", null)
        .maybeSingle();
      if (!openSession) {
        const { error: insertErr } = await db
          .from("rnd_work_sessions")
          .insert({ member_id });
        if (insertErr) clockError = insertErr.message;
        else autoClockedIn = true;
      }
    } catch (e: unknown) {
      clockError = e instanceof Error ? e.message : "auto clock-in failed";
    }

    return NextResponse.json({
      ok: true,
      check: checkRow,
      note: alreadyOpen ? "already open" : undefined,
      auto_clock_in: autoClockedIn,
      clock_error: clockError,
    });
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("task-checks POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/task-checks?member_id=...&notion_page_id=...
// Closes any open check for that member+page.
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("member_id");
    const pageId = url.searchParams.get("notion_page_id");
    if (!memberId || !pageId) {
      return NextResponse.json({ error: "member_id and notion_page_id required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { error } = await db
      .from("rnd_task_checks")
      .update({ ended_at: new Date().toISOString() })
      .eq("member_id", memberId)
      .eq("notion_page_id", pageId)
      .is("ended_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("task-checks DELETE error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
