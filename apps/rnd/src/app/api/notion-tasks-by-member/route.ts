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
      // A task can have multiple assignees in Notion; bucket it under each
      // person so anyone listed sees it on their row.
      const names = (t.assignees && t.assignees.length > 0
        ? t.assignees
        : t.assignee
          ? [t.assignee]
          : []
      )
        .map((n) => n?.trim())
        .filter((n): n is string => Boolean(n));
      if (names.length === 0) continue;
      const s = (t.status ?? "").toLowerCase();
      const isDone = s === "done" || s === "complete" || s.includes("approved");
      for (const name of names) {
        if (!byAssignee[name]) byAssignee[name] = { active: [], done: [] };
        if (isDone) byAssignee[name].done.push(t);
        else byAssignee[name].active.push(t);
      }
    }
    return NextResponse.json({ byAssignee });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ byAssignee: {}, error: msg }, { status: 500 });
  }
}
