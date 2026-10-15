import re
import os
import shutil

# Portable: paths are relative to this script's own location, not a hardcoded machine path,
# so this runs the same whether it's invoked locally or from a CI runner's checkout.
HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(REPO_ROOT, 'index.html')
OUT = os.path.join(HERE, 'test-visual.html')

# index.html now references css/main.css and js/*.js with paths relative to the repo root
# (where it lives in production). test-visual.html lives one level deeper, in tests/harness/,
# so those same relative paths need the real files sitting right next to it too -- copy them
# in on every build rather than rewriting the paths, so test-visual.html stays a byte-for-byte
# stand-in for the real index.html's own markup.
for name in ('css', 'js'):
    dst = os.path.join(HERE, name)
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(os.path.join(REPO_ROOT, name), dst)

html = open(SRC, encoding='utf-8').read()

# Tailwind no longer needs stubbing here: production index.html itself now links a precompiled
# css/tailwind.css (see css/tailwind-src.css + `npm run build-css`) instead of the old Play CDN
# script, and that file is already copied into place by the css/ copytree above like main.css is.

html = html.replace(
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>',
    '<script src="vendor/stubs.js"></script>'
)
html = html.replace(
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>',
    ''  # stubs.js above already defines window.PDFLib
)
html = html.replace(
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    '<script src="vendor/supabase.js"></script>'
)

open(OUT, 'w', encoding='utf-8').write(html)
print(f"Wrote {OUT}, {len(html)} bytes")

remaining_cdn = re.findall(r'<script[^>]*src="https?://[^"]*"[^>]*></script>', html)
print(f"Remaining external <script src> tags: {len(remaining_cdn)}")
for r in remaining_cdn:
    print(" -", r)
