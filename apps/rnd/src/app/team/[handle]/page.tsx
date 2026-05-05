import { supabaseAdmin } from "@/lib/supabase";
import MemberDetail from "@/components/MemberDetail";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle).replace(/^@/, "");

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("rnd_members")
    .select(`
      *,
      rnd_member_skills (skill_id, level, notes),
      rnd_member_repos (repo_id, role, started_at, ended_at)
    `)
    .eq("handle", handle)
    .maybeSingle();

  if (!member) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-gray-500 mb-2">Member <code>@{handle}</code> not found.</p>
        <Link href="/team" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          ← Back to team
        </Link>
      </div>
    );
  }

  const [{ data: skills }, { data: categories }, { data: repos }] = await Promise.all([
    db.from("rnd_skills").select("id, name, category_id, order_index").order("order_index"),
    db.from("rnd_skill_categories").select("id, name, order_index, color").order("order_index"),
    db.from("rnd_repos").select("id, name, slug, color, status, order_index").order("order_index"),
  ]);

  return (
    <MemberDetail
      member={member}
      skills={skills ?? []}
      categories={categories ?? []}
      repos={repos ?? []}
    />
  );
}
