"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, CheckCircle2, Circle, Clock, LogIn, LogOut, RefreshCw, Sunset } from "lucide-react";

// Cache wrappers — instant first paint from localStorage, fresh fetch in
// the background. Manual Refresh button forces a re-fetch and updates the
// cache so the next visit also shows the latest state.
const CACHE_TASKS_KEY = "rnd:cache:tasks-by-member";
const CACHE_CHECKS_KEY = "rnd:cache:task-checks";
const CACHE_WORK_KEY = "rnd:cache:work-status";
const CACHE_ACUTE_KEY = "rnd:cache:acute-ids";

function loadCache<T>(key: string): { ts: number; data: T } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveCache(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* noop */ }
}
function formatAge(ts: number | null): string {
  if (ts == null) return "never";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

// Notion `Assigned to` is a free-form people name and doesn't always match
// the DB member.full_name verbatim. Normalize both sides before lookup so
// "Shai Yagur" matches "shai yagur" and " Shai  Yagur " etc.
function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type MemberSkill = { skill_id: string; level: number };
type MemberRepo = { repo_id: string; role: string | null };
type Member = {
  id: string;
  handle: string;
  full_name: string;
  notion_assignee_name?: string | null;
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

type TaskCheck = {
  id: string;
  member_id: string;
  notion_page_id: string;
  notion_id: number | null;
  notion_name: string | null;
  started_at: string;
};

type WorkStatus = {
  active: boolean;
  session_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export default function TeamTable({ members, skills, repos, viewerId = null, viewerIsAdmin = false }: {
  members: Member[];
  skills: Skill[];
  repos: Repo[];
  viewerId?: string | null;
  viewerIsAdmin?: boolean;
}) {
  const [tasks, setTasks] = useState<ByAssignee | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [checks, setChecks] = useState<TaskCheck[]>([]);
  const [workStatus, setWorkStatus] = useState<Record<string, WorkStatus>>({});
  const [autoEndHour, setAutoEndHour] = useState(19);
  // Acute task ids — owned by the PM app's pm_acute_flags table. We only
  // read it here so PM-flagged "right now" tasks render red in R&D too.
  const [acuteIds, setAcuteIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheTs, setCacheTs] = useState<number | null>(null);

  // Hydrate from localStorage so the dashboard paints immediately, no
  // multi-second wait while the (slow) Notion API call is in flight.
  // Then fetch fresh in the background.
  useEffect(() => {
    const t = loadCache<ByAssignee>(CACHE_TASKS_KEY);
    const c = loadCache<TaskCheck[]>(CACHE_CHECKS_KEY);
    const w = loadCache<{ byMember: Record<string, WorkStatus>; autoEndHour: number }>(CACHE_WORK_KEY);
    const a = loadCache<string[]>(CACHE_ACUTE_KEY);
    if (t) { setTasks(t.data); setCacheTs(t.ts); }
    if (c) setChecks(c.data);
    if (w) {
      setWorkStatus(w.data.byMember ?? {});
      if (w.data.autoEndHour) setAutoEndHour(w.data.autoEndHour);
    }
    if (a) setAcuteIds(new Set(a.data));
    void refresh(false);
  }, []);

  // refresh(showSpinner) — re-fetches all three endpoints, updates cache,
  // and sets the visible "refreshing" spinner only when the user asked
  // for it explicitly (not on background hydrate fetch).
  const refresh = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [tRes, cRes, wRes, aRes] = await Promise.all([
        fetch("/api/notion-tasks-by-member").then(r => r.json()).catch(err => ({ error: String(err?.message ?? err) })),
        fetch("/api/task-checks").then(r => r.json()).catch(() => ({ items: [] })),
        fetch("/api/work-sessions").then(r => r.json()).catch(() => ({ byMember: {} })),
        fetch("/api/acute-flags").then(r => r.json()).catch(() => ({ ids: [] })),
      ]);
      if (tRes?.error) setTaskError(String(tRes.error));
      else setTaskError(null);
      const tasksData = tRes?.byAssignee ?? {};
      const checksData = cRes?.items ?? [];
      const workData = { byMember: wRes?.byMember ?? {}, autoEndHour: wRes?.autoEndHour ?? 19 };
      const acuteList: string[] = Array.isArray(aRes?.ids) ? aRes.ids : [];
      setTasks(tasksData);
      setChecks(checksData);
      setWorkStatus(workData.byMember);
      if (workData.autoEndHour) setAutoEndHour(workData.autoEndHour);
      setAcuteIds(new Set(acuteList));
      saveCache(CACHE_TASKS_KEY, tasksData);
      saveCache(CACHE_CHECKS_KEY, checksData);
      saveCache(CACHE_WORK_KEY, workData);
      saveCache(CACHE_ACUTE_KEY, acuteList);
      setCacheTs(Date.now());
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  // Quick re-fetch of just task-checks + work-status — used after any
  // mutation (clock in/out, check/uncheck) so the UI reflects the change
  // without a full Notion re-fetch.
  const refreshLocal = useCallback(async () => {
    const [cRes, wRes] = await Promise.all([
      fetch("/api/task-checks").then(r => r.json()).catch(() => ({ items: [] })),
      fetch("/api/work-sessions").then(r => r.json()).catch(() => ({ byMember: {} })),
    ]);
    const checksData = cRes?.items ?? [];
    const workData = { byMember: wRes?.byMember ?? {}, autoEndHour: wRes?.autoEndHour ?? 19 };
    setChecks(checksData);
    setWorkStatus(workData.byMember);
    if (workData.autoEndHour) setAutoEndHour(workData.autoEndHour);
    saveCache(CACHE_CHECKS_KEY, checksData);
    saveCache(CACHE_WORK_KEY, workData);
  }, []);

  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const repoById = useMemo(() => new Map(repos.map(r => [r.id, r])), [repos]);

  // Map: member_id -> set of notion_page_ids currently checked
  const checksByMember = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of checks) {
      if (!m.has(c.member_id)) m.set(c.member_id, new Set());
      m.get(c.member_id)!.add(c.notion_page_id);
    }
    return m;
  }, [checks]);

  // Notion-assignee bucket lookup keyed by normalized name. Tolerates
  // case + spacing differences between Notion's `Assigned to` value and
  // the DB member.full_name.
  const tasksByNorm = useMemo(() => {
    if (!tasks) return null;
    const m = new Map<string, { active: NotionTask[]; done: NotionTask[] }>();
    for (const [name, bucket] of Object.entries(tasks)) {
      m.set(normalizeName(name), bucket);
    }
    return m;
  }, [tasks]);

  // A member can be addressed in Notion by either their full_name or by an
  // explicit `notion_assignee_name` override. We try both — earlier the
  // override *replaced* full_name, so e.g. an override of "Michael" hid
  // tasks where Notion actually wrote "Michael Marcus".
  const matchNamesOf = (m: Member): string[] => {
    const out = new Set<string>();
    const a = normalizeName(m.notion_assignee_name);
    const b = normalizeName(m.full_name);
    if (a) out.add(a);
    if (b) out.add(b);
    return [...out];
  };

  // Notion assignees that don't match any active member — diagnostic for
  // when "task #X assigned to me doesn't show up in my row" turns out to
  // be a name mismatch between Notion and the member roster.
  const memberNormNames = useMemo(
    () => new Set(members.flatMap(matchNamesOf)),
    [members]
  );
  const unknownAssignees = useMemo(() => {
    if (!tasks) return [] as string[];
    return Object.keys(tasks)
      .filter(name => !memberNormNames.has(normalizeName(name)))
      .sort();
  }, [tasks, memberNormNames]);

  // Merge buckets across all of a member's match names so a member listed
  // in Notion under either alias collects all their tasks in one place.
  function bucketFor(m: Member): { active: NotionTask[]; done: NotionTask[] } | undefined {
    if (!tasksByNorm) return undefined;
    const seen = new Set<string>();
    const active: NotionTask[] = [];
    const done: NotionTask[] = [];
    let hit = false;
    for (const n of matchNamesOf(m)) {
      const b = tasksByNorm.get(n);
      if (!b) continue;
      hit = true;
      for (const t of b.active) {
        if (seen.has(t.id)) continue;
        seen.add(t.id); active.push(t);
      }
      for (const t of b.done) {
        if (seen.has(t.id)) continue;
        seen.add(t.id); done.push(t);
      }
    }
    return hit ? { active, done } : undefined;
  }

  function canManage(memberId: string): boolean {
    return viewerIsAdmin || viewerId === memberId;
  }
  function canExpand(memberId: string): boolean {
    // Admin can expand anyone, regular members only themselves.
    return canManage(memberId);
  }

  function toggleExpand(memberId: string) {
    if (!canExpand(memberId)) return;
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  const [actionError, setActionError] = useState<string | null>(null);

  async function clockIn(memberId: string) {
    setBusy(`clock-in:${memberId}`);
    setActionError(null);
    try {
      const res = await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(`Clock in failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await refreshLocal();
    setBusy(null);
  }
  const [endingDay, setEndingDay] = useState(false);
  async function endDay() {
    if (!confirm("Clock out everyone? This closes every open work session for the whole team.")) return;
    setEndingDay(true);
    setActionError(null);
    try {
      const res = await fetch("/api/work-sessions/end-day", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(`End of day failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await refreshLocal();
    setEndingDay(false);
  }

  async function clockOut(memberId: string) {
    setBusy(`clock-out:${memberId}`);
    setActionError(null);
    try {
      const res = await fetch("/api/work-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(`Clock out failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await refreshLocal();
    setBusy(null);
  }
  async function check(memberId: string, t: NotionTask) {
    setBusy(`check:${memberId}:${t.id}`);
    setActionError(null);
    try {
      const res = await fetch("/api/task-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          notion_page_id: t.id,
          notion_id: t.notion_id,
          notion_name: t.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(`Check failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await refreshLocal();
    setBusy(null);
  }
  async function uncheck(memberId: string, pageId: string) {
    setBusy(`uncheck:${memberId}:${pageId}`);
    setActionError(null);
    try {
      const res = await fetch(`/api/task-checks?member_id=${memberId}&notion_page_id=${encodeURIComponent(pageId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(`Uncheck failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    await refreshLocal();
    setBusy(null);
  }

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
    <div className="space-y-3">
      {/* Refresh toolbar — instant page load from cache, manual refresh
          re-fetches Notion (slow) and updates the cache for next time. */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <button onClick={() => void refresh(true)}
          disabled={refreshing}
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors",
            refreshing
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          )}>
          {refreshing
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        {viewerIsAdmin && <button onClick={() => void endDay()}
          disabled={endingDay}
          title="Clock out every team member"
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors",
            endingDay
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-gray-200 bg-white text-gray-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
          )}>
          {endingDay
            ? <Loader2 size={13} className="animate-spin" />
            : <Sunset size={13} />}
          {endingDay ? "Ending…" : "End of day"}
        </button>}
        {cacheTs != null && (
          <span className="text-[11px] text-gray-400">
            Last updated: {formatAge(cacheTs)}
          </span>
        )}
        {taskError && (
          <span className="text-[11px] text-red-500">Error: {taskError}</span>
        )}
        {actionError && (
          <span className="text-[11px] text-red-600 font-medium">{actionError}</span>
        )}
      </div>

      {/* Unknown assignees — Notion names that don't match any roster member.
          If your task isn't showing up under your name, the most likely
          cause is the Notion 'Assigned to' value spelling not matching the
          member's full_name in the system. */}
      {unknownAssignees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-800">
          <span className="font-semibold">⚠️ Unknown Notion assignees:</span>{" "}
          {unknownAssignees.map((n, i) => (
            <span key={n}>
              <code className="bg-white px-1 py-0.5 rounded border border-amber-200">{n}</code>
              {i < unknownAssignees.length - 1 ? ", " : ""}
            </span>
          ))}
          <span className="ml-2 text-amber-700">
            — these names don&apos;t match any member. Update either Notion
            or the member&apos;s <strong>Full name</strong> in <Link href="/admin" className="underline">/admin</Link>.
          </span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-3 text-left w-[60px]" />
            <th className="px-3 py-3 text-left">Member</th>
            <th className="px-3 py-3 text-left">Working on</th>
            <th className="px-3 py-3 text-left">Top skills</th>
            <th className="px-3 py-3 text-left">Repos</th>
            <th className="px-3 py-3 text-right" />
          </tr>
        </thead>
        <tbody>
          {members.map(m => {
            const memberTasks = bucketFor(m);
            const active = memberTasks?.active ?? [];
            const done = memberTasks?.done ?? [];
            const memberChecks = checksByMember.get(m.id) ?? new Set<string>();
            const checkedActive = active.filter(t => memberChecks.has(t.id));
            // Compact view shows only the checked-on task (the one the
            // member explicitly clicked "I'm working on this"). Mere
            // assignment in Notion is not enough — expand the row to see
            // and check those.
            const primary = checkedActive[0] ?? null;
            const isExpanded = expanded.has(m.id);
            const status = workStatus[m.id];
            const isWorking = !!status?.active;

            // Dot next to the name signals clock-in status only.
            // The per-task green CheckCircle next to a Notion task is the
            // separate "this is what I'm actively working on" signal.
            const dotColor = isWorking ? "bg-emerald-500" : "bg-gray-300";

            const topSkills = (m.rnd_member_skills ?? [])
              .slice().sort((a, b) => b.level - a.level).slice(0, 4);
            const memberRepos = m.rnd_member_repos ?? [];

            return (
              <Row key={m.id}>
                {/* Compact row */}
                <tr className={clsx("border-t border-gray-100 hover:bg-gray-50/40", isExpanded && "bg-indigo-50/30")}>
                  <td className="px-3 py-3 align-top">
                    {canExpand(m.id) ? (
                      <button onClick={() => toggleExpand(m.id)}
                        className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded hover:bg-gray-100"
                        title={isExpanded ? "Collapse" : "Expand"}>
                        {isExpanded
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </button>
                    ) : (
                      <span className="inline-block w-[22px]" aria-hidden />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Link href={`/team/${encodeURIComponent(m.handle)}`} className="block group">
                      <div className="flex items-center gap-2">
                        <span className={clsx("w-2 h-2 rounded-full shrink-0", dotColor)}
                          title={isWorking ? `Working · ${checkedActive.length} checked / ${active.length} assigned` : "Off-duty"} />
                        <span className="font-semibold text-gray-900 group-hover:text-indigo-700">@{m.handle}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]" title={m.full_name}>
                        {m.full_name} {m.role && <>· {m.role}</>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {tasks === null ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Loader2 size={11} className="animate-spin" /> loading…
                      </span>
                    ) : taskError ? (
                      <span className="text-[11px] text-red-500">err</span>
                    ) : !primary ? (
                      <span className="text-[11px] text-gray-300 italic">
                        {active.length > 0
                          ? `${active.length} assigned · expand to check`
                          : "no current tasks"}
                      </span>
                    ) : (
                      <CompactTaskRow
                        memberId={m.id}
                        task={primary}
                        checked={memberChecks.has(primary.id)}
                        acute={acuteIds.has(primary.id)}
                        busy={busy === `check:${m.id}:${primary.id}` || busy === `uncheck:${m.id}:${primary.id}`}
                        onCheck={canManage(m.id) ? () => check(m.id, primary) : null}
                        onUncheck={canManage(m.id) ? () => uncheck(m.id, primary.id) : null}
                        suffix={
                          checkedActive.length > 1 ? (
                            <span className="text-[10px] text-emerald-600 ml-1">
                              +{checkedActive.length - 1} more checked · {active.length} assigned · {done.length} done
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 ml-1">
                              {active.length} assigned · {done.length} done
                            </span>
                          )
                        }
                      />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {topSkills.length === 0 ? (
                        <span className="text-[10px] text-gray-300 italic">—</span>
                      ) : (() => {
                        const visible = topSkills.slice(0, 3);
                        const hidden = topSkills.length - visible.length;
                        return (<>
                          {visible.map(s => {
                            const skill = skillById.get(s.skill_id);
                            if (!skill) return null;
                            return (
                              <span key={s.skill_id}
                                className={clsx(
                                  "text-[10px] px-1.5 py-0.5 rounded border tabular-nums whitespace-nowrap shrink-0",
                                  s.level === 5 ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
                                    : s.level === 4 ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                )}
                                title={`Level ${s.level}/5`}>
                                {skill.name} · {s.level}
                              </span>
                            );
                          })}
                          {hidden > 0 && (
                            <span className="text-[10px] text-gray-400 shrink-0">+{hidden}</span>
                          )}
                        </>);
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {memberRepos.length === 0 ? (
                        <span className="text-[10px] text-gray-300 italic">—</span>
                      ) : (() => {
                        const visible = memberRepos.slice(0, 3);
                        const hidden = memberRepos.length - visible.length;
                        return (<>
                          {visible.map(r => {
                            const repo = repoById.get(r.repo_id);
                            if (!repo) return null;
                            const hex = repo.color && repo.color.startsWith("#") ? repo.color : "#9ca3af";
                            return (
                              <span key={r.repo_id}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 whitespace-nowrap shrink-0">
                                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: hex }} />
                                {repo.name}
                              </span>
                            );
                          })}
                          {hidden > 0 && (
                            <span className="text-[10px] text-gray-400 shrink-0">+{hidden}</span>
                          )}
                        </>);
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                    {!canManage(m.id) ? (
                      isWorking ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                          ● Working{status?.started_at ? ` since ${formatStamp(status.started_at)}` : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-300 italic">—</span>
                      )
                    ) : isWorking ? (
                      <button onClick={() => clockOut(m.id)} disabled={busy?.startsWith("clock-out:" + m.id)}
                        title={status?.started_at ? `Clocked in at ${formatStamp(status.started_at)}` : "Clocked in"}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        {busy === `clock-out:${m.id}` ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
                        Out · {formatStamp(status?.started_at ?? null)}
                      </button>
                    ) : (
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <button onClick={() => clockIn(m.id)} disabled={busy?.startsWith("clock-in:" + m.id)}
                          title={status?.started_at ? `Last session started at ${formatStamp(status.started_at)} and was closed${status?.ended_at ? ` at ${formatStamp(status.ended_at)}` : ""}` : "Not clocked in today"}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50">
                          {busy === `clock-in:${m.id}` ? <Loader2 size={10} className="animate-spin" /> : <LogIn size={10} />}
                          Clock in
                        </button>
                        {status?.started_at && (
                          <span className="text-[9px] text-gray-400 italic">
                            last: {formatStamp(status.started_at)}{status.ended_at && ` → ${formatStamp(status.ended_at)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Expanded details */}
                {isExpanded && (
                  <tr className="bg-indigo-50/20 border-t border-indigo-100/60">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active tasks</h4>
                            <span className="text-[10px] text-gray-400">
                              {checkedActive.length} checked / {active.length} total
                            </span>
                          </div>
                          {active.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No active tasks in Notion.</p>
                          ) : (
                            <ul className="space-y-1">
                              {active.map(t => {
                                const isChecked = memberChecks.has(t.id);
                                const isAcute = acuteIds.has(t.id);
                                const taskBusy = busy === `check:${m.id}:${t.id}` || busy === `uncheck:${m.id}:${t.id}`;
                                return (
                                  <li key={t.id}
                                    className={clsx(
                                      "flex items-center gap-2 -mx-2 px-2 py-0.5 rounded",
                                      isAcute && "bg-red-50/60"
                                    )}>
                                    <button onClick={() => { if (!canManage(m.id)) return; if (isChecked) uncheck(m.id, t.id); else check(m.id, t); }}
                                      disabled={taskBusy}
                                      title={isChecked ? "Stop working" : "I'm working on this"}
                                      className="text-gray-400 hover:text-emerald-600 disabled:opacity-50 shrink-0">
                                      {taskBusy
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : isChecked
                                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                                          : <Circle size={14} />}
                                    </button>
                                    <a href={t.page_url} target="_blank" rel="noopener noreferrer"
                                      className={clsx(
                                        "flex items-center gap-1.5 text-[12px] hover:text-indigo-700 flex-1 min-w-0",
                                        isAcute ? "text-red-700 font-medium" : "text-gray-700"
                                      )}
                                      title={isAcute ? "Marked acute in PM" : undefined}>
                                      {t.notion_id != null && (
                                        <span className={clsx(
                                          "text-[10px] font-mono tabular-nums shrink-0",
                                          isAcute ? "text-red-500" : "text-gray-400"
                                        )}>
                                          #{t.notion_id}
                                        </span>
                                      )}
                                      <span className="truncate flex-1">{t.name}</span>
                                      {t.status && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                                          {t.status}
                                        </span>
                                      )}
                                      <ExternalLink size={10} className="text-gray-300 shrink-0" />
                                    </a>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock size={12} className="text-gray-400" />
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today</h4>
                          </div>
                          {status?.active ? (
                            <div className="text-[12px] text-gray-700">
                              <p>
                                <span className="text-emerald-700 font-medium">Clocked in</span> at{" "}
                                <span className="tabular-nums">{formatStamp(status.started_at)}</span>
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                Auto clock-out at {String(autoEndHour).padStart(2, "0")}:00.
                              </p>
                            </div>
                          ) : status?.started_at ? (
                            <p className="text-[12px] text-gray-500">
                              Last seen at <span className="tabular-nums">{formatStamp(status.started_at)}</span>.
                            </p>
                          ) : (
                            <p className="text-[12px] text-gray-400 italic">Not clocked in today.</p>
                          )}
                          <div className="mt-3 text-[10px] text-gray-400">
                            <p>Recently done ({done.length}):</p>
                            <ul className="space-y-0.5 mt-1 max-h-32 overflow-y-auto">
                              {done.slice(0, 5).map(t => (
                                <li key={t.id} className="text-[11px] text-gray-500 truncate">
                                  {t.notion_id != null && <span className="font-mono text-gray-400 mr-1">#{t.notion_id}</span>}
                                  {t.name}
                                </li>
                              ))}
                              {done.length > 5 && <li className="italic">+{done.length - 5} more</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Row>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Wrapper to allow keyed fragments inside <tbody> while React keeps complaining
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CompactTaskRow({ memberId, task, checked, acute = false, busy, onCheck, onUncheck, suffix }: {
  memberId: string;
  task: NotionTask;
  checked: boolean;
  acute?: boolean;
  busy: boolean;
  onCheck: (() => void) | null;
  onUncheck: (() => void) | null;
  suffix?: React.ReactNode;
}) {
  const interactable = checked ? !!onUncheck : !!onCheck;
  // Acute beats checked/default for the text + #id color, since the PM
  // has explicitly flagged this as a "right now" task and that signal
  // should dominate the row.
  return (
    <div className={clsx(
      "flex items-center gap-1.5 -mx-1 px-1 rounded",
      acute && "bg-red-50/60"
    )}>
      <button onClick={() => { if (checked) onUncheck?.(); else onCheck?.(); }}
        disabled={busy || !interactable}
        title={!interactable ? "Read-only — admin can change" : (checked ? "Stop working" : "I'm working on this")}
        className="text-gray-400 hover:text-emerald-600 disabled:opacity-50 disabled:hover:text-gray-400 shrink-0">
        {busy
          ? <Loader2 size={13} className="animate-spin" />
          : checked
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <Circle size={13} />}
      </button>
      <a href={task.page_url} target="_blank" rel="noopener noreferrer"
        className={clsx(
          "flex items-center gap-1.5 text-[12px] hover:text-indigo-700 min-w-0",
          acute ? "text-red-700 font-medium"
            : checked ? "text-emerald-700 font-medium"
            : "text-gray-700"
        )}
        title={acute ? "Marked acute in PM" : undefined}>
        {task.notion_id != null && (
          <span className={clsx(
            "text-[10px] font-mono tabular-nums shrink-0",
            acute ? "text-red-500"
              : checked ? "text-emerald-500"
              : "text-gray-400"
          )}>
            #{task.notion_id}
          </span>
        )}
        <span className="truncate max-w-[280px]">{task.name}</span>
        <ExternalLink size={10} className="text-gray-300 shrink-0" />
      </a>
      {suffix}
    </div>
  );
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
