#!/usr/bin/env bash
# Copies exactly the files the live site serves into a clean directory, ready to upload.
# Everything else in the repo (tests, scripts, sql, node_modules, .github, ...) stays out.
# Usage: deploy/stage-site.sh <output-dir>
set -euo pipefail
OUT="${1:?usage: stage-site.sh <output-dir>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rm -rf "$OUT"
mkdir -p "$OUT"
cd "$ROOT"

for f in index.html admin-console.html 404.html og-image.png robots.txt sitemap.xml; do
  [ -f "$f" ] || { echo "stage-site: required file missing: $f" >&2; exit 1; }
  cp "$f" "$OUT/$f"
done
for d in css js assets p; do
  [ -d "$d" ] || { echo "stage-site: required folder missing: $d" >&2; exit 1; }
  cp -R "$d" "$OUT/$d"
done
cp deploy/.htaccess "$OUT/.htaccess"

# Never upload a near-empty site over a good one.
pages=$(find "$OUT/p" -name index.html | wc -l)
if [ "$pages" -lt 10 ]; then
  echo "stage-site: only $pages generated pages under p/ -- refusing to stage." >&2
  exit 1
fi
echo "staged $(find "$OUT" -type f | wc -l) files ($pages crawlable pages) into $OUT"
