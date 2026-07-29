#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  print "\nStopping local application services..."
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

print "Starting Supabase..."
supabase start

print "\nStarting Backend..."
(
  cd "$REPO_ROOT/backend"
  ./mvnw spring-boot:run
) &
BACKEND_PID=$!

print "\nStarting Frontend..."
(
  cd "$REPO_ROOT/frontend"
  bun run dev --host 127.0.0.1
) &
FRONTEND_PID=$!

print "\nLocal authentication environment"
print "Frontend: http://127.0.0.1:5173/design-system"
print "Mailpit:  http://127.0.0.1:54324"
print "Backend:  http://127.0.0.1:8080"
print "\nPress Control+C to stop Backend and Frontend."

wait
