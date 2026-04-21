import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .eq("pillar_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ tasks: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("tasks")
      .insert({ ...body, pillar_id: id, source: "manual" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
