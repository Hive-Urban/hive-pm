"use client";
import { Goal, Sprint } from "@/types";
import { useMemo } from "react";
import { addDays, differenceInDays, format, startOfDay } from "date-fns";

type Props = {
  goals: (Goal & { pillar?: { name: string; color: string } | null; product?: { name: string } | null })[];
  sprints: Sprint[];
};

const statusColor: Record<string, string> = {
  not_started: "#374151",
  in_progress: "#6366f1",
  done: "#10b981",
  blocked: "#ef4444",
};

export default function GanttChart({ goals, sprints }: Props) {
  const allItems = useMemo(() => {
    const g = goals.map((g) => ({ ...g, _type: "goal" as const }));
    const s = sprints.map((s) => ({ ...s, _type: "sprint" as const, title: s.name, status: s.is_current ? "in_progress" : "not_started" as any, pillar: null, product: null, progress: 0 }));
    return [...s, ...g];
  }, [goals, sprints]);

  if (allItems.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-gray-800 rounded-xl">
        No goals or sprints with dates yet. Add them in the Vision page or Supabase.
      </div>
    );
  }

  const allDates = allItems.flatMap((i) => [new Date(i.start_date!), new Date(i.end_date!)]);
  const minDate = startOfDay(new Date(Math.min(...allDates.map((d) => d.getTime()))));
  const maxDate = startOfDay(new Date(Math.max(...allDates.map((d) => d.getTime()))));
  const totalDays = differenceInDays(maxDate, minDate) + 1;

  // Generate month markers
  const months: { label: string; left: number; width: number }[] = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    const start = differenceInDays(cur, minDate);
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const end = Math.min(differenceInDays(nextMonth, minDate), totalDays);
    months.push({
      label: format(cur, "MMM yyyy"),
      left: (start / totalDays) * 100,
      width: ((end - start) / totalDays) * 100,
    });
    cur = nextMonth;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Month header */}
        <div className="relative h-8 border-b border-gray-800 bg-gray-950">
          {months.map((m) => (
            <div
              key={m.label}
              className="absolute top-0 h-full flex items-center px-2 text-xs text-gray-500 border-r border-gray-800"
              style={{ left: `${m.left}%`, width: `${m.width}%` }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-800">
          {allItems.map((item) => {
            const start = differenceInDays(new Date(item.start_date!), minDate);
            const duration = differenceInDays(new Date(item.end_date!), new Date(item.start_date!)) + 1;
            const left = (start / totalDays) * 100;
            const width = Math.max((duration / totalDays) * 100, 0.5);
            const color = item._type === "sprint"
              ? "#f59e0b"
              : item.pillar?.color ?? statusColor[item.status] ?? "#6366f1";

            return (
              <div key={item.id} className="flex items-center h-12 px-4 gap-3 hover:bg-gray-800/50 group">
                {/* Label */}
                <div className="w-44 shrink-0 text-sm truncate">
                  <span className={item._type === "sprint" ? "text-amber-300 font-medium" : "text-gray-300"}>
                    {item.title}
                  </span>
                  {item._type === "goal" && item.pillar && (
                    <div className="text-xs text-gray-500 truncate">{item.pillar.name}</div>
                  )}
                </div>

                {/* Bar */}
                <div className="flex-1 relative h-6">
                  <div
                    className="absolute h-full rounded-md flex items-center px-2 text-xs text-white/80 truncate"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: color,
                      opacity: item._type === "sprint" ? 0.5 : 0.85,
                    }}
                    title={`${format(new Date(item.start_date!), "MMM d")} → ${format(new Date(item.end_date!), "MMM d")}`}
                  >
                    {width > 5 && item.title}
                  </div>
                </div>

                {/* Dates */}
                <div className="text-xs text-gray-600 w-28 text-right shrink-0">
                  {format(new Date(item.start_date!), "MMM d")} → {format(new Date(item.end_date!), "MMM d")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
