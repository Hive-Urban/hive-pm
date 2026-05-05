import { supabaseAdmin } from "@/lib/supabase";
import SkillMatrix from "@/components/SkillMatrix";

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  const db = supabaseAdmin();
  const [{ data: members }, { data: skills }, { data: categories }] = await Promise.all([
    db.from("rnd_members")
      .select("id, handle, full_name, role, rnd_member_skills (skill_id, level)")
      .eq("active", true)
      .order("full_name"),
    db.from("rnd_skills").select("id, name, category_id, order_index").order("order_index"),
    db.from("rnd_skill_categories").select("id, name, order_index, color").order("order_index"),
  ]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-1">HIVE · MATRIX</p>
        <h1 className="text-3xl font-bold text-gray-900">Skill Matrix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tech coverage across the team — darker = higher level.
        </p>
      </div>
      <SkillMatrix members={members ?? []} skills={skills ?? []} categories={categories ?? []} />
    </div>
  );
}
