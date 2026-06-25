-- Methodic Monday Brief — full setup. Paste this whole file into the Supabase
-- SQL editor and Run. It is schema.sql + rls.sql + generation_requests.sql in order.

-- ========================= schema.sql =========================
-- Methodic Monday Brief — database schema
-- Apply in the Supabase SQL editor (or via migration). Run rls.sql afterward.
-- Long format is used for metrics so new metrics can be added without schema changes.
-- Watchlist items use stable string slugs so a thread can be tracked across weeks.

create table if not exists briefs (
  id bigint generated always as identity primary key,
  week_of date not null unique,
  created_at timestamptz not null default now(),
  recap text,
  deep_cut_topic text,
  body_markdown text,
  raw_json jsonb
);

create table if not exists metrics (
  id bigint generated always as identity primary key,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  metric_key text not null,        -- fed_funds, sba_7a_effective, prime, conventional_acq_rate, ten_year_treasury
  value numeric,
  unit text,
  as_of_date date,
  source text
);

create table if not exists comps (
  id bigint generated always as identity primary key,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  company_name text,
  trade text,                      -- landscaping, hvac, plumbing, electrical, etc.
  location text,
  size_basis text,                 -- ebitda or revenue
  size_value numeric,
  multiple numeric,
  deal_value numeric,
  source text,
  notes text
);

create table if not exists watchlist_items (
  id text primary key,             -- stable slug, e.g. sba-sop-2026-revision
  title text not null,
  category text,                   -- rates, sba, landscaping, ma-regulatory, competitor, thesis
  status text,                     -- open, updated, closed
  current_summary text,
  created_week date,
  last_updated_week date
);

create table if not exists watchlist_updates (
  id bigint generated always as identity primary key,
  watchlist_item_id text references watchlist_items(id) on delete cascade,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  change_type text,                -- added, updated, closed
  update_text text
);

create table if not exists competitors (
  id bigint generated always as identity primary key,
  name text not null unique,
  type text,                       -- pe firm, search fund, holdco, platform, independent sponsor
  location text,
  first_seen_week date,
  last_seen_week date,
  last_action text,
  notes text
);

create table if not exists competitor_mentions (
  id bigint generated always as identity primary key,
  competitor_id bigint references competitors(id) on delete cascade,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  mention_text text
);

create table if not exists changelog (
  id bigint generated always as identity primary key,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  change_type text,                -- quantitative, qualitative
  text text
);

-- Helpful indexes for the dashboard's common access patterns.
create index if not exists idx_metrics_key_week on metrics (metric_key, week_of);
create index if not exists idx_metrics_brief on metrics (brief_id);
create index if not exists idx_comps_trade_week on comps (trade, week_of);
create index if not exists idx_comps_brief on comps (brief_id);
create index if not exists idx_watchlist_updates_item on watchlist_updates (watchlist_item_id, week_of);
create index if not exists idx_competitor_mentions_comp on competitor_mentions (competitor_id, week_of);
create index if not exists idx_changelog_week on changelog (week_of);
create index if not exists idx_briefs_week on briefs (week_of desc);

-- ========================= rls.sql ============================
-- Methodic Monday Brief — Row Level Security
-- Run this AFTER schema.sql.
--
-- Model: private single-user app.
--   * The generator (Mac mini) and any Next.js server code use the SERVICE ROLE key,
--     which bypasses RLS entirely. Those writes always work.
--   * The browser only ever uses the ANON key. We grant the anon role READ-ONLY access
--     so the dashboard can read directly via @supabase/supabase-js if desired.
--   * No role except service_role can write. Nothing is world-writable.
--
-- If you would rather the browser never touch Supabase directly, drop the anon
-- select policies below and read everything through Next.js server components using
-- the service role key. Either is safe; this file enables the simpler direct-read path.

alter table briefs              enable row level security;
alter table metrics             enable row level security;
alter table comps               enable row level security;
alter table watchlist_items     enable row level security;
alter table watchlist_updates   enable row level security;
alter table competitors         enable row level security;
alter table competitor_mentions enable row level security;
alter table changelog           enable row level security;

-- Read-only policies for the anon role (browser). Service role bypasses RLS.
create policy "anon read briefs"              on briefs              for select to anon using (true);
create policy "anon read metrics"             on metrics             for select to anon using (true);
create policy "anon read comps"               on comps               for select to anon using (true);
create policy "anon read watchlist_items"     on watchlist_items     for select to anon using (true);
create policy "anon read watchlist_updates"   on watchlist_updates   for select to anon using (true);
create policy "anon read competitors"         on competitors         for select to anon using (true);
create policy "anon read competitor_mentions" on competitor_mentions for select to anon using (true);
create policy "anon read changelog"           on changelog           for select to anon using (true);

-- No insert/update/delete policies are defined for anon, so the browser cannot write.
-- The generator writes with the service role key, which is not subject to these policies.

-- =================== generation_requests.sql ==================
-- Methodic Monday Brief — manual trigger queue.
-- Apply AFTER schema.sql (it references briefs). Adds the bridge that lets the
-- Vercel dashboard ask the Mac mini to run the generator on demand.
--
-- Flow: dashboard button -> /api/trigger inserts a 'queued' row (service_role,
-- server-side) -> the Mac mini watcher polls, claims it, runs the generator, and
-- writes status back.

create table if not exists generation_requests (
  id bigint generated always as identity primary key,
  requested_at timestamptz not null default now(),
  requested_for_week date,                 -- null = most recent Monday
  status text not null default 'queued',   -- queued | running | done | error
  source text default 'dashboard',
  claimed_at timestamptz,
  finished_at timestamptz,
  brief_id bigint references briefs(id) on delete set null,
  message text
);

create index if not exists idx_genreq_status on generation_requests (status, requested_at);

-- Locked down: RLS on, NO policies. Only the service_role key (the /api/trigger
-- route handler and the Mac mini watcher) can read or write this table. The
-- browser's anon key cannot touch it, so no one can enqueue runs with the public key.
alter table generation_requests enable row level security;
