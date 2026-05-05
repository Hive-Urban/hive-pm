import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PUT /api/member-skills
//   body: { member_id: string, skills: Array<{ skill_id: string, level: 0|1|2|3|4|5 }> }
//
// Replaces the full set of skills for a member. level=0 means "remove".
// This is the simplest semantics for the editor UI: send the whole list,
// the server figures out inserts/updates/deletes.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_id, skills } = body ?? {};
    if (!member_id || !Array.isArray(skills)) {
      return NextResponse.json({ error: "member_id and skills[] required" }, { status: 400 });
    }
    const db = supabaseAdmin();

    const desiredKeep = skills.filter(s => Number.isFinite(s?.level) && s.level >= 1 && s.level <= 5);
    const desiredRemove = skills
      .filter(s => Number.isFinite(s?.level) && (s.level === 0 || s.level == null))
      .map(s => s.skill_id);

    if (desiredKeep.length > 0) {
      const rows = desiredKeep.map(s => ({
        member_id,
        skill_id: s.skill_id,
        level: Math.max(1, Math.min(5, Math.round(s.level))),
        notes: typeof s.notes === "string" ? s.notes : null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await db
        .from("rnd_member_skills")
        .upsert(rows, { onConflict: "member_id,skill_id" });
      if (error) throw error;
    }

    if (desiredRemove.length > 0) {
      const { error } = await db
        .from("rnd_member_skills")
        .delete()
        .eq("member_id", member_id)
        .in("skill_id", desiredRemove);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, kept: desiredKeep.length, removed: desiredRemove.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
