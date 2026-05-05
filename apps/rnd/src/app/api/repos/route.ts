import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_repos")
      .select(`*, rnd_member_repos (member_id, role, started_at, ended_at)`)
      .order("order_index");
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, tech_summary, status, color, order_index } = body ?? {};
    if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_repos")
      .insert({
        name: String(name).trim(),
        slug: String(slug).trim().toLowerCase(),
        description: description ?? null,
        tech_summary: tech_summary ?? null,
        status: status ?? "active",
        color: color ?? null,
        order_index: Number.isFinite(order_index) ? Number(order_index) : 0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, repo: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
