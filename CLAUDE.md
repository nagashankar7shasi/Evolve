# Working on Evolve+

Solo-admin-maintained exam-prep SPA (KPSC KAS / Karnataka PSI / KPSC FDA-SDA / UPSC CSE), built
entirely through AI-assisted sessions. See `README.md` for repo layout, cache-busting and
versioning — read that first. This file is about *workflow*: how changes get made safely.

- **GitHub repo:** `nagashankar7shasi/Evolve` (remote may show as `nagashankar7shasi/evolve`,
  same repo — GitHub just normalized the case).
- **Supabase project_id:** `zghoanrwgihlefgmqmrr`.
- **Live site:** https://evolveplus.in (GitHub Pages, serves `index.html` directly — no *deploy*
  build step; `css/tailwind.css` is a committed, precompiled file, not built at request time).

## Conversation scope: app-dev vs. content/ads

Work on this repo happens in two deliberately separate kinds of Claude conversation. A fresh
session should figure out which one it is (from what the user is asking, or from how it was
started) and stay inside that lane.

1. **App-development conversations.** Everything else in this file (shipping code, DB schema
   fixes, PRs, testing) applies here. These sessions change `index.html`/`css`/`js`, run
   migrations, open/merge PRs, run `git` commands. They do **not** write ad/content copy or
   touch `pub_ad_notes_queue` rows beyond what's needed to debug the publishing mechanism itself.
2. **Content/ads conversations.** Writing new content — currently just Public Administration
   Notes — and queuing it for publication. These sessions only read/write content and the
   `pub_ad_notes_queue` table via Supabase MCP. They do **not** edit `index.html`/css/js, do
   **not** run `git`/PR commands, and do **not** touch any other table.

Keep these in different conversations rather than mixing both into one chat: an app-dev session
drafting ad copy, or a content session touching app code, is the thing to avoid. If a user message
in an app-dev conversation asks for new content to be written, or a content conversation gets
asked for a code change, the right move is to say so and suggest doing that part in the other kind
of conversation, rather than just doing it.

### Automated publishing (a scheduled task, not a conversation)

A scheduled task named **"Publish Daily Pub Ad Note"** (cron `41 6 * * *` Asia/Kolkata) runs once a
day and is purely mechanical — it is not, and should not become, a venue for writing content:

- It takes the single next unpublished row from `pub_ad_notes_queue` (lowest `order_num` where
  `published = false`) and inserts it into `custom_pages` as a child of `p_1793039540391`
  ("Public Administration Notes", slug `public-administration-notes`), with id pattern
  `p_padnote_<NN>` (zero-padded `order_num`).
- It never writes, edits, rewrites, or judges content — every queued row was already authored and
  reviewed by a human (in a content/ads conversation) ahead of time.
- It is self-guarding: at most one publish per day, and a no-op if the queue is empty.
- It runs in its own fresh, isolated session every time it fires and never reuses whatever
  conversation happens to be open at the time — so it can't bleed into either app-dev or
  content/ads conversations, even if a user replies inside that day's run.
- When unpublished rows drop to 2 or fewer, its report flags that the queue is running low, but it
  deliberately does **not** write new notes itself — refilling the queue is explicitly a
  content/ads-conversation task, never something to do from inside the scheduled task or from an
  app-dev session.

### `pub_ad_notes_queue` schema (what a content/ads conversation writes to)

| column | type | notes |
|---|---|---|
| `id` | text, PK | free-form id, e.g. `paq_00N` |
| `order_num` | integer | publish order — the scheduled job always takes the lowest unpublished `order_num` first |
| `slug` | text | becomes `custom_pages.slug` on publish |
| `title` | text | becomes `custom_pages.title` on publish |
| `paper` | text | which exam/paper this note belongs to |
| `topic` | text, nullable | |
| `summary` | text, nullable | becomes `custom_pages.summary` on publish |
| `content` | text | the note body (HTML); copied verbatim into `custom_pages.content` |
| `published` | boolean, default `false` | flipped to `true` by the scheduled job once published |
| `published_page_id` | text, nullable | set to the new `custom_pages.id` once published |
| `created_at` / `published_at` | timestamptz | |

Adding a new note is an `INSERT` into this table (via the Supabase MCP `execute_sql`/`apply_migration`
tools) with `published = false` and the next free `order_num` — never a direct `INSERT` into
`custom_pages`, and never an app-code change.

## Shipping an app-code change (index.html, /css, /js)

Always use a feature branch + PR, never commit straight to `main`:

1. `git checkout -b feature/<short-name>`
2. Make the change.
3. **If you used any new Tailwind utility class** (one that doesn't already appear literally
   somewhere in `index.html` or `js/*.js`), run `npm run build-css` to regenerate `css/tailwind.css`
   — Tailwind is a precompiled static build now (`css/tailwind-src.css` → `css/tailwind.css` via
   `tailwind.config.js`'s content scan), not the old Play CDN, so a class that was never compiled
   simply won't render. Forgetting this step is the one way this specific change can silently break
   styling — nothing else in the test suite catches a missing utility class.
4. **Bump the cache-bust version**: `grep -o '?v=[0-9]*' index.html | sort -u` to see the current
   number, then `sed -i 's/?v=OLD/?v=NEW/g' index.html` to bump every tag together (see README).
5. Test before pushing (see below) — don't open a PR on unverified code.
6. Commit, `git push -u origin feature/<short-name>`.
7. Open the PR: `gh api repos/nagashankar7shasi/Evolve/pulls -f title=... -f head=... -f base=main -f body=...`
8. Poll CI: `gh api repos/nagashankar7shasi/Evolve/commits/<SHA>/check-runs` until `completed`/`success`.
9. Merge: `gh api repos/nagashankar7shasi/Evolve/pulls/<N>/merge -X PUT -f merge_method=merge`.
10. `git checkout main && git pull origin main && git branch -d feature/<short-name>`.

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
builds `tests/harness/test-visual.html` from the real `index.html`/`css`/`js` (remaining CDN
`<script>` tags — PapaParse, pdf-lib, Supabase — get rewritten to local vendor stubs, see
`tests/harness/vendor/stubs.js`; Tailwind needs no stubbing since `css/tailwind.css` is already a
plain static file production uses directly, same as `css/main.css`).

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
