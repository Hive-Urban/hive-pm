-- ================================================================
-- Hive PM Agent – Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Pillars (Strategic pillars from the vision deck) ─────────────
create table pillars (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  color       text not null default '#6366f1',
  icon        text,
  order_index int  not null default 0,
  created_at  timestamptz default now()
);

-- ── Products ──────────────────────────────────────────────────────
create table products (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  icon          text,
  pillar_id     uuid references pillars(id) on delete set null,
  area          text not null default 'core' check (area in ('core','research','production','other')),
  status        text not null default 'active' check (status in ('active','paused','archived')),
  notion_filter text,
  created_at    timestamptz default now()
);

-- ── Goals ─────────────────────────────────────────────────────────
create table goals (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  description text,
  pillar_id   uuid references pillars(id) on delete set null,
  product_id  uuid references products(id) on delete set null,
  start_date  date,
  end_date    date,
  status      text not null default 'not_started' check (status in ('not_started','in_progress','done','blocked')),
  progress    int  not null default 0 check (progress >= 0 and progress <= 100),
  created_at  timestamptz default now()
);

-- ── Sprints ───────────────────────────────────────────────────────
create table sprints (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  product_id  uuid references products(id) on delete set null,
  created_at  timestamptz default now()
);

-- ── Vision sections (editable text blocks) ────────────────────────
create table vision_sections (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  content    text,
  order_index int not null default 0,
  created_at  timestamptz default now()
);

-- ── Seed: default pillars (edit to match your real pillars) ───────
insert into pillars (name, description, color, icon, order_index) values
  ('Product Growth',    'Core product features & UX improvements',   '#6366f1', '🚀', 0),
  ('Research',          'User research, data & insights',             '#10b981', '🔬', 1),
  ('Infrastructure',    'Platform stability, performance & DevOps',   '#f59e0b', '⚙️', 2),
  ('Business',          'Revenue, partnerships & go-to-market',       '#ef4444', '💼', 3);

-- ── Row Level Security (basic – restrict to authenticated users) ──
alter table pillars         enable row level security;
alter table products        enable row level security;
alter table goals           enable row level security;
alter table sprints         enable row level security;
alter table vision_sections enable row level security;

create policy "Allow authenticated read"  on pillars         for select using (auth.role() = 'authenticated');
create policy "Allow authenticated write" on pillars         for all    using (auth.role() = 'authenticated');
create policy "Allow authenticated read"  on products        for select using (auth.role() = 'authenticated');
create policy "Allow authenticated write" on products        for all    using (auth.role() = 'authenticated');
create policy "Allow authenticated read"  on goals           for select using (auth.role() = 'authenticated');
create policy "Allow authenticated write" on goals           for all    using (auth.role() = 'authenticated');
create policy "Allow authenticated read"  on sprints         for select using (auth.role() = 'authenticated');
create policy "Allow authenticated write" on sprints         for all    using (auth.role() = 'authenticated');
create policy "Allow authenticated read"  on vision_sections for select using (auth.role() = 'authenticated');
create policy "Allow authenticated write" on vision_sections for all    using (auth.role() = 'authenticated');
