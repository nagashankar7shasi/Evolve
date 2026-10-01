# Evolve+

Mock-test and exam-prep platform for KPSC KAS / Karnataka PSI / KPSC FDA-SDA / UPSC CSE aspirants. HTML/JS/Tailwind frontend (no build step — GitHub Pages serves the files in this repo directly), Supabase (Postgres + Auth + Storage) backend, deployed at [evolveplus.in](https://evolveplus.in).

## Repo layout

- **`index.html`** — the page shell: `<head>`, all markup/templates, and a `<link>`/`<script src>` for every file below, in load order. This is the one HTML file GitHub Pages serves at the domain root. There is only ever one live copy of this file in the repo root — never save a new version alongside it under a different name (see "Versioning" below).
- **`/css/main.css`** — all of the app's custom CSS (Tailwind itself is still loaded from its CDN in `<head>`, unchanged).
- **`/js/`** — the app's JS logic, split out of what used to be one ~13,000-line inline `<script>` block into ~30 plain files, one per feature area (`06a_test_paper_studio.js`, `10_omr_exam_engine.js`, `12a_email.js`, etc. — the numeric prefixes just preserve original load order, they aren't version numbers). Every file is a classic, non-module `<script>` loaded via `<script src>` in `index.html`, so they all still share one global scope exactly as before the split — there's no bundler, no `import`/`export`, and nothing to build. A function in one file can call a function in any other exactly like today, as long as `index.html`'s script-tag order (which matches each file's numeric prefix) is preserved: do not reorder those tags without checking what depends on what. This split exists purely for navigability — splitting markup out of `index.html` into its own templates was deliberately left for a later pass, since it's a bigger, separately-scoped change.
- **`/sql`** — every database migration that's been run against the Supabase project, in the order they were written. Each file is self-contained and idempotent (safe to re-run), and says in its own header what it does and why.
- **`/archive`** — a one-time import of ~27 historical snapshots of `index.html` that had accumulated as separate files (`index V9 Null`, `index main V11.1`, etc.) before this repo had real version control. They're numbered `000`–`026` in true chronological order (verified by content growth and feature fingerprinting, not by their original names — several of the original names were out of order). Each filename keeps the original name for reference. These are historical reference only; nothing here is live or should be built on.

## Versioning

This repo uses normal git history instead of saving a new file per version:

- Every change to `index.html` is a **commit with a message** describing what changed — that message is now the "version label," not a filename.
- `git log -- index.html` shows the full history; `git diff <commit1> <commit2>` shows exactly what changed between any two points.
- To roll back, use `git revert <commit>` or check out an older commit's version of the file — never duplicate the file under a new name.
- For a milestone worth being able to jump straight back to, use a **git tag** (e.g. `v1.2-studio-intelligence`) rather than a new filename.
