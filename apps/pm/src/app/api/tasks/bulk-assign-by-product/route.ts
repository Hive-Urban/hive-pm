import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchNotionTasks } from "@/lib/notion";
import { currentSprintIndex, SPRINT_TAG_PREFIX } from "@/lib/sprints";

function mapStatus(s: string | null): "todo" | "in_progress" | "done" | "blocked" {
  if (!s) return "todo";
  const l = s.toLowerCase();
  if (l.includes("progress") || l.includes("working")) return "in_progress";
  if (l.includes("done") || l.includes("complete") || l.includes("approved")) return "done";
  if (l.includes("block")) return "blocked";
  return "todo";
}

// POST /api/tasks/bulk-assign-by-product
//   body: { product: string, pillar_id: string, scope?: "unassigned" | "all" }
// Assigns every Notion task tagged with `product` to the chosen pillar in
// a single operation. Default scope is "unassigned" — only tasks that
// have no DB row OR a row with pillar_id = null get moved. "all" forces
// reassigment even if the task is already on a different pillar.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: string | undefined = body?.product?.trim();
    const pillarId: string | undefined = body?.pillar_id?.trim();
    const scope: "unassigned" | "all" = body?.scope === "all" ? "all" : "unassigned";
    if (!product) return NextResponse.json({ error: "product required" }, { status: 400 });
    if (!pillarId) return NextResponse.json({ error: "pillar_id required" }, { status: 400 });

    const db = supabaseAdmin();
    const { data: pillar, error: pillarErr } = await db
      .from("pillars")
      .select("id")
      .eq("id", pillarId)
      .maybeSingle();
    if (pillarErr) throw pillarErr;
    if (!pillar) return NextResponse.json({ error: "pillar not found" }, { status: 404 });

    const all = await fetchNotionTasks();
    const productLower = product.toLowerCase();
    const matching = all.filter(t => (t.product ?? "").toLowerCase() === productLower);
    if (matching.length === 0) {
      return NextResponse.json({ ok: true, moved: 0, created: 0, skipped: 0, matched: 0 });
    }

    const pageIds = matching.map(t => t.id);
    const { data: existing, error: exErr } = await db
      .from("tasks")
      .select("id, notion_page_id, pillar_id")
      .in("notion_page_id", pageIds);
    if (exErr) throw exErr;
    const existingByPage = new Map<string, { id: string; pillar_id: string | null }>(
      (existing ?? []).map(r => [r.notion_page_id as string, { id: r.id as string, pillar_id: r.pillar_id as string | null }])
    );

    const sprintTag = `${SPRINT_TAG_PREFIX}${currentSprintIndex()}`;
    let moved = 0;
    let created = 0;
    let skipped = 0;

    for (const t of matching) {
      const row = existingByPage.get(t.id);
      if (row) {
        const isUnassigned = row.pillar_id == null;
        if (scope === "unassigned" && !isUnassigned) {
          skipped++;
          continue;
        }
        const { error: upErr } = await db
          .from("tasks")
          .update({ pillar_id: pillarId })
          .eq("id", row.id);
        if (upErr) throw upErr;
        moved++;
      } else {
        const tags: string[] = [];
        if (t.type) tags.push(t.type);
        if (t.status && t.status.toLowerCase().includes("approved")) tags.push("notion:approved");
        tags.push(sprintTag);
        const newRow = {
          pillar_id: pillarId,
          title: t.name,
          status: mapStatus(t.status),
          source: "notion" as const,
          notion_page_id: t.id,
          notion_url: t.page_url,
          assignee: t.assignee,
          sprint_name: t.sprint,
          tags,
          product: t.product ?? null,
          due_date: t.due_date ?? null,
        };
        const { error: insErr } = await db.from("tasks").insert(newRow);
        if (insErr) throw insErr;
        created++;
      }
    }

    return NextResponse.json({
      ok: true,
      matched: matching.length,
      moved,
      created,
      skipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("bulk-assign-by-product error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
