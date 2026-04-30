// Shared client-side cache for Notion metadata keyed by notion_page_id.
// Used by PillarBlock, GanttChart, and the candidate picker so a single
// fetch covers every place that wants to render task IDs / priorities.

export type NotionMeta = {
  ids: Record<string, number>;
  priorities: Record<string, string>;
};

let cached: { meta: NotionMeta; at: number } | null = null;
const TTL_MS = 60_000;

async function loadNotionMeta(): Promise<NotionMeta> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.meta;
  try {
    const res = await fetch("/api/notion/id-map");
    if (!res.ok) return { ids: {}, priorities: {} };
    const data = await res.json();
    const meta: NotionMeta = {
      ids: data.map ?? {},
      priorities: data.priorities ?? {},
    };
    cached = { meta, at: Date.now() };
    return meta;
  } catch {
    return { ids: {}, priorities: {} };
  }
}

// Backwards-compat: many call sites only need the id map.
export async function loadNotionIdMap(): Promise<Record<string, number>> {
  const meta = await loadNotionMeta();
  return meta.ids;
}

export async function loadNotionMetaMap(): Promise<NotionMeta> {
  return loadNotionMeta();
}

export function clearNotionIdMapCache(): void {
  cached = null;
}
