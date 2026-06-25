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
