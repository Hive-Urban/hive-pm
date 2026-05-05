import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Dead-simple work-session toggle. Click → green. Click again → gray.
// No daily auto-reset, no grace periods, no boundary math. If someone
// forgets to clock out, they stay green until they click out. We can
// add smarter logic later — for now correctness beats cleverness.

// GET /api/work-sessions
// Latest session per member from the last 30 days. active = ended_at IS NULL.
export async function GET() {
  try {
    const db = supabaseAdmin();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data, error } = await db
      .from("rnd_work_sessions")
      .select("id, member_id, started_at, ended_at")
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false });
    if (error) throw error;

    const byMember: Record<string, {
      active: boolean;
      session_id: string | null;
      started_at: string | null;
      ended_at: string | null;
    }> = {};
    for (const row of data ?? []) {
      if (byMember[row.member_id]) continue;
      byMember[row.member_id] = {
        active: row.ended_at == null,
        session_id: row.id,
        started_at: row.started_at,
        ended_at: row.ended_at,
      };
    }
    return NextResponse.json({ byMember });
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
