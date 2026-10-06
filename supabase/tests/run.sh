#!/bin/sh
# supabase/tests/run.sh — build a throwaway database and run every SQL test.
#
#   sh supabase/tests/run.sh            # quiet on success
#   sh supabase/tests/run.sh --verbose  # print every passing assertion
#
# Requires a local PostgreSQL (14+) with pgvector. Everything it touches is a
# scratch database named cultured_test, created from scratch each run, so it is
# safe to call repeatedly and safe to call in CI.
#
# This runs the REAL migrations. The shim only supplies the `auth`/`storage`
# schemas that Supabase owns and the real `vector` extension; no security
# property is implemented in the shim.

set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DB=cultured_test
VERBOSE=${1:-}

# The postgres OS user cannot read the project directory, so stage the SQL in a
# world-readable temp tree and run from there. The files are copied verbatim, so
# what runs is exactly what ships.
STAGE=/tmp/cultured-db
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -r "$ROOT/supabase" "$STAGE/supabase"
chmod -R a+rX "$STAGE"

# Run psql as the local postgres superuser from a directory it can read.
# Prints the output and returns psql's own exit status, so a failed assertion
# fails the script.
run_file() {
  out=$(cd /tmp && su postgres -c "cd /tmp && psql -q -v ON_ERROR_STOP=1 -d $DB -f '$1'" 2>&1) && status=0 || status=$?
  if [ -n "$VERBOSE" ]; then
    printf '%s\n' "$out" | grep -v '^$\|^ *t_eq *$\|^ *----' || true
  elif [ "$status" -ne 0 ]; then
    printf '%s\n' "$out" | grep -v '^$\|^ *t_eq *$\|^ *----' || true
  fi
  return $status
}

cd /tmp
su postgres -c "dropdb --if-exists $DB" >/dev/null 2>&1 || true
su postgres -c "createdb $DB"

echo "→ shim and roles"
run_file "$STAGE/supabase/tests/000_shim.sql"

for f in "$STAGE"/supabase/migrations/*.sql; do
  echo "→ migrate $(basename "$f")"
  run_file "$f"
done

for f in "$STAGE"/supabase/tests/[0-9][0-9][0-9]_*.sql; do
  case "$f" in
    *000_shim.sql) continue ;;
  esac
  echo "→ test $(basename "$f")"
  run_file "$f"
done

echo "✓ supabase tests passed"
