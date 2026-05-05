import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/skills — all skills with their category
export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_skills")
      .select(`*, category:rnd_skill_categories(id, name, order_index, color)`)
      .order("order_index");
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }
}

// POST /api/skills — create new skill
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category_id, description, order_index } = body ?? {};
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_skills")
      .insert({
        name: String(name).trim(),
        category_id: category_id ?? null,
        description: description ?? null,
        order_index: Number.isFinite(order_index) ? Number(order_index) : 0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, skill: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
