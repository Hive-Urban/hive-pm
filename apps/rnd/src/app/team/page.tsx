import { supabaseAdmin } from "@/lib/supabase";
import TeamTable from "@/components/TeamTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const db = supabaseAdmin();
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const { view } = await searchParams;

  const [{ data: members }, { data: skills }, { data: repos }] = await Promise.all([
    db.from("rnd_members").select(`
      *,
      rnd_member_skills (skill_id, level),
      rnd_member_repos (repo_id, role)
    `).order("full_name"),
    db.from("rnd_skills").select("id, name, category_id"),
    db.from("rnd_repos").select("id, name, slug, color"),
  ]);

  // Resolve the viewer's member identity + role flags so the table can
  // gate expansion and clock-in/out actions.
  let viewerId: string | null = null;
  let viewerIsAdmin = false;
  let viewerIsManager = false;
  if (viewerEmail) {
    const me = (members ?? []).find(m => (m.email ?? "").toLowerCase() === viewerEmail);
    if (me) {
      viewerId = me.id as string;
      viewerIsAdmin = !!me.is_admin;
      viewerIsManager = !!me.is_manager;
    }
  }

  // Admins can explicitly switch into the manager view via ?view=manager
  // to preview exactly what a manager sees. Any other value (or absent)
  // = the natural view derived from the viewer's role.
  const forceManager = viewerIsAdmin && view === "manager";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between mb-6 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-1">
            HIVE · TEAM{forceManager ? " · MANAGER VIEW" : ""}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">R&amp;D Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            Who&apos;s working on what · skill highlights · projects.
          </p>
        </div>
        {viewerIsAdmin && (
          <nav className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
            <a href="/team"
              className={
                "px-3 py-1 text-xs rounded-md transition-colors " +
                (!forceManager ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800")
              }>
              Admin
            </a>
            <a href="/team?view=manager"
              className={
                "px-3 py-1 text-xs rounded-md transition-colors " +
                (forceManager ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-emerald-700")
              }>
              Manager
            </a>
          </nav>
        )}
      </div>

      <TeamTable
        members={members ?? []}
        skills={skills ?? []}
        repos={repos ?? []}
        viewerId={viewerId}
        viewerIsAdmin={viewerIsAdmin}
        viewerIsManager={viewerIsManager}
        viewMode={forceManager ? "manager" : "auto"}
      />
    </div>
  );
}
