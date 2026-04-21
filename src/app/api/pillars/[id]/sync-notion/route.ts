import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchNotionTasks } from "@/lib/notion";

// Sync Notion tasks into a pillar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { notionTaskIds } = await req.json(); // array of notion page IDs to link

    const db = supabaseAdmin();

    // Fetch all tasks from Notion
    const allTasks = await fetchNotionTasks();
    const selected = allTasks.filter(t => notionTaskIds.includes(t.id));

    // Upsert into our tasks table
    const rows = selected.map(t => ({
      pillar_id: id,
      title: t.name,
      status: mapStatus(t.status),
      source: "notion" as const,
      notion_page_id: t.id,
      notion_url: t.page_url,
      assignee: t.assignee,
      sprint_name: t.sprint,
      tags: t.type ? [t.type] : [],
      product: t.product ?? null,
    }));

    const { data, error } = await db
      .from("tasks")
      .upsert(rows, { onConflict: "notion_page_id" })
      .select();

    if (error) throw error;
    return NextResponse.json({ tasks: data, count: data?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function mapStatus(s: string | null): "todo" | "in_progress" | "done" | "blocked" {
  if (!s) return "todo";
  const l = s.toLowerCase();
  if (l.includes("progress") || l.includes("working")) return "in_progress";
  if (l.includes("done") || l.includes("complete")) return "done";
  if (l.includes("block")) return "blocked";
  return "todo";
}
