import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { explicitSprintIndex } from "@/lib/sprints";

// POST /api/tasks/sprint-by-page-id
//   body: { ids: string[] }
// Returns: { sprintByPageId: { [notion_page_id]: number } }
// Body-based (rather than query string) so we can pass long ID lists
// without hitting URL length limits. Only entries with an explicit
// sprint:N tag end up in the result; everything else is omitted.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const filtered = ids.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (filtered.length === 0) {
      return NextResponse.json({ sprintByPageId: {} });
    }
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("tasks")
      .select("notion_page_id, tags")
      .in("notion_page_id", filtered);
    if (error) throw error;
    const out: Record<string, number> = {};
    for (const row of data ?? []) {
      const pageId = row.notion_page_id as string | null;
      if (!pageId) continue;
      const idx = explicitSprintIndex((row.tags ?? null) as string[] | null);
      if (idx != null) out[pageId] = idx;
    }
    return NextResponse.json({ sprintByPageId: out });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
