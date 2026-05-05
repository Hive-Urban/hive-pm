-- Hive R&D — schema + seed
-- Run once in Supabase SQL Editor for the same project as Hive PM.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Members
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_members (
  id          uuid primary key default uuid_generate_v4(),
  handle      text not null unique,             -- "@shai_y" stored as "shai_y"
  full_name   text not null,                    -- "Shai Yagur" — used to match Notion `Assigned to`
  email       text not null unique,
  slack_user_id text,                           -- Slack U…ID for DM notifications
  role        text,                             -- "Engineering Lead"
  photo_url   text,
  active      boolean not null default true,
  is_admin    boolean not null default false,
  joined_at   date,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists rnd_members_handle_idx on rnd_members (handle);
create index if not exists rnd_members_email_idx on rnd_members (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- Skills (with categories — easy to group later)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_skill_categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  order_index int not null default 0,
  color       text                              -- e.g. "#6366f1"
);

create table if not exists rnd_skills (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,             -- "Next.js", "Bedrock"
  category_id uuid references rnd_skill_categories(id) on delete set null,
  description text,
  order_index int not null default 0,
  created_at  timestamptz default now()
);

create index if not exists rnd_skills_category_idx on rnd_skills (category_id);

create table if not exists rnd_member_skills (
  member_id   uuid references rnd_members(id) on delete cascade,
  skill_id    uuid references rnd_skills(id) on delete cascade,
  level       int not null check (level between 1 and 5),
  notes       text,
  updated_at  timestamptz default now(),
  primary key (member_id, skill_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Repos (the 5 Hive projects + room to add more)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_repos (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  tech_summary text,                            -- multi-line summary of stack
  status      text not null default 'active' check (status in ('active','deprecated','archived')),
  color       text,
  order_index int not null default 0
);

create table if not exists rnd_member_repos (
  member_id   uuid references rnd_members(id) on delete cascade,
  repo_id     uuid references rnd_repos(id) on delete cascade,
  role        text,
  started_at  date,
  ended_at    date,
  primary key (member_id, repo_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assignment audit log (Phase 2+ — record dashboard-driven assignments)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rnd_assignment_log (
  id              uuid primary key default uuid_generate_v4(),
  notion_page_id  text not null,
  member_id       uuid references rnd_members(id) on delete set null,
  assigned_by     text,                         -- email of admin who triggered
  assigned_at     timestamptz default now(),
  slack_notified_at timestamptz,
  slack_message_ts text                          -- Slack ts for traceability
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: skill categories
-- ─────────────────────────────────────────────────────────────────────────────
insert into rnd_skill_categories (name, order_index, color) values
  ('Frontend',  10, '#6366f1'),
  ('Backend',   20, '#10b981'),
  ('Cloud',     30, '#f59e0b'),
  ('Data',      40, '#3b82f6'),
  ('Auth',      50, '#8b5cf6'),
  ('AI',        60, '#ec4899'),
  ('DevOps',    70, '#64748b')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: starter skills, derived from your 5 Hive projects
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  cat_frontend uuid;
  cat_backend  uuid;
  cat_cloud    uuid;
  cat_data     uuid;
  cat_auth     uuid;
  cat_ai       uuid;
  cat_devops   uuid;
begin
  select id into cat_frontend from rnd_skill_categories where name = 'Frontend';
  select id into cat_backend  from rnd_skill_categories where name = 'Backend';
  select id into cat_cloud    from rnd_skill_categories where name = 'Cloud';
  select id into cat_data     from rnd_skill_categories where name = 'Data';
  select id into cat_auth     from rnd_skill_categories where name = 'Auth';
  select id into cat_ai       from rnd_skill_categories where name = 'AI';
  select id into cat_devops   from rnd_skill_categories where name = 'DevOps';

  insert into rnd_skills (name, category_id, order_index) values
    -- Frontend
    ('Next.js',          cat_frontend, 10),
    ('React',            cat_frontend, 20),
    ('TypeScript',       cat_frontend, 30),
    ('Tailwind CSS',     cat_frontend, 40),
    ('Streamlit',        cat_frontend, 50),
    -- Backend
    ('FastAPI',          cat_backend,  10),
    ('Flask',            cat_backend,  20),
    ('Node.js',          cat_backend,  30),
    ('Python',           cat_backend,  40),
    ('AWS Lambda',       cat_backend,  50),
    ('API Gateway',      cat_backend,  60),
    -- Cloud
    ('AWS',              cat_cloud,    10),
    ('Render',           cat_cloud,    20),
    ('ECS Fargate',      cat_cloud,    30),
    ('AWS Amplify',      cat_cloud,    40),
    ('EventBridge',      cat_cloud,    50),
    ('S3',               cat_cloud,    60),
    ('AWS WAF',          cat_cloud,    70),
    -- Data
    ('Postgres',         cat_data,     10),
    ('DynamoDB',         cat_data,     20),
    ('Supabase',         cat_data,     30),
    -- Auth
    ('Auth0',            cat_auth,     10),
    ('NextAuth.js',      cat_auth,     20),
    ('JWT',              cat_auth,     30),
    ('OAuth 2.0',        cat_auth,     40),
    -- AI
    ('Bedrock (Claude)', cat_ai,       10),
    ('Gemini',           cat_ai,       20),
    ('OpenAI',           cat_ai,       30),
    ('LLM Prompting',    cat_ai,       40),
    -- DevOps
    ('Docker',           cat_devops,   10),
    ('Git',              cat_devops,   20),
    ('CI/CD',            cat_devops,   30),
    ('Monorepo',         cat_devops,   40)
  on conflict (name) do nothing;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: the 5 Hive repos
-- ─────────────────────────────────────────────────────────────────────────────
insert into rnd_repos (name, slug, description, tech_summary, status, color, order_index) values
  (
    'Hivedashboard',
    'hivedashboard',
    'Surveys and boards platform.',
    E'Server: Lambda + API Gateway, WAF, Auth0\nAI: Bedrock (Claude) + Gemini\nData: Postgres + DynamoDB + S3\nClient: Next.js on AWS Amplify',
    'active', '#6366f1', 10
  ),
  (
    'Political Radar',
    'political-radar',
    'Public-facing political analysis tool.',
    E'Server: Flask on ECS Fargate, private network + public LB\nAuth: homemade JWT\nData: Postgres\nClient: Next.js on ECS Fargate',
    'active', '#ef4444', 20
  ),
  (
    'Hivemind',
    'hivemind',
    'Survey panel platform (monorepo).',
    E'Server: FastAPI on Render, homemade auth\nData: Postgres via private link\nClient: Next.js on Render',
    'active', '#10b981', 30
  ),
  (
    'Streamlit',
    'streamlit-tools',
    'Internal Streamlit-based tools (monorepo).',
    E'Backend + Frontend: Streamlit\nDeployed on private ECS Fargate behind public LB\nData: Postgres',
    'active', '#f59e0b', 40
  ),
  (
    'Ingestion',
    'ingestion',
    'Data ingestion pipelines (monorepo).',
    E'Serverless Lambda functions\nCron triggered by EventBridge\nData: S3 + Postgres',
    'active', '#8b5cf6', 50
  )
on conflict (name) do nothing;
