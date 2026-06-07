#!/usr/bin/env bash
# Build a clean publish dir (app only — NEVER scans/) and deploy to Cloudflare Pages.
#
# Usage:
#   npx wrangler login            # one-time, opens browser (or set CLOUDFLARE_API_TOKEN)
#   CF_PAGES_PROJECT=flashcard-snap-kit ./scripts/deploy.sh
#
# Notes:
#   - Direct Upload (no GitHub needed). Re-run after adding/editing data/ pages.
#   - scans/ (copyrighted source material) is deliberately excluded from dist/.
#   - You still MUST protect the deployment with Cloudflare Access (see README).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${CF_PAGES_PROJECT:-flashcard-snap-kit}"

rm -rf dist && mkdir -p dist
cp index.html test.html review.html manifest.webmanifest favicon.ico LICENSE dist/
cp -r assets data dist/
# Ship the Basic Auth middleware so direct uploads are protected too.
[ -d functions ] && cp -r functions dist/

# Safety net: abort if any scan/PDF ever leaks into the publish dir.
if find dist \( -iname '*.pdf' -o -ipath '*scans*' \) | grep -q .; then
  echo "ABORT: copyrighted source (scans/ or *.pdf) found in dist/ — refusing to deploy." >&2
  exit 1
fi

echo "Publishing $(find dist -type f | wc -l) files to Cloudflare Pages project: $PROJECT"
npx --yes wrangler@latest pages deploy dist --project-name="$PROJECT"
