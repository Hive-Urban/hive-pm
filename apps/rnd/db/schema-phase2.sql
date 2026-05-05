-- Hive R&D — Phase 2 schema additions.
-- Run after schema.sql (Phase 1) in the Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- Task checks — "I'm actively working on this Notion task right now."
-- Distinct from being merely *assigned* in Notion. A member can have many
-- checks open in parallel. Closing the check sets ended_at.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_task_checks (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references rnd_members(id) on delete cascade,
  notion_page_id  text not null,
  notion_id       int,                            -- the visible #N from Notion (display only)
  notion_name     text,                           -- task title at check time (display only)
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,                    -- null while currently checked
  notes           text
);
create index if not exists rnd_task_checks_member_open_idx
  on rnd_task_checks (member_id) where ended_at is null;
create unique index if not exists rnd_task_checks_unique_open_idx
  on rnd_task_checks (member_id, notion_page_id) where ended_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Work sessions — "I'm at work today."
-- A member clocks in (insert row), and either clocks out manually or the row
-- is treated as auto-ended at 20:00 of its start day. We don't actually
-- mutate ended_at automatically — we just compute the effective status at
-- read time so a forgotten clock-out doesn't pollute the next day.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_work_sessions (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references rnd_members(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text
);
create index if not exists rnd_work_sessions_member_open_idx
  on rnd_work_sessions (member_id) where ended_at is null;
create index if not exists rnd_work_sessions_member_started_idx
  on rnd_work_sessions (member_id, started_at desc);
