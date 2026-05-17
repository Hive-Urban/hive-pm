"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall, ExternalLink, Loader2 } from "lucide-react";
import clsx from "clsx";

type DoneSnapshot = {
  notion_page_id: string;
  notion_id: number | null;
  name: string;
  assignee: string | null;
  status: string | null;
  product: string | null;
};

type SamplingItem = {
  id: string;
  sampled_at: string;
  previous_sampled_at: string | null;
  newly_done: DoneSnapshot[];
  total_done: number;
};

const OPEN_KEY = "notionTasks:newlyDoneOpen";
const SPRINT_COUNT_KEY = "gantt:sprintCount";
const DEFAULT_SPRINT_COUNT = 4;

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

export default function NewlyDoneDigest() {
  const [items, setItems] = useState<SamplingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number>(0); // 0 = newest sampling
  const [open, setOpen] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY);
      if (v === "true") setOpen(true);
    } catch { /* noop */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(OPEN_KEY, String(open)); } catch { /* noop */ }
  }, [hydrated, open]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/notion/samplings?limit=50")
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          if (data.error) setError(String(data.error));
          else setError(null);
          setItems((data.items ?? []) as SamplingItem[]);
        })
        .catch(err => { if (!cancelled) setError(String(err?.message ?? err)); });
    }
    load();
    // Re-fetch when a refresh just recorded a new sampling. Reset the
    // cursor so the user lands on the newest sampling — the one they
    // just produced — instead of staying on whatever they were browsing.
    function onRefreshed() {
      setCursor(0);
      load();
    }
    window.addEventListener("hive:notion-refreshed", onRefreshed);
    return () => {
      cancelled = true;
      window.removeEventListener("hive:notion-refreshed", onRefreshed);
    };
  }, []);

  const active = useMemo(() => items?.[cursor] ?? null, [items, cursor]);
  const canGoOlder = items != null && cursor < items.length - 1;
  const canGoNewer = cursor > 0;

  // Sprint count mirrors the Gantt's localStorage value so the chip
  // dropdown lists exactly the sprints that exist in the gantt.
  const [sprintCount, setSprintCount] = useState<number>(DEFAULT_SPRINT_COUNT);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SPRINT_COUNT_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n > 0) setSprintCount(n);
    } catch { /* noop */ }
  }, []);

  // Sprint state for the *currently visible* sampling's tasks, keyed by
  // notion_page_id. Refetched whenever the active sampling changes.
  // Empty map until the lookup returns — chip falls back to "Sprint?".
  const [sprintByPageId, setSprintByPageId] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!active || active.newly_done.length === 0) {
      setSprintByPageId({});
      return;
    }
    const ids = active.newly_done.map(t => t.notion_page_id);
    let cancelled = false;
    fetch("/api/tasks/sprint-by-page-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSprintByPageId(data?.sprintByPageId ?? {});
      })
      .catch(() => { if (!cancelled) setSprintByPageId({}); });
    return () => { cancelled = true; };
  }, [active]);

  async function assignSprint(notionPageId: string, sprintIdx: number): Promise<void> {
    // Optimistic chip update — flips to the new sprint immediately,
    // rolls back if the server rejects.
    const prev = sprintByPageId[notionPageId];
    setSprintByPageId(s => ({ ...s, [notionPageId]: sprintIdx }));
    try {
      const res = await fetch("/api/tasks/pin-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notion_page_id: notionPageId, sprintIndex: sprintIdx }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setSprintByPageId(s => {
        const next = { ...s };
        if (prev == null) delete next[notionPageId];
        else next[notionPageId] = prev;
        return next;
      });
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 text-right">
          {open
            ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
            : <ChevronRightSmall size={14} className="text-gray-400 shrink-0" />}
          <span className="shrink-0"><CheckCircle2 size={16} className="text-emerald-500" /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Newly Done</span>
              {items === null && <Loader2 size={12} className="animate-spin text-gray-400" />}
              {items != null && active && (
                <span className="text-xs text-gray-400 tabular-nums">
                  · {active.newly_done.length} task{active.newly_done.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Tasks that flipped to Done/Approved between two consecutive Refresh Data clicks.
            </p>
          </div>
        </button>

        {items != null && items.length > 0 && (
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => canGoOlder && setCursor(c => c + 1)}
              disabled={!canGoOlder}
              title="Older sampling"
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-gray-500 tabular-nums px-1">
              {cursor + 1}/{items.length}
            </span>
            <button
              onClick={() => canGoNewer && setCursor(c => c - 1)}
              disabled={!canGoNewer}
              title="Newer sampling"
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-gray-100">
          {error && <p className="px-4 py-3 text-xs text-red-600">{error}</p>}
          {!error && items === null && (
            <p className="px-4 py-6 text-center text-xs text-gray-400">Loading samplings…</p>
          )}
          {!error && items != null && items.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-gray-400">
              No samplings recorded yet. Click <strong>Refresh Data</strong> to take the first sampling.
            </p>
          )}
          {!error && active && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 leading-snug">
                <div>
                  <span className="font-medium text-gray-700">Sampled:</span> {formatStamp(active.sampled_at)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Previous:</span> {formatStamp(active.previous_sampled_at)}
                  <span className="text-gray-400"> · total Done at this point: {active.total_done}</span>
                </div>
              </div>
              {active.newly_done.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-400">
                  No tasks flipped to Done in this interval.
                </p>
              ) : (
                <ul>
                  {active.newly_done.map(t => {
                    const url = notionPageUrl(t.notion_page_id);
                    const tooltipParts: string[] = [t.name];
                    if (t.status) tooltipParts.push(`Status: ${t.status}`);
                    if (t.assignee) tooltipParts.push(`Assignee: ${t.assignee}`);
                    if (t.product) tooltipParts.push(`Product: ${t.product}`);
                    return (
                      <li key={t.notion_page_id}
                        title={tooltipParts.join("\n")}
                        className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        {t.notion_id != null && (
                          <span className="text-[10px] font-mono text-gray-400 tabular-nums shrink-0 w-12">
                            #{t.notion_id}
                          </span>
                        )}
                        <span className="text-sm text-gray-700 flex-1 truncate">{t.name}</span>
                        {t.product && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                            {t.product}
                          </span>
                        )}
                        <span className={clsx(
                          "text-[10px] px-1.5 py-0.5 rounded border shrink-0",
                          t.assignee
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-gray-50 text-gray-400 border-gray-200 italic"
                        )}>
                          {t.assignee ?? "Unassigned"}
                        </span>
                        <SprintChip
                          current={sprintByPageId[t.notion_page_id] ?? null}
                          count={sprintCount}
                          onPick={idx => assignSprint(t.notion_page_id, idx)}
                        />
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-gray-300 hover:text-gray-600 shrink-0"
                          title="Open in Notion">
                          <ExternalLink size={11} />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Compact sprint picker. The native <select> overlay handles open/close,
// so we don't need to maintain a portal or click-outside listeners like
// the Hot tasks panel does. Trade-off: the dropdown is a system menu
// rather than a custom popover, but for a "Newly Done" retrospective
// chip that fits the row density better.
function SprintChip({ current, count, onPick }: {
  current: number | null;
  count: number;
  onPick: (idx: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const indices = useMemo(() => Array.from({ length: Math.max(1, count) }, (_, i) => i + 1), [count]);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const v = parseInt(e.target.value, 10);
    if (!Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    try { await onPick(v); } finally { setBusy(false); }
  }

  return (
    <label
      onClick={e => e.stopPropagation()}
      className={clsx(
        "relative inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border shrink-0 cursor-pointer",
        current != null
          ? "border-gray-200 text-gray-600 hover:border-gray-400"
          : "border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400"
      )}
      title={current != null ? `Sprint ${current} — change` : "Pin to a sprint"}
    >
      <span className="tabular-nums">{current != null ? `S${current}` : "Sprint?"}</span>
      {busy
        ? <Loader2 size={10} className="animate-spin" />
        : <ChevronDown size={10} className="opacity-60" />}
      <select
        value={current ?? ""}
        onChange={handleChange}
        disabled={busy}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="" disabled>Pick a sprint…</option>
        {indices.map(i => (
          <option key={i} value={i}>Sprint {i}</option>
        ))}
      </select>
    </label>
  );
}
