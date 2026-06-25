# Master Prompt: Methodic Monday Brief System

You are building a system that generates a weekly intelligence brief every Monday, stores each edition in Supabase with structured memory, and serves a dashboard (hosted on Vercel) for reviewing past briefs and tracking trends over time. Read this entire spec before writing any code. Build in the phases defined at the bottom. Confirm the schema before building the dashboard, because the schema is the contract that the generator, the database, and the UI all depend on.

---

## 1. Context (who this is for)

The user is Gavin, co-founder of Methodic Ventures, a deal-by-deal acquisition group buying essential service businesses (HVAC, electrical, plumbing, landscaping, pest control, roofing, fire safety) in New England. Target profile: $500K to $1.5M EBITDA at 3 to 4x multiples, holdco/SPV structure with co-investor equity and conventional or SBA debt. Current focus is landscaping, with an active deal (Mac's Landscaping). The brief exists to keep him current on rates, financing, the landscaping market, Massachusetts and New England specifics, competitors hunting the same space, and his AI-plus-skilled-labor thesis.

Tone of the brief content: direct, no fluff, no corporate filler, no em-dashes anywhere.

---

## 2. Architecture and where things run

Three pieces, with a clear split of responsibilities:

- **Generator (the heavy job): runs on an always-on Mac mini via launchd, Monday 06:00 local.** It researches the week (Anthropic API plus web search), produces the brief, and writes the results to Supabase. It lives on the Mac mini and not on Vercel because generation is a multi-minute LLM-plus-web-search job that would risk Vercel serverless timeouts on an unattended run. The Mac mini has no time limit and is already always plugged in.
- **Supabase (the memory layer): hosted Postgres.** Every edition and all structured data live here. This is what makes "what changed since last week" and the dashboard trends possible.
- **Dashboard (the UI): Next.js hosted on Vercel.** Reads from Supabase. No separate backend server to run.

This means there is no standalone FastAPI service. Custom server logic, if any, lives in Next.js route handlers on Vercel.

**Alternative the user may choose instead (documented, not the default):** retire the Mac mini and use Vercel Cron to trigger a serverless function that runs the generator. This is all-cloud and simpler operationally, but it bets the weekly run finishes inside the Vercel function time limit, which is tight for a research-heavy brief and requires the Pro plan with an extended max duration. If the user picks this, move the generator into a Vercel route handler with `maxDuration` set as high as the plan allows and configure `vercel.json` cron for Monday. Otherwise default to the Mac mini.

---

## 3. Constraints

- The generator needs live web access, or it will invent numbers. Use the Anthropic API with the web search tool. Do not generate rates or comps from model memory.
- Single user. The dashboard is private. Lock it down with Supabase Row Level Security and proper key handling (section 11), not by leaving tables open.
- Do not over-engineer. Prefer a small number of well-chosen dependencies.

---

## 4. Recommended stack

- Generator: Python on the Mac mini, calling the Anthropic API (`claude-opus-4-8` or current) with web search. Writes to Supabase via `supabase-py` (or the Postgres REST endpoint) using the service role key, which is safe here because it runs locally and server-side only.
- Database: Supabase (Postgres). Schema applied via the Supabase SQL editor or migrations. RLS enabled on every table.
- Dashboard: Next.js (App Router) on Vercel, with Recharts for charts and Tailwind for styling. Data access via `@supabase/supabase-js`. Read data in server components or route handlers; never ship the service role key to the client.
- Scheduler: macOS `launchd` on the Mac mini (primary). Vercel Cron only if the user chose the all-cloud alternative in section 2.
- Email delivery: optional, off by default. Since the generator runs on the Mac mini, send the rendered brief from there via SMTP (Gmail app password) behind a config flag.

If you have a frontend-design skill available, consult it before building the UI.

---

## 5. The memory model (read this carefully)

The LLM has no memory between runs. "Memory of each brief" and "what changed since last week" both require the same thing: prior briefs live in Supabase, and each run reads the most recent edition back in before generating the new one.

The weekly loop is:
1. Read the most recent brief's structured data from Supabase: the metrics, the open watchlist threads, and the known competitors.
2. Pass that prior context into the generation prompt.
3. The model researches the week via web search and produces: the new brief body, a short recap of last week, a changelog (quantitative deltas plus qualitative thread progress) computed against the prior data it was handed, and an updated watchlist.
4. Write the new brief and update the persistent tables in Supabase (metrics, watchlist, competitors, comps, changelog).

The storage is the memory. The model is just the engine that runs over it. On the very first run there is no prior brief, so the recap and changelog should render as "first edition, baseline established."

---

## 6. Data schema (confirm before building the dashboard)

Postgres / Supabase. Apply this in the Supabase SQL editor. Use long format for metrics so new metrics can be added later without schema changes. Watchlist items use stable string IDs (slugs) so a thread can be tracked across many weeks. Enable RLS on every table (section 11).

```sql
create table briefs (
  id bigint generated always as identity primary key,
  week_of date not null unique,
  created_at timestamptz not null default now(),
  recap text,
  deep_cut_topic text,
  body_markdown text,
  raw_json jsonb
);

create table metrics (
  id bigint generated always as identity primary key,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  metric_key text not null,        -- fed_funds, sba_7a_effective, prime, conventional_acq_rate, ten_year_treasury
  value numeric,
  unit text,
  as_of_date date,
  source text
);

create table comps (
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

create table watchlist_items (
  id text primary key,             -- stable slug, e.g. sba-sop-2026-revision
  title text not null,
  category text,                   -- rates, sba, landscaping, ma-regulatory, competitor, thesis
  status text,                     -- open, updated, closed
  current_summary text,
  created_week date,
  last_updated_week date
);

create table watchlist_updates (
  id bigint generated always as identity primary key,
  watchlist_item_id text references watchlist_items(id) on delete cascade,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  change_type text,                -- added, updated, closed
  update_text text
);

create table competitors (
  id bigint generated always as identity primary key,
  name text not null unique,
  type text,                       -- pe firm, search fund, holdco, platform, independent sponsor
  location text,
  first_seen_week date,
  last_seen_week date,
  last_action text,
  notes text
);

create table competitor_mentions (
  id bigint generated always as identity primary key,
  competitor_id bigint references competitors(id) on delete cascade,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  mention_text text
);

create table changelog (
  id bigint generated always as identity primary key,
  brief_id bigint references briefs(id) on delete cascade,
  week_of date not null,
  change_type text,                -- quantitative, qualitative
  text text
);
```

The generator must emit JSON that maps cleanly onto these tables. A loader validates and upserts it (upsert competitors on name, watchlist_items on id). If a field is missing or malformed, log it and skip that record rather than crashing the run.

---

## 7. The brief content (what the generator produces)

Every edition has these sections, in order. Each substantive section ends with a one-line "So what for Methodic." Keep the whole thing readable in a few minutes. Density over length.

1. **Dashboard line** (top): the five core numbers with week-over-week change. Fed funds rate plus last and next FOMC date, SBA 7(a) effective rate (prime plus spread), prime rate, conventional acquisition loan rate range, 10-year Treasury.
2. **Last week recap**: 3 to 4 lines. The TL;DR of the prior edition so he is reoriented in ten seconds.
3. **What changed**: split into quantitative (where the dashboard numbers and any comps moved) and qualitative (storylines from prior weeks that progressed).
4. **Capital and financing**: lending environment color, SBA program/SOP changes, bonus depreciation and equipment tax treatment.
5. **Landscaping industry**: market size and growth, the big consolidators and what they pay, H-2B and immigration policy (labor supply and cost), input costs and tariffs (equipment, fuel), insurance trends.
6. **Massachusetts and New England**: regulatory and employment law (worker classification, wage/hour, non-competes, contractor licensing), construction and housing activity by region as a demand proxy, local economic signal.
7. **Competitive landscape**: PE firms, search funds, holdcos, and platforms active in New England trades, plus disclosed deals and multiples.
8. **Thesis radar**: AI, automation, and skilled-labor news that feeds his research paper and investor narrative.
9. **General signal**: 3 to 5 filtered macro items only, each connected to rates, construction, real estate, labor, or immigration. Nothing unrelated.
10. **Watchlist / open threads**: the carried-forward threads, each marked added, updated, or closed, with the current state.
11. **Deep cut**: one rotating topic gets depth this week so the brief is not all surface. Rotate across weeks (SBA SOP, H-2B, a competitor teardown, a regional housing market, etc.).

Every numeric claim and comp must carry a source. No unsourced rates.

---

## 8. The dashboard UI

Next.js on Vercel, reading from Supabase. Components, strongest first:

- **Stat tiles (top row)**: weeks tracked (streak counter), each current rate versus where it sat at week one, lowest multiple seen, active watchlist count, new competitors spotted this month.
- **Rate trends**: line charts of the five core metrics over time with sparklines for at-a-glance. Include an overlay of SBA effective rate against the conventional acquisition rate so the spread is visible, since that spread decides which financing to reach for.
- **Cost-of-capital calculator**: inputs are deal size, structure (SBA vs conventional), seller note percent, and cash at close. Outputs monthly debt service and DSCR using the latest tracked rates pulled from the most recent metrics row. Build this first among the interactive pieces.
- **Multiples tracker vs buy box**: scatter or line of every comp over time, with the 3 to 4x target drawn as a shaded band. Allow filtering by trade.
- **Watchlist board**: status board of open threads (open, updated, closed). Clicking a thread shows its full history across every brief it appeared in (from watchlist_updates).
- **Buyer and competitor registry**: sortable table of every competitor, with type, location, last-seen date, and last action. Clicking shows mention history.
- **Searchable archive**: all past briefs, full-text searchable, filterable by date. Searching a term (e.g. H-2B) surfaces every brief it appeared in.
- **Changelog feed**: chronological scroll of just the deltas, week over week, so the evolution reads as a story without opening each brief.

---

## 9. Visual design (strict)

Monotone. The UI chrome is black, white, and gray only. Charts may use color but sparingly.

- Define a small set of CSS variables in grayscale and use them everywhere. Suggested scale: `#0A0A0A`, `#404040`, `#737373`, `#A3A3A3`, `#D4D4D4`, `#E5E5E5`, `#F5F5F5`, `#FFFFFF`. Default to a clean light theme (white background, near-black text, gray borders and secondary text).
- Charts: maximum of three colors total, and prefer one primary accent plus grayscale. Reserve a single up color and a single down color (e.g. a muted green and a muted red) only for deltas and the buy-box band. Do not rainbow the series. When a chart has multiple series, differentiate with grayscale weight and one accent, not many hues.
- Typography and spacing should feel intentional and restrained. Numbers are the hero. Generous whitespace, clear hierarchy, no decorative noise.

---

## 10. Scheduling

**Primary (Mac mini):**
- Create a `launchd` agent (`~/Library/LaunchAgents/com.methodic.brief.plist`) that runs the generator every Monday at 06:00 local.
- It must run missed jobs on wake, so a sleeping machine still produces the brief.
- Log stdout and stderr to a file. On failure, retry once after a delay, then log clearly.
- Provide a manual trigger command so the user can run a brief on demand for testing.

**Alternative (Vercel Cron, only if the user retired the Mac mini):**
- Add a `vercel.json` cron entry for Monday and a protected route handler that runs the generator, with `maxDuration` set as high as the plan allows. Guard the route so only the cron invocation can trigger it.

---

## 11. Secrets and access control (do this right)

- **Supabase anon key**: public, safe in the Next.js client, but only works as intended if RLS is on.
- **Supabase service role key**: secret. Used by the generator on the Mac mini and by any Next.js server-side code. Never ship it to the browser, never commit it.
- **RLS**: enable on every table. Since this is a private single-user app, the simplest safe setup is to keep all tables locked by default and read through server-side code using the service role key, or define read-only policies for the anon role if you want direct client reads. Do not leave tables world-writable.
- **Anthropic API key and SMTP credentials**: live in the Mac mini generator's local `.env`, gitignored.
- **Vercel**: set the frontend environment variables (Supabase URL, anon key, and any server-only keys) in the Vercel project settings, not in the repo.

---

## 12. Repo structure (suggested)

```
methodic-brief/
  web/              # Next.js app, deploys to Vercel (dashboard)
  generator/        # Python: research + generation, prompt template, Supabase loader (runs on Mac mini)
  supabase/         # schema.sql, migrations, RLS policies
  scripts/          # manual trigger, install launchd agent
  config/           # config file, .env.example
  README.md         # setup, deploy, and operate instructions
```

---

## 13. Build order (phases)

1. **Supabase project and schema.** Create the project, apply the schema from section 6, enable RLS. Confirm the schema with the user before moving on.
2. **Generator.** Build the research-and-generate script: read prior context from Supabase, call the API with web search, emit structured JSON plus markdown, validate and load into Supabase. Test with a real run and inspect the rows.
3. **Dashboard.** Build the Next.js UI per sections 8 and 9, reading from Supabase. Start with stat tiles and the cost-of-capital calculator, then charts, then watchlist/registry/archive.
4. **Deploy to Vercel.** Connect the repo, set environment variables, ship the dashboard. Verify it reads live data.
5. **Scheduler.** Install and test the launchd agent on the Mac mini, including the manual trigger and the missed-run-on-wake behavior.
6. **Email (optional).** Wire up if the user wants it on.
7. **README.** Document setup, deploy, daily operation, and how to add a new tracked metric.

---

## 14. Definition of done

- A manual generator run produces a complete brief, writes a `briefs` row in Supabase, and populates metrics, comps, watchlist, competitors, and changelog.
- The second run correctly reads the prior edition and produces a real recap and changelog with actual deltas.
- The dashboard is deployed on Vercel, reads live from Supabase, all components render, and the cost-of-capital calculator computes DSCR off the latest live rates.
- The UI is monotone per section 9, with charts limited to a small accent palette.
- RLS is on, the service role key is never exposed to the client, and no secrets are committed.
- The launchd agent is installed and a missed run is recovered on wake.
- The README lets someone set it up from scratch.

---

## Appendix A: Generation prompt template

Use this as the prompt for the generation call. Fill the bracketed slots from Supabase before calling. Require strict JSON output plus a markdown field.

```
You are producing the Methodic Monday Brief for the week of [WEEK_OF].

Methodic Ventures buys essential service businesses (landscaping focus right now)
in New England, $500K to $1.5M EBITDA at 3 to 4x multiples. The reader is the
founder. Be direct. No fluff. No em-dashes.

Use web search for every number. Do not state any rate, comp, or fact from memory.
Every numeric claim carries a source.

PRIOR EDITION CONTEXT (for recap and changelog, may be empty on first run):
- Prior metrics: [PRIOR_METRICS_JSON]
- Open watchlist threads: [PRIOR_WATCHLIST_JSON]
- Known competitors: [PRIOR_COMPETITORS_JSON]

Produce the brief covering, in order: dashboard numbers (fed funds plus FOMC dates,
SBA 7a effective rate, prime, conventional acquisition loan rate, 10-year Treasury),
last week recap, what changed (quantitative and qualitative), capital and financing,
landscaping industry, Massachusetts and New England, competitive landscape, thesis
radar (AI plus skilled labor), general signal (3 to 5 filtered items), watchlist,
and one rotating deep cut. End each substantive section with one line: "So what for
Methodic." If this is the first edition, mark recap and changelog as baseline.

Return a single JSON object with these keys:
- week_of
- recap (string)
- deep_cut_topic (string)
- body_markdown (the full human-readable brief)
- metrics (array of {metric_key, value, unit, as_of_date, source})
- comps (array of {company_name, trade, location, size_basis, size_value, multiple, deal_value, source, notes})
- changelog (array of {change_type: "quantitative"|"qualitative", text})
- watchlist (array of {id (stable slug), title, category, status: "open"|"updated"|"closed", current_summary, change_type: "added"|"updated"|"closed", update_text})
- competitors (array of {name, type, location, last_action, mention_text})

Output only the JSON. No preamble, no markdown fences.
```

## Appendix B: Defaults (override if the user says otherwise)

- Generator location: Mac mini via launchd (not Vercel Cron).
- Run time: Monday 06:00 local.
- Theme: light monotone.
- Email: off.
- Buy box: 3.0 to 4.0x.
- Model: current Claude with web search enabled.