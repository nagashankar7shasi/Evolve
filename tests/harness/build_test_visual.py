import re
import os

# Portable: paths are relative to this script's own location, not a hardcoded machine path,
# so this runs the same whether it's invoked locally or from a CI runner's checkout.
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'index.html')
OUT = os.path.join(HERE, 'test-visual.html')

html = open(SRC, encoding='utf-8').read()

# Tailwind CDN -> local compiled CSS (already built once, still valid: static utility classes
# haven't changed) + no-op tailwind.config global some code may reference.
html = html.replace(
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<link rel="stylesheet" href="compiled-tailwind.css">\n  <script>window.tailwind = { config: {} };</script>'
)

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
