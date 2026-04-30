// Single source of truth for sprint geometry.
// Both client (GanttChart) and server (sync-notion, assign, tasks routes)
// need to agree on which sprint is "current" so default tagging is consistent.

export const SPRINT_BASE_DATE = new Date(2026, 3, 19); // 19 April 2026
export const SPRINT_DAYS = 14;

export type Sprint = {
  index: number; // 1-based
  start: Date;
  end: Date;     // exclusive
};

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function buildSprints(count: number): Sprint[] {
  const out: Sprint[] = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(SPRINT_BASE_DATE, i * SPRINT_DAYS);
    const end = addDays(start, SPRINT_DAYS);
    out.push({ index: i + 1, start, end });
  }
  return out;
}

// Sprint index for a date — clamps to first/last sprint when out of range
export function sprintIndexAt(date: Date, count = 24): number {
  const all = buildSprints(count);
  if (date < all[0].start) return 1;
  for (const s of all) {
    if (date >= s.start && date < s.end) return s.index;
  }
  return all[all.length - 1].index;
}

export function currentSprintIndex(count = 24): number {
  return sprintIndexAt(new Date(), count);
}

export const SPRINT_TAG_PREFIX = "sprint:";

export function explicitSprintIndex(tags: string[] | null | undefined): number | null {
  if (!tags) return null;
  const tag = tags.find(t => t.startsWith(SPRINT_TAG_PREFIX));
  if (!tag) return null;
  const n = parseInt(tag.slice(SPRINT_TAG_PREFIX.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A task that was deliberately removed from a sprint carries `sprint:0`.
// It is NOT auto-assigned to the current sprint (unlike a fully-untagged
// task) so a "Clear sprint" action keeps cleared tasks hidden until the
// user decides where they belong.
export function isSprintCleared(tags: string[] | null | undefined): boolean {
  return !!tags?.includes(`${SPRINT_TAG_PREFIX}0`);
}

export function withSprintTag(tags: string[], sprintIdx: number): string[] {
  const without = tags.filter(t => !t.startsWith(SPRINT_TAG_PREFIX));
  return [...without, `${SPRINT_TAG_PREFIX}${sprintIdx}`];
}
