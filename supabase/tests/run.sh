#!/usr/bin/env bash
# Applique les migrations sur une base PostgreSQL vierge puis lance les tests SQL.
# Usage : DATABASE_URL=postgres://... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?DATABASE_URL doit pointer vers une base de test vide}"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f tests/supabase-stub.sql
for migration in migrations/*.sql; do
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$migration"
done
for test in tests/*.test.sql; do
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$test"
done
