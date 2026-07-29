#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h}"

cd "$REPO_ROOT"

print "Starting Supabase..."
supabase start

print "\nRunning authentication E2E in an isolated local environment..."
print "Playwright will use Frontend port 5174 and Backend port 8081."
cd "$REPO_ROOT/frontend"
bun run test:e2e:headed

print "\nAuthentication E2E completed successfully."
print "Press Return to close this window."
read -r
