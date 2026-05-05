import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const db = supabaseAdmin();
  const [{ data: repos }, { data: members }] = await Promise.all([
    db.from("rnd_repos").select(`
      *,
      rnd_member_repos (member_id, role, started_at, ended_at)
    `).order("order_index"),
    db.from("rnd_members").select("id, handle, full_name").eq("active", true),
  ]);

  const memberById = new Map((members ?? []).map(m => [m.id, m]));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-1">HIVE · REPOS</p>
        <h1 className="text-3xl font-bold text-gray-900">Projects &amp; Repos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active Hive projects, their stack, and who has worked on them.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(repos ?? []).map(r => {
          const hex = r.color && r.color.startsWith("#") ? r.color : "#6366f1";
          const team = (r.rnd_member_repos ?? [])
            .map((mr: { member_id: string; role: string | null }) => ({ ...mr, member: memberById.get(mr.member_id) }))
            .filter((x: { member: { handle: string } | undefined }) => x.member);
          return (
            <article key={r.id}
              className={clsx(
                "bg-white border rounded-2xl p-5 shadow-sm",
                r.status === "active" ? "border-gray-200" : "border-gray-100 opacity-70"
              )}>
              <div className="flex items-start gap-3 mb-3">
                <span className="w-3 h-3 rounded-md mt-1 shrink-0" style={{ backgroundColor: hex }} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">{r.name}</h2>
                  {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                </div>
                {r.status !== "active" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{r.status}</span>
                )}
              </div>
              {r.tech_summary && (
                <pre className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap font-sans text-gray-600 leading-relaxed">
{r.tech_summary}
                </pre>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Team</p>
                {team.length === 0
                  ? <p className="text-xs text-gray-400 italic">No one assigned yet.</p>
                  : (
                    <div className="flex flex-wrap gap-1.5">
                      {team.map((x: { member_id: string; role: string | null; member?: { handle: string } }) => (
                        <Link key={x.member_id} href={`/team/${encodeURIComponent(x.member!.handle)}`}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700">
                          @{x.member!.handle}
                          {x.role && <span className="text-gray-400">· {x.role}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
