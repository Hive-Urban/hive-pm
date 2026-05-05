import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Daily auto-end-of-work hour. Members are treated as not-working past this
// time even if they forgot to clock out. Configurable per env if you want
// to change the cutoff later.
const AUTO_END_HOUR = 20; // 20:00 local server time

// Computes "is this member currently working" without mutating the DB.
// Returns the active session (or null) — active = started today and either
// still open or ended_at > now AND current hour < cutoff.
function effectivelyActive(session: { started_at: string; ended_at: string | null } | null, now: Date): boolean {
  if (!session) return false;
  const start = new Date(session.started_at);
  if (start.toDateString() !== now.toDateString()) return false;
  if (now.getHours() >= AUTO_END_HOUR) return false;
  if (session.ended_at) {
    const end = new Date(session.ended_at);
    if (end <= now) return false;
  }
  return true;
}

// GET /api/work-sessions/today
// Returns: { byMember: { [member_id]: { active: boolean, started_at, ended_at } } }
export async function GET() {
  try {
    const db = supabaseAdmin();
    // Fetch the latest session per member from the past 24 hours. Postgres
    // doesn't have DISTINCT ON via supabase-js easily, so we just pull recent
    // and reduce in JS.
    const since = new Date();
    since.setHours(since.getHours() - 24);
    const { data, error } = await db
      .from("rnd_work_sessions")
      .select("id, member_id, started_at, ended_at")
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false });
    if (error) throw error;

    const now = new Date();
    const byMember: Record<string, { active: boolean; session_id: string | null; started_at: string | null; ended_at: string | null }> = {};
    for (const row of data ?? []) {
      if (byMember[row.member_id]) continue; // keep latest only
      byMember[row.member_id] = {
        active: effectivelyActive(row, now),
        session_id: row.id,
        started_at: row.started_at,
        ended_at: row.ended_at,
      };
    }
    return NextResponse.json({ byMember, autoEndHour: AUTO_END_HOUR });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ byMember: {}, error: msg }, { status: 500 });
  }
}

// POST /api/work-sessions  body: { member_id }
// Clocks the member in. Closes any prior open session first so we don't
// build up duplicates from forgotten clock-outs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_id } = body ?? {};
    if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });
    const db = supabaseAdmin();
    await db.from("rnd_work_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("member_id", member_id)
      .is("ended_at", null);
    const { data, error } = await db
      .from("rnd_work_sessions")
      .insert({ member_id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, session: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/work-sessions  body: { member_id }
// Clocks the member out (closes the open session for the member).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_id } = body ?? {};
    if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });
    const db = supabaseAdmin();
    const { error } = await db
      .from("rnd_work_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("member_id", member_id)
      .is("ended_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
