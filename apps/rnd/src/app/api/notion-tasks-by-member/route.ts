import { NextResponse } from "next/server";
import { fetchNotionTasks } from "@/lib/notion";

// GET /api/notion-tasks-by-member
// Returns a map: { [assignee_name]: { active: NotionTask[], done: NotionTask[] } }
// Bucketed by current vs done status, so the team view can show counts and
// recent history without each member page re-fetching Notion separately.
export async function GET() {
  try {
    const tasks = await fetchNotionTasks();
    const byAssignee: Record<string, { active: typeof tasks; done: typeof tasks }> = {};
    for (const t of tasks) {
      const assignee = t.assignee?.trim();
      if (!assignee) continue;
      if (!byAssignee[assignee]) byAssignee[assignee] = { active: [], done: [] };
      const s = (t.status ?? "").toLowerCase();
      const isDone = s === "done" || s === "complete" || s.includes("approved");
      if (isDone) byAssignee[assignee].done.push(t);
      else byAssignee[assignee].active.push(t);
    }
    return NextResponse.json({ byAssignee });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ byAssignee: {}, error: msg }, { status: 500 });
  }
}
