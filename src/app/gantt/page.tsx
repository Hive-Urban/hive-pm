import { supabase } from "@/lib/supabase";
import GanttChart from "@/components/gantt/GanttChart";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const { data: goals } = await supabase
    .from("goals")
    .select("*, pillar:pillars(name, color), product:products(name)")
    .not("start_date", "is", null)
    .not("end_date", "is", null)
    .order("start_date");

  const { data: sprints } = await supabase
    .from("sprints")
    .select("*")
    .order("start_date");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">📅 Gantt</h1>
        <p className="text-gray-400 mt-1">Timeline view of goals and sprints</p>
      </div>
      <GanttChart goals={goals ?? []} sprints={sprints ?? []} />
    </div>
  );
}
