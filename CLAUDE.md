# Working on Evolve+

Solo-admin-maintained exam-prep SPA (KPSC KAS / Karnataka PSI / KPSC FDA-SDA / UPSC CSE), built
entirely through AI-assisted sessions. See `README.md` for repo layout, cache-busting and
versioning — read that first. This file is about *workflow*: how changes get made safely.

- **GitHub repo:** `nagashankar7shasi/Evolve` (remote may show as `nagashankar7shasi/evolve`,
  same repo — GitHub just normalized the case).
- **Supabase project_id:** `zghoanrwgihlefgmqmrr`.
- **Live site:** https://evolveplus.in (GitHub Pages, serves `index.html` directly, no build step).

## Shipping an app-code change (index.html, /css, /js)

Always use a feature branch + PR, never commit straight to `main`:

1. `git checkout -b feature/<short-name>`
2. Make the change.
3. **Bump the cache-bust version**: `grep -o '?v=[0-9]*' index.html | sort -u` to see the current
   number, then `sed -i 's/?v=OLD/?v=NEW/g' index.html` to bump every tag together (see README).
4. Test before pushing (see below) — don't open a PR on unverified code.
5. Commit, `git push -u origin feature/<short-name>`.
6. Open the PR: `gh api repos/nagashankar7shasi/Evolve/pulls -f title=... -f head=... -f base=main -f body=...`
7. Poll CI: `gh api repos/nagashankar7shasi/Evolve/commits/<SHA>/check-runs` until `completed`/`success`.
8. Merge: `gh api repos/nagashankar7shasi/Evolve/pulls/<N>/merge -X PUT -f merge_method=merge`.
9. `git checkout main && git pull origin main && git branch -d feature/<short-name>`.

## Shipping a pure data/DB fix (no app-code change)

Use the Supabase MCP tools (`apply_migration`, `execute_sql`) directly — no branch/PR needed. But:
**never trust a migration file in `/sql` as proof it ran against the live project.** Files have
existed in the repo without ever being applied before (that caused a real production bug — see
git history around "weights column"). Always verify ground truth first, e.g.:
`SELECT column_name FROM information_schema.columns WHERE table_name='...'`, and re-check after
applying. Also write/update the corresponding file in `/sql` so the repo stays an accurate record,
even though the file itself isn't what makes the change real.

`CREATE OR REPLACE VIEW` cannot reorder or insert columns among existing ones (Postgres error
42P16) — new columns must be appended at the end of the SELECT list, even if that's not where
they'd conceptually belong.

## Testing before shipping

```
npm run build-harness
```
builds `tests/harness/test-visual.html` from the real `index.html`/`css`/`js` (CDN `<script>` tags
get rewritten to local vendor stubs — see `tests/harness/vendor/stubs.js`).

Serve it (the simple one-liner often fails with exit 144 or an unreachable port — this detached
form is reliable, sometimes needing a second attempt):
```
cd tests/harness && setsid python3 -m http.server 8899 > /tmp/harness.log 2>&1 < /dev/null &
disown
sleep 1 && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8899/test-visual.html
```

Run the regression suite:
```
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/run.js
```
Expect all checks green. For a new feature, also write a one-off Playwright script (see pattern in
any recent PR) against `http://localhost:8899/test-visual.html` to verify the specific behavior —
scratchpad is a fine place for these, they don't need to be committed.

**Harness limitation:** `Papa.parse` is stubbed as a no-op (sandboxed env can't do real CSV
parsing in-browser). Verify CSV upload/round-trip correctness via direct calls to the header-
mapping functions, or by parsing the generated CSV with Python's real `csv` module — not through
the actual file-upload UI in Playwright.

## Commit/PR attribution

Follow whatever trailer format the session's own system reminder specifies at the time (it has
changed between sessions, e.g. model name in the `Co-Authored-By` line) — don't hardcode one here.

## Architecture patterns worth knowing before touching the Word Page Editor or access control

- **`.kb-block-delete` overlay pattern**: a `contenteditable="false"` button absolutely positioned
  inside an editable block (tables, column blocks, resource/page/test-paper cards), always stripped
  before public rendering.
- **Editor-placeholder vs public-render-rebuild**: page cards and test-paper cards save only a
  lightweight placeholder div in the editor; the public page's `renderDynamicCustomPage()` →
  `hydratePageCards()` entirely rebuilds the live tile from current source data on every render —
  so a page never shows stale price/title/lock-status.
- **Access-control chain**: `isTestUnlockedForUser()` → inactive blocks everyone but admin → free
  (price 0) always unlocks → `bundleCoversPaper()` (all-access / paper-id / category /
  alsoListCategories) → individual `allowedExams` grant. `delisted` (as opposed to `active`) never
  affects this chain at all — it only hides a paper from the browse grid/search.
- **`testsCatalog` is metadata-only** by default (no `questions`) — `ensurePaperQuestionsLoaded()`
  fetches the real content on demand, only once access is confirmed.
