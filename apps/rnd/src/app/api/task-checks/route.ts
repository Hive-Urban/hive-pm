import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }
}

// POST /api/task-checks
//   body: { member_id, notion_page_id, notion_id?, notion_name? }
// Opens a check on a task. If a check is already open for the same
// (member, notion_page_id) pair, the unique partial index forces a no-op.
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
    if (error) {
      // Unique violation = the check is already open. That's fine, return existing.
      if (error.code === "23505") {
        const { data: existing } = await db
          .from("rnd_task_checks")
          .select("*")
          .eq("member_id", member_id)
          .eq("notion_page_id", notion_page_id)
          .is("ended_at", null)
          .maybeSingle();
        return NextResponse.json({ ok: true, check: existing, note: "already open" });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, check: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
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
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
