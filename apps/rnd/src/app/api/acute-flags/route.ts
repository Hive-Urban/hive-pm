import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/acute-flags
// Read-only mirror of the PM `pm_acute_flags` table so the R&D dashboard can
// show the same red highlighting for tasks the PM marked as acute. Writes
// happen exclusively from the PM app.
export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("pm_acute_flags")
      .select("notion_page_id");
    if (error) {
      console.warn("pm_acute_flags read error:", error.message);
      return NextResponse.json({ ids: [] });
    }
    const ids = (data ?? []).map((i: { notion_page_id: string }) => i.notion_page_id);
    return NextResponse.json({ ids });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ids: [], error: msg }, { status: 500 });
  }
}
