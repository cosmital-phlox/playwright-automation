# CI Setup — Scheduled Tests → GitHub Pages report → Slack

This repo runs the full Playwright suite (**customer frontend + admin panel**)
every day at **5:00 PM IST**, publishes the HTML report to **GitHub Pages**, and
posts the result to a **Slack** channel — mirroring the `testlify-api-automation`
project.

Pipeline: [`.github/workflows/scheduled-tests.yml`](.github/workflows/scheduled-tests.yml)

```
cron 11:30 UTC (5 PM IST)
        │
        ▼
  npm ci → playwright install
        │
        ▼
  restore frontend session (secret)   admin logs in automatically
        │
        ▼
  npx playwright test --project=chromium --project=admin
        │
        ├──► publish playwright-report/ to gh-pages  →  reports/<run_id>/index.html
        │
        └──► Slack message with ✅/❌ + counts + report link
```

You can also trigger it manually: **Actions → Scheduled UI Tests → Run workflow**.

---

## One-time setup (do these in order)

### 1. Push the repo to GitHub
The project is already a git repo with an initial commit. Create an empty GitHub
repo, then:
```bash
git remote add origin https://github.com/<owner>/<repo>.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages
After the **first** workflow run creates the `gh-pages` branch:
- Repo **Settings → Pages**
- **Source:** *Deploy from a branch*
- **Branch:** `gh-pages` / `(root)` → Save

Reports will then be live at:
`https://<owner>.github.io/<repo>/reports/<run_id>/`

> Note: the very first scheduled/manual run publishes to `gh-pages`; the Pages
> URL goes live a minute or two after you enable it above.

### 3. Add a Slack Incoming Webhook
1. Slack → create (or open) an app at <https://api.slack.com/apps> → **Incoming Webhooks** → *Activate* → **Add New Webhook to Workspace** → pick the target channel (e.g. `#api-automation-daily-report`).
2. Copy the webhook URL (`https://hooks.slack.com/services/...`).
3. GitHub repo **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: the webhook URL

> `<!channel>` in the failure message pings the channel (same as the example's `@channel`).

### 4. Add the frontend session secret (skips the OTP login)
The frontend login uses an OTP, which can't run unattended — so we bake a session
once and let CI restore it.

```bash
# a) Log in locally (enter the OTP at the pause, then resume):
npx playwright test --project=setup --headed

# b) Encode the saved session and copy it to the clipboard (macOS):
base64 -i playwright/.auth/user.json | pbcopy
```
Then add a GitHub Actions secret:
- Name: `FRONTEND_STORAGE_STATE`
- Value: paste the base64 string

> **This session expires** (server-side token lifetime). When the frontend tests
> start failing as "logged out", regenerate the secret by repeating step 4.
> The admin side does **not** need this — it logs in with email+password each run.

### 5. (Optional) Override admin credentials
The admin login defaults to the sandbox account baked into `admin.setup.js`. To use
a different UAT account, add secrets:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

---

## Changing the schedule
Edit the cron in [`scheduled-tests.yml`](.github/workflows/scheduled-tests.yml).
GitHub cron is **UTC**:

| Local (IST) | UTC cron |
|-------------|----------|
| 5:00 PM | `30 11 * * *` (current) |
| 9:00 AM | `30 3 * * *` |
| Midnight | `30 18 * * *` |

---

## Notes
- **Both suites run in one invocation** (`--project=chromium --project=admin`) so
  there's a single combined report per run.
- **Failures still publish + notify** — the test step uses `continue-on-error` so a
  red run always produces a report and a Slack message (matching the example, which
  posts ❌ with a link).
- The customer **payment** flow is the most backend-latency-sensitive spec; nightly
  runs may show it flaky/failed during slow backend windows (see `QA_REPORT.md`).
- Reports accumulate under `gh-pages/reports/<run_id>/` (`keep_files: true`); a copy
  is also uploaded as a workflow artifact (14-day retention) as a backup.
- `playwright/.auth/` is gitignored — sessions are **never** committed; CI gets them
  only via the `FRONTEND_STORAGE_STATE` secret.
```
