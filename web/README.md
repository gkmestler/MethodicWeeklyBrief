# Methodic Monday Brief — Web Dashboard

Private, single-user analytics dashboard for the Methodic Monday Brief. It reads
a weekly intelligence brief from Supabase (Postgres) and renders rates, comps, a
cost-of-capital calculator, a watchlist board, a competitor registry, and a
changelog.

> See the repo root README for the broader system context (ingestion, schema,
> data pipeline). This document covers running the web app only.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (monotone theme)
- Recharts (charts)
- `@supabase/supabase-js` (data, anon key, server components)
- `react-markdown` + `remark-gfm` (brief bodies)

Data is fetched in **server components** using the Supabase **anon** key. RLS on
the Supabase side grants anon read access. The service-role key is never used or
exposed here.

## Local setup

```bash
cd web
npm install

# Configure Supabase credentials
cp .env.local.example .env.local
# then edit .env.local with your project URL + anon key

npm run dev      # http://localhost:3000
```

Required environment variables (see `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The dashboard renders cleanly against an **empty database** — every section shows
a "No data yet" state until briefs are ingested.

## Scripts

| Script          | Purpose                          |
| --------------- | -------------------------------- |
| `npm run dev`   | Local dev server                 |
| `npm run build` | Production build                 |
| `npm run start` | Serve the production build       |
| `npm run lint`  | ESLint (next/core-web-vitals)    |

## Deploy to Vercel

1. Import the repo into Vercel and set the **Root Directory** to `web/`.
2. In **Project Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Vercel runs `npm install && npm run build` automatically.

Pages use `export const revalidate = 300` (5-minute ISR) since the brief updates
weekly.

## Routes

| Route                   | Description                                |
| ----------------------- | ------------------------------------------ |
| `/`                     | Main dashboard (all sections)              |
| `/archive`              | Searchable brief archive                   |
| `/brief/[week_of]`      | Single brief (markdown body + metrics)     |
| `/watchlist/[slug]`     | Full history of one watchlist thread       |
| `/competitor/[id]`      | One competitor's mention history           |
