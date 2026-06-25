# Methodic Monday Brief

A weekly intelligence brief for Methodic Ventures. Every Monday at 06:00 a
generator on an always-on Mac mini researches the week (Anthropic API + live web
search), writes a structured edition to Supabase, and a private Next.js dashboard
on Vercel renders the numbers, trends, watchlist, competitors, and archive.

Three pieces, one contract (the database schema):

```
generator/ (Mac mini, Python)  --writes-->  Supabase (Postgres)  <--reads--  web/ (Next.js on Vercel)
```

- **Generator** runs locally because a research-heavy LLM + web-search run takes
  minutes and would risk a serverless timeout on an unattended cron.
- **Supabase** is the memory. Each run reads the prior edition back in to produce
  a real recap and changelog, then writes the new edition.
- **Dashboard** only ever reads. No separate backend server.

---

## Repository layout

```
generator/   Python: research + generation, prompt, Supabase loader (runs on the Mac mini)
supabase/    schema.sql, rls.sql
web/         Next.js app (deploys to Vercel)
scripts/     run_brief.sh (manual trigger), install_launchd.sh, plist template
config/      config.toml (non-secret toggles), .env.example (secrets template)
Prompts/     the original Master Prompt spec
```

---

## Setup from scratch

### 1. Supabase (the database)

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**
   and, under Project Settings → API, the **anon** key and the **service_role** key.
2. Open the SQL editor and run, in order:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - `supabase/generation_requests.sql` (the manual-trigger queue)
3. RLS is now on for every table. The browser (anon key) can read but not write.
   The generator (service_role key) writes server-side and bypasses RLS.

### 2. Generator (the Mac mini)

Requires Python 3.11+ (for stdlib `tomllib`).

```bash
cd generator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

cp config/.env.example config/.env
# Edit config/.env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# (and the SMTP_* vars only if you turn email on later)
```

Non-secret toggles live in `config/config.toml` (model, buy box, email on/off,
local copies). It is safe to commit; secrets stay in `config/.env`, which is
gitignored.

Test a run without touching the database:

```bash
scripts/run_brief.sh --dry-run
```

This generates the brief, prints it, and writes copies to `generator/out/`. When
you are happy, do a real run (writes to Supabase):

```bash
scripts/run_brief.sh
# or for a specific week:
scripts/run_brief.sh --week-of 2026-06-22
```

Then inspect the `briefs`, `metrics`, `comps`, `watchlist_items`, `competitors`,
and `changelog` tables in Supabase. Run it a second time the following week (or
with a later `--week-of`) and confirm the recap and changelog reflect real deltas
against the prior edition.

### 3. Dashboard (local)

Run everything from the **project root** — the root `package.json` delegates into
`web/`, so you never need to `cd web`:

```bash
npm install              # installs web/ deps (via postinstall)
cp web/.env.local.example web/.env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (the ANON key, not service_role)
npm run dev              # http://localhost:3000
```

Root scripts: `npm run dev` / `build` / `start` / `lint` (the dashboard),
`npm run brief` / `brief:dry` (the generator). All delegate to the right place,
so the project root is the single entry point. `web/` stays self-contained, which
keeps the Vercel deploy (root directory = `web/`) unchanged.

### 4. Deploy the dashboard to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project** → import the repo → set the **Root Directory** to
   `web/`.
3. Add environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (reads; safe in the browser because RLS is on)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — powers the "Generate now" button's
     `/api/trigger` route). It must **not** have a `NEXT_PUBLIC_` prefix, so it is
     never sent to the browser. Omit it and the button shows "not configured"; the
     rest of the dashboard works fine.
4. Deploy. The dashboard reads live from Supabase. With an empty database it
   renders "no data yet" states; after the first generator run it fills in.

### 5. Schedule the weekly run (launchd)

On the Mac mini, from the repo root:

```bash
scripts/install_launchd.sh
```

This installs two launchd agents:
- `com.methodic.brief` — the weekly run, every Monday at 06:00 local. A run missed
  while the machine was asleep fires on wake. The wrapper retries once after 120s
  on failure and logs to `logs/`.
- `com.methodic.watcher` — polls the manual-trigger queue every 60s so a dashboard
  "Generate now" click runs within about a minute.

```bash
launchctl list | grep com.methodic.brief          # confirm loaded
launchctl kickstart -k gui/$(id -u)/com.methodic.brief   # run it right now
tail -f logs/run_brief.log                         # watch output
scripts/install_launchd.sh --uninstall             # remove the agent
```

