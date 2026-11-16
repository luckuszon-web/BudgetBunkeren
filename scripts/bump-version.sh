#!/bin/sh
# Giver siden et nyt versionsnummer, så appen på telefonen kan se, at der er kommet en opdatering.
# Kør før hver commit, der ændrer noget i docs/:  sh scripts/bump-version.sh
set -e
cd "$(git rev-parse --show-toplevel)"
V=$(date -u +%Y%m%d%H%M%S)
printf '{ "version": "%s" }\n' "$V" > docs/version.json
sed -i.bak -E "s/window\.APP_VERSION = \"[^\"]*\"/window.APP_VERSION = \"$V\"/" docs/index.html && rm -f docs/index.html.bak
echo "Version $V"
