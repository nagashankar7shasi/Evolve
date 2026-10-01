# Evolve+

Mock-test and exam-prep platform for KPSC KAS / Karnataka PSI / KPSC FDA-SDA / UPSC CSE aspirants. Single-file HTML/JS/Tailwind frontend, Supabase (Postgres + Auth + Storage) backend, deployed via GitHub Pages at [evolveplus.in](https://evolveplus.in).

## Repo layout

- **`index.html`** — the entire app. This is the one file GitHub Pages serves at the domain root. There is only ever one live copy of this file in the repo root — never save a new version alongside it under a different name (see "Versioning" below).
- **`/sql`** — every database migration that's been run against the Supabase project, in the order they were written. Each file is self-contained and idempotent (safe to re-run), and says in its own header what it does and why.
- **`/archive`** — a one-time import of ~27 historical snapshots of `index.html` that had accumulated as separate files (`index V9 Null`, `index main V11.1`, etc.) before this repo had real version control. They're numbered `000`–`026` in true chronological order (verified by content growth and feature fingerprinting, not by their original names — several of the original names were out of order). Each filename keeps the original name for reference. These are historical reference only; nothing here is live or should be built on.

## Versioning

This repo uses normal git history instead of saving a new file per version:

- Every change to `index.html` is a **commit with a message** describing what changed — that message is now the "version label," not a filename.
- `git log -- index.html` shows the full history; `git diff <commit1> <commit2>` shows exactly what changed between any two points.
- To roll back, use `git revert <commit>` or check out an older commit's version of the file — never duplicate the file under a new name.
- For a milestone worth being able to jump straight back to, use a **git tag** (e.g. `v1.2-studio-intelligence`) rather than a new filename.
