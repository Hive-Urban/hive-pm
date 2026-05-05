import { supabaseAdmin } from "@/lib/supabase";
import TeamTable from "@/components/TeamTable";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const db = supabaseAdmin();
  const [{ data: members }, { data: skills }, { data: repos }] = await Promise.all([
    db.from("rnd_members").select(`
      *,
      rnd_member_skills (skill_id, level),
      rnd_member_repos (repo_id, role)
    `).order("full_name"),
    db.from("rnd_skills").select("id, name, category_id"),
    db.from("rnd_repos").select("id, name, slug, color"),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-1">HIVE · TEAM</p>
          <h1 className="text-3xl font-bold text-gray-900">R&amp;D Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            Who&apos;s working on what · skill highlights · projects.
          </p>
        </div>
      </div>

      <TeamTable
        members={members ?? []}
        skills={skills ?? []}
        repos={repos ?? []}
      />
    </div>
  );
}
