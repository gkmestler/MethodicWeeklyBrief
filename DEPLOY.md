# Cloud deploy — no Mac mini

The generator runs in **GitHub Actions** instead of on a local machine. The weekly
brief is produced by a scheduled workflow, and the dashboard's "Generate now"
button triggers the same workflow on demand via the GitHub API.

```
Dashboard button ──POST /api/trigger──▶ Supabase: insert 'queued' row
                                    └──▶ GitHub repository_dispatch ──▶ Actions run
Actions run ──▶ python -m generator.watch_triggers ──▶ claims the row, generates,
            writes status back ──▶ button's spinner resolves

Weekly cron ──▶ python -m generator.generate ──▶ writes the new brief to Supabase
```

Nothing in the Python changed — `config.py` reads secrets from environment
variables, which GitHub provides from repo Secrets.

## One-time setup

### 1. Push the project to GitHub
From the repo root (git is already initialized with a first commit):

```bash
git remote add origin https://github.com/<you>/MethodicWeeklyBrief.git
git push -u origin main
```

Secrets are safe to push: `config/.env` and `web/.env.local` are gitignored.

### 2. Add GitHub repo Secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | from `config/.env` |
| `SUPABASE_URL` | `https://nocuctlazlzjfulzlwvj.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key from `config/.env` |
| `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_TO` | only if you turn email on |

### 3. Create a token for the button
Create a GitHub Personal Access Token the dashboard uses to trigger runs:
- Fine-grained PAT scoped to this repo with **Contents: Read and write**, or
- Classic PAT with the **`repo`** scope.

### 4. Set Vercel env vars
Vercel project → **Settings → Environment Variables** (all environments):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nocuctlazlzjfulzlwvj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (server-only) |
| `GITHUB_REPO` | `<you>/MethodicWeeklyBrief` |
| `GITHUB_DISPATCH_TOKEN` | the PAT from step 3 (server-only) |

Redeploy so the new env vars take effect.

## Verifying

- **Manual from GitHub:** Actions tab → *Generate Brief* → *Run workflow* (optionally
  enter a `week_of`). Watch it run and check the brief lands in Supabase.
- **From the dashboard:** click *Generate now*. The button enqueues a row, dispatches
  the workflow, and the spinner resolves to "Brief generated." when the run writes back.
- **Weekly:** the `schedule` cron fires Mondays at 11:00 UTC. Change the `cron:` line in
  `.github/workflows/brief.yml` to adjust.

## Decommissioning the Mac mini

Once cloud runs are confirmed, the launchd agents are no longer needed:

```bash
launchctl unload ~/Library/LaunchAgents/com.methodic.watcher.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.methodic.brief.plist 2>/dev/null
```

(They were never installed in this setup, so this is only relevant if you had set
them up previously.)
