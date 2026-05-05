import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_skill_categories")
      .select("*")
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
    const { name, order_index, color } = body ?? {};
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("rnd_skill_categories")
      .insert({
        name: String(name).trim(),
        order_index: Number.isFinite(order_index) ? Number(order_index) : 0,
        color: color ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, category: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
