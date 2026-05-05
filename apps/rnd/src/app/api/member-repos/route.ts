import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PUT /api/member-repos
//   body: { member_id: string, repos: Array<{ repo_id: string, role?: string,
//                                              started_at?: string, ended_at?: string,
//                                              keep: boolean }> }
// Adds/updates entries where keep=true; removes entries where keep=false.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_id, repos } = body ?? {};
    if (!member_id || !Array.isArray(repos)) {
      return NextResponse.json({ error: "member_id and repos[] required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const upserts = repos
      .filter(r => r?.keep)
      .map(r => ({
        member_id,
        repo_id: r.repo_id,
        role: r.role ?? null,
        started_at: r.started_at ?? null,
        ended_at: r.ended_at ?? null,
      }));
    const removes = repos.filter(r => !r?.keep).map(r => r.repo_id);

    if (upserts.length > 0) {
      const { error } = await db
        .from("rnd_member_repos")
        .upsert(upserts, { onConflict: "member_id,repo_id" });
      if (error) throw error;
    }
    if (removes.length > 0) {
      const { error } = await db
        .from("rnd_member_repos")
        .delete()
        .eq("member_id", member_id)
        .in("repo_id", removes);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
