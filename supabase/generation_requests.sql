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
