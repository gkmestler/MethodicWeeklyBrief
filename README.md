# Methodic Monday Brief

A weekly intelligence brief for Methodic Ventures. Every Monday a generator runs
in **GitHub Actions**, researches the week (Anthropic API + live web search),
writes a structured edition to Supabase, and a private Next.js dashboard on Vercel
renders the numbers, trends, watchlist, competitors, and archive.

Three pieces, one contract (the database schema):

```
generator/ (Python, GitHub Actions)  --writes-->  Supabase (Postgres)  <--reads--  web/ (Next.js on Vercel)
```

- **Generator** runs in GitHub Actions (Python). A research-heavy LLM + web-search
  run takes minutes, so it runs in a CI job with a 30-minute budget rather than a
  short serverless function. It fires on a weekly cron, on a manual
  `workflow_dispatch`, or on a `repository_dispatch` from the dashboard button.
- **Supabase** is the memory. Each run reads the prior edition back in to produce
  a real recap and changelog, then writes the new edition.
- **Dashboard** only ever reads Supabase. Its one write path is the "Generate now"
  button, whose `/api/trigger` route enqueues a request and dispatches the Actions
  workflow. No standalone backend server.

> The generator is plain Python and also runs locally or on a Mac mini via launchd
> (see `scripts/` and the "Alternative" section below). GitHub Actions is the
> default cloud host; the launchd path is the documented alternative.

---

## Repository layout