### 6. Email (optional, off by default)

Set `[email].enabled = true` in `config/config.toml`, then put `SMTP_USER`,
`SMTP_APP_PASSWORD` (a Gmail [App Password](https://myaccount.google.com/apppasswords),
not your login password), and `EMAIL_TO` in `config/.env`. The brief is emailed
from the Mac mini after each successful run. Email failures are logged and never
fail the run.

---

## Daily / weekly operation

- The brief generates itself Monday 06:00. Read it on the dashboard, or in your
  inbox if email is on.
- **Trigger one on demand**, any of:
  - **Dashboard "Generate now" button** (top-right). It enqueues a request; the
    Mac mini watcher picks it up within ~60s and the button shows live status.
    Needs `SUPABASE_SERVICE_ROLE_KEY` set on Vercel and the watcher agent running.
  - `npm run brief` (real) or `npm run brief:dry` (no DB write), from the root.
  - `launchctl kickstart -k gui/$(id -u)/com.methodic.brief` to fire the scheduled job now.
  - To drain a queued dashboard request immediately instead of waiting for the
    poll: `launchctl kickstart -k gui/$(id -u)/com.methodic.watcher`.
- To regenerate a week manually: `scripts/run_brief.sh --week-of YYYY-MM-DD`.
  Re-running a week replaces that week's brief-scoped rows (metrics, comps,
  changelog, mentions) and keeps the persistent registries (watchlist items by
  slug, competitors by name).
- Logs: `logs/run_brief.log` (wrapper), `logs/generator.log` (Python),
  `logs/launchd.out.log` / `logs/launchd.err.log` (launchd).

---

## How the memory works

The model has no memory between runs. Each run:

1. Reads the most recent edition's metrics, open watchlist threads, and known
   competitors from Supabase.
2. Passes that prior context into the prompt (`generator/prompt.py`, the Appendix A
   template).
3. The model researches the week via web search and returns the new body, a recap
   of last week, a quantitative + qualitative changelog computed against the prior
   data, and an updated watchlist.
4. The loader (`generator/store.py`) validates and upserts: competitors on `name`,
   watchlist items on their slug `id`. A malformed record is logged and skipped,
   never crashing the run.

On the very first run there is no prior edition, so the recap and changelog render
as "first edition, baseline established."

---

## Adding a new tracked metric

The schema uses long format for metrics, so no migration is needed.

1. In `generator/prompt.py`, add the new metric to the instructions so the model
   emits it with a stable `metric_key` (snake_case, e.g. `ten_year_treasury`).
2. The loader writes any `metric_key` the model returns; nothing else changes
   server-side.
3. In the dashboard, add the new key wherever metrics are charted/labeled
   (`web/lib` query + the relevant chart/tile component). Existing rows for the new
   key start accumulating from the next run forward.

The five core keys are: `fed_funds`, `sba_7a_effective`, `prime`,
`conventional_acq_rate`, `ten_year_treasury`.

---

## Secrets and access control

- **anon key**: public, lives in the browser/Vercel. Safe only because RLS is on
  and grants read-only.
- **service_role key**: secret. Used only by the generator on the Mac mini. Never
  in the browser, never committed, never in Vercel for this app.
- **Anthropic key, SMTP creds**: `config/.env` on the Mac mini, gitignored.
- RLS is enabled on every table; the browser cannot write.

---

## Alternative: all-cloud (no Mac mini)

The default is the Mac mini. If you later retire it, move the generator logic into
a Next.js route handler with `maxDuration` set as high as your Vercel plan allows,
add a `vercel.json` cron entry for Monday, and guard the route so only the cron
invocation can trigger it. This trades operational simplicity for the risk that a
research-heavy run exceeds the serverless time limit, so it needs the Pro plan's
extended duration. The schema, loader logic, and dashboard are unchanged.

---

## Definition of done (from the spec)

- A manual run produces a complete brief and populates `briefs`, `metrics`,
  `comps`, `watchlist`, `competitors`, `changelog`.
- The second run reads the prior edition and produces a real recap and changelog.
- The dashboard is deployed on Vercel, reads live, all components render, and the
  cost-of-capital calculator computes DSCR off the latest live rates.
- The UI is monotone; charts use a small accent palette only.
- RLS is on, the service_role key never reaches the client, no secrets committed.
- The launchd agent is installed and a missed run recovers on wake.
