"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import clsx from "clsx";

type State = "idle" | "syncing" | "ok" | "error";

export default function RefreshDataButton() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [updated, setUpdated] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    if (state === "syncing") return;
    setState("syncing");
    setUpdated(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sync-from-notion", { method: "POST" });
      if (!res.ok) {
        // Try to read the structured error first, fall back to raw text.
        const body = await res.json().catch(() => null);
        const text = body?.error ?? (await res.text().catch(() => `HTTP ${res.status}`));
        throw new Error(text);
      }
      const data = await res.json();
      setUpdated(typeof data?.updated === "number" ? data.updated : null);
      // Bust client-side Notion caches so subsequent renders refetch
      try {
        localStorage.removeItem("notion:meta-cache");
        localStorage.removeItem("notion:tasks-cache");
      } catch { /* noop */ }
      // Notify any client-only widgets (e.g. NewlyDoneDigest) that a fresh
      // sampling has been recorded — they re-fetch on this event.
      try {
        window.dispatchEvent(new CustomEvent("hive:notion-refreshed"));
      } catch { /* noop */ }
      setState("ok");
      router.refresh();
      setTimeout(() => setState("idle"), 2200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "unknown");
      setState("error");
      // Keep the error visible for longer so the user can read it.
      setTimeout(() => { setState("idle"); setErrorMsg(null); }, 8000);
    }
  }

  const label =
    state === "syncing" ? "מעדכן…"
    : state === "ok"     ? `עודכן${updated != null ? ` · ${updated}` : ""}`
    : state === "error"  ? "שגיאה"
    : "Refresh Data";

  const Icon =
    state === "ok"    ? Check
    : state === "error" ? AlertCircle
    : RefreshCw;

  return (
    <div className="inline-flex flex-col items-end gap-1 shrink-0">
      <button onClick={refresh}
        disabled={state === "syncing"}
        className={clsx(
          "inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-colors",
          state === "ok"    && "border-emerald-200 bg-emerald-50 text-emerald-700",
          state === "error" && "border-red-200 bg-red-50 text-red-700",
          (state === "idle" || state === "syncing") && "border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60",
        )}>
        <Icon size={13} className={state === "syncing" ? "animate-spin" : ""} />
        {label}
      </button>
      {state === "error" && errorMsg && (
        <span className="text-[10px] text-red-600 max-w-xs text-right" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
