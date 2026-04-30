// Shared client-side cache for the notion_page_id -> #N map.
// Used by both PillarBlock and GanttChart so a single fetch covers
// every place that wants to render task IDs.

let cached: { map: Record<string, number>; at: number } | null = null;
const TTL_MS = 60_000;

export async function loadNotionIdMap(): Promise<Record<string, number>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;
  try {
    const res = await fetch("/api/notion/id-map");
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, number> = data.map ?? {};
    cached = { map, at: Date.now() };
    return map;
  } catch {
    return {};
  }
}

export function clearNotionIdMapCache(): void {
  cached = null;
}
