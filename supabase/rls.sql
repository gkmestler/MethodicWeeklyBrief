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
