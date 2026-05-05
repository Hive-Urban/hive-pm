import { supabaseAdmin } from "@/lib/supabase";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const db = supabaseAdmin();
  const [{ data: members }, { data: skills }, { data: categories }, { data: repos }] = await Promise.all([
    db.from("rnd_members").select("*").order("full_name"),
    db.from("rnd_skills").select(`*, category:rnd_skill_categories(id, name, color)`).order("order_index"),
    db.from("rnd_skill_categories").select("*").order("order_index"),
    db.from("rnd_repos").select("*").order("order_index"),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-1">HIVE · ADMIN</p>
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage members, skills, and repos.
        </p>
      </div>
      <AdminPanel
        members={members ?? []}
        skills={skills ?? []}
        categories={categories ?? []}
        repos={repos ?? []}
      />
    </div>
  );
}
