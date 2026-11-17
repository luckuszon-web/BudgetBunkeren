#!/bin/sh
# Bygger den nye app (app/) til docs/ny/. Supabase-adresse og offentlig nøgle læses fra docs/config.js (de er offentlige).
set -e
cd "$(dirname "$0")/.."
VITE_SUPABASE_URL=$(sed -n 's/.*SUPABASE_URL: *"\([^"]*\)".*/\1/p' docs/config.js)
VITE_SUPABASE_ANON_KEY=$(sed -n 's/.*SUPABASE_ANON_KEY: *"\([^"]*\)".*/\1/p' docs/config.js)
export VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY
cd app
[ -d node_modules ] || npm ci
npx vite build