```
generator/          Python: research + generation, prompt, Supabase loader, trigger watcher
supabase/           schema.sql, rls.sql, generation_requests.sql, apply_all.sql
web/                Next.js app (deploys to Vercel); /api/trigger dispatches the workflow
.github/workflows/  brief.yml — the cloud generator (schedule / manual / dashboard button)
scripts/            run_brief.sh, run_watcher.sh, install_launchd.sh (Mac mini alternative)
config/             config.toml (non-secret toggles), .env.example (secrets template)
Prompts/            the original Master Prompt spec
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

### 2. Generator (local testing; runs in GitHub Actions in production)

In production the generator runs in GitHub Actions (step 5). For local testing or
a Mac mini run, set it up directly. Requires Python 3.11+ (for stdlib `tomllib`).

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

1. Push this repo to GitHub (already done if you cloned it from GitHub).
2. In Vercel, **New Project** → import the repo → **set the Root Directory to
   `web`.** This is required: the Next.js app lives in `web/`, not the repo root,
   and Vercel must run its Next.js build there for SSR and the `/api/trigger` route
   handler to work. (Leave the framework preset as **Next.js**; build and output
   settings stay default.)
3. Add environment variables in the Vercel project settings (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (reads; safe in the browser because
     RLS is on).
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, no `NEXT_PUBLIC_` prefix. The
     `/api/trigger` route uses it to enqueue requests. Never exposed to the browser.
   - `GITHUB_REPO` — `gkmestler/MethodicWeeklyBrief` (the `owner/name` of this repo).
   - `GITHUB_DISPATCH_TOKEN` — a GitHub token allowed to dispatch workflows
     (fine-grained: this repo, **Contents: read and write**; or a classic token with
     the `repo` scope). Server-only.
   The two `GITHUB_*` vars power the "Generate now" button. Omit them and the button
   reports "GitHub trigger not configured"; the rest of the dashboard still works.
4. Deploy. The dashboard reads live from Supabase. With an empty database it
   renders "no data yet" states; after the first generator run it fills in.

To verify the deploy end to end: open the deployed URL (empty states render),
then click **Generate now** — it should flip to *Generating…*, the
**Generate Brief** workflow should appear under the repo's Actions tab, and when it
finishes the button resolves and a `briefs` row appears.

### 5. Schedule the weekly run (GitHub Actions — primary)

The generator runs in CI via `.github/workflows/brief.yml`. No servers to manage.

1. In the GitHub repo, add **Settings → Secrets and variables → Actions** secrets:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (optional, only if email is on) `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_TO`
2. The workflow fires three ways:
   - **schedule** — `cron: "0 11 * * 1"` (Mondays, ~6–7am ET; cron ignores DST).
   - **workflow_dispatch** — manual run from the Actions tab, optional `week_of`.
   - **repository_dispatch** (`generate-brief`) — the dashboard button. On this
     event the job runs `python -m generator.watch_triggers`, which claims the
     queued request, generates, and writes status back so the button resolves.

A `concurrency` group prevents two generations from running at once.

### 5b. Alternative scheduler: Mac mini (launchd)

If you would rather run the generator on an always-on Mac instead of GitHub Actions,
the same Python ships with launchd agents. From the repo root on that machine:

```bash
scripts/install_launchd.sh        # installs com.methodic.brief + com.methodic.watcher
launchctl kickstart -k gui/$(id -u)/com.methodic.brief    # run it right now
scripts/install_launchd.sh --uninstall                    # remove the agents
```

`com.methodic.brief` runs Monday 06:00 local (missed runs fire on wake);
`com.methodic.watcher` polls the manual-trigger queue every 60s. Use this **or**
GitHub Actions, not both, so the weekly run isn't duplicated.

### 6. Email (optional, off by default)

Set `[email].enabled = true` in `config/config.toml`, then provide `SMTP_USER`,
`SMTP_APP_PASSWORD` (a Gmail [App Password](https://myaccount.google.com/apppasswords),
not your login password), and `EMAIL_TO` — as GitHub Actions secrets for the cloud
run, or in `config/.env` for local/Mac runs. The brief is emailed after each
successful run. Email failures are logged and never fail the run.

---

## Daily / weekly operation

- The brief generates itself every Monday via the GitHub Actions cron. Read it on
  the dashboard, or in your inbox if email is on.
- **Trigger one on demand**, any of:
  - **Dashboard "Generate now" button** (top-right). It enqueues a request and
    dispatches the GitHub Actions workflow, which runs the generator and writes
    status back; the button shows live status (Generating… → done/error). Needs
    `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_REPO`, and `GITHUB_DISPATCH_TOKEN` set on
    Vercel, plus the Actions secrets from step 5.
  - **GitHub Actions tab** → *Generate Brief* → *Run workflow* (optional `week_of`).
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
- **service_role key**: secret. Used by the generator (a GitHub Actions secret) and
  by the `/api/trigger` route on Vercel as a **server-only** env var. Never in the
  browser, never committed.
- **Anthropic key, SMTP creds**: GitHub Actions secrets for the cloud run; or
  `config/.env` (gitignored) for local/Mac runs.
- **GitHub dispatch token**: a server-only Vercel env var (`GITHUB_DISPATCH_TOKEN`)
  so the button can dispatch the workflow. Scope it to this repo only.
- RLS is enabled on every table; the browser cannot write.

---

## Alternative: Mac mini instead of GitHub Actions

GitHub Actions is the default generator host. If you would rather run the generator
on an always-on Mac, the same Python ships with launchd agents (see step 5b): one
weekly agent and one queue watcher. In that setup the dashboard button's workflow
dispatch is unnecessary — the local watcher drains the queue instead. Use one host
or the other, not both, so the weekly run isn't duplicated. The schema, loader
logic, and dashboard are identical either way.

---

## Definition of done (from the spec)

- A manual run produces a complete brief and populates `briefs`, `metrics`,
  `comps`, `watchlist`, `competitors`, `changelog`.
- The second run reads the prior edition and produces a real recap and changelog.
- The dashboard is deployed on Vercel, reads live, all components render, and the
  cost-of-capital calculator computes DSCR off the latest live rates.
- The UI is monotone; charts use a small accent palette only.
- RLS is on, the service_role key never reaches the client, no secrets committed.
- The GitHub Actions workflow runs on schedule, on manual dispatch, and on the
  dashboard button (repository_dispatch), writing trigger status back.
