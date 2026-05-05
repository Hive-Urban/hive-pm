"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Loader2, ExternalLink } from "lucide-react";

type MemberSkill = { skill_id: string; level: number };
type MemberRepo = { repo_id: string; role: string | null };
type Member = {
  id: string;
  handle: string;
  full_name: string;
  email: string;
  role: string | null;
  active: boolean;
  rnd_member_skills?: MemberSkill[];
  rnd_member_repos?: MemberRepo[];
};
type Skill = { id: string; name: string; category_id: string | null };
type Repo = { id: string; name: string; slug: string; color: string | null };

type NotionTask = {
  id: string;
  page_url: string;
  notion_id: number | null;
  name: string;
  status: string | null;
  product: string | null;
};
type ByAssignee = Record<string, { active: NotionTask[]; done: NotionTask[] }>;

export default function TeamTable({ members, skills, repos }: {
  members: Member[];
  skills: Skill[];
  repos: Repo[];
}) {
  const [tasks, setTasks] = useState<ByAssignee | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notion-tasks-by-member")
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) setTaskError(String(data.error));
        setTasks(data.byAssignee ?? {});
      })
      .catch(err => { if (!cancelled) setTaskError(String(err?.message ?? err)); });
    return () => { cancelled = true; };
  }, []);

  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const repoById = useMemo(() => new Map(repos.map(r => [r.id, r])), [repos]);

  if (members.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <p className="text-sm text-gray-500 mb-2">No team members yet.</p>
        <Link href="/admin" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          Add your first member →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left">Member</th>
            <th className="px-4 py-3 text-left">Role</th>
            <th className="px-4 py-3 text-left">Working on</th>
            <th className="px-4 py-3 text-left">Top skills</th>
            <th className="px-4 py-3 text-left">Repos</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members.map(m => {
            const memberTasks = tasks?.[m.full_name];
            const active = memberTasks?.active ?? [];
            const done = memberTasks?.done ?? [];
            const topSkills = (m.rnd_member_skills ?? [])
              .slice()
              .sort((a, b) => b.level - a.level)
              .slice(0, 4);
            const memberRepos = m.rnd_member_repos ?? [];
            const workloadColor = active.length === 0 ? "bg-gray-200"
              : active.length <= 3 ? "bg-emerald-500"
              : active.length <= 5 ? "bg-amber-500"
              : "bg-red-500";

            return (
              <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50/40">
                <td className="px-4 py-3 align-top">
                  <Link href={`/team/${encodeURIComponent(m.handle)}`} className="block">
                    <div className="flex items-center gap-2">
                      <span className={clsx("w-2 h-2 rounded-full shrink-0", workloadColor)} title={`${active.length} active tasks`} />
                      <span className="font-semibold text-gray-900">@{m.handle}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]" title={m.full_name}>
                      {m.full_name}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 align-top text-gray-600">
                  {m.role || <span className="text-gray-300 italic">—</span>}
                </td>
                <td className="px-4 py-3 align-top">
                  {tasks === null ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Loader2 size={11} className="animate-spin" /> loading…
                    </span>
                  ) : taskError ? (
                    <span className="text-[11px] text-red-500">err</span>
                  ) : active.length === 0 ? (
                    <span className="text-[11px] text-gray-300 italic">no current tasks</span>
                  ) : (
                    <div className="space-y-1">
                      {active.slice(0, 3).map(t => (
                        <a key={t.id} href={t.page_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[12px] text-gray-700 hover:text-indigo-700">
                          {t.notion_id != null && (
                            <span className="text-[10px] font-mono text-gray-400 tabular-nums shrink-0">
                              #{t.notion_id}
                            </span>
                          )}
                          <span className="truncate max-w-[280px]">{t.name}</span>
                          <ExternalLink size={10} className="text-gray-300 shrink-0" />
                        </a>
                      ))}
                      {active.length > 3 && (
                        <p className="text-[10px] text-gray-400">+{active.length - 3} more · {done.length} done</p>
                      )}
                      {active.length <= 3 && done.length > 0 && (
                        <p className="text-[10px] text-gray-400">{done.length} done</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {topSkills.length === 0 ? (
                      <span className="text-[10px] text-gray-300 italic">—</span>
                    ) : topSkills.map(s => {
                      const skill = skillById.get(s.skill_id);
                      if (!skill) return null;
                      return (
                        <span key={s.skill_id}
                          className={clsx(
                            "text-[10px] px-1.5 py-0.5 rounded border tabular-nums",
                            s.level === 5 ? "bg-violet-50 text-violet-700 border-violet-200"
                              : s.level === 4 ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          )}
                          title={`Level ${s.level}/5`}>
                          {skill.name} · {s.level}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {memberRepos.length === 0 ? (
                      <span className="text-[10px] text-gray-300 italic">—</span>
                    ) : memberRepos.map(r => {
                      const repo = repoById.get(r.repo_id);
                      if (!repo) return null;
                      const hex = repo.color && repo.color.startsWith("#") ? repo.color : "#9ca3af";
                      return (
                        <span key={r.repo_id}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: hex }} />
                          {repo.name}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <Link href={`/team/${encodeURIComponent(m.handle)}`}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800">
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
