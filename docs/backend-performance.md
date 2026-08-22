# Backend performance

The backend uses keyset pagination for growing collections under `/api/v2` while all
existing `/api/v1` responses remain compatible. Cursor pages contain `items`,
`nextCursor`, and `hasMore`; `limit` defaults to 50 and accepts values from 1 to 100.
Cursors are scoped to an endpoint and its normalized filters.

Runtime bootstrap is assembled with five bulk database queries on a cache miss. The
60-second in-process snapshot cache retains ETag/304 behavior and is invalidated by
bot, feature configuration, subscription, and runtime-state mutations.

## Metrics

Authenticated Actuator metrics include:

- `runtime.bootstrap.cache` tagged with `result=hit|miss`
- `runtime.bootstrap.load`
- `runtime.bootstrap.bots`
- `runtime.bootstrap.features`
- `runtime.bootstrap.payload.bytes`

Prometheus output is available at `/actuator/prometheus` to authenticated operators.
Secrets, request bodies, and cursor values are never added as metric tags.

## Smoke benchmark

Run against a non-production database populated with at least 100 bots, 10 active
features per bot, 10,000 users, and 50,000 wallet entries. Record the machine,
PostgreSQL version, dataset counts, and active Spring profile with every result.

The idempotent fixture uses deterministic UUIDs and the `codex-perf-` prefix. Apply
it only to a disposable development database and remove it with the paired cleanup
script. Either execute the SQL in Supabase SQL Editor or with your preferred
PostgreSQL client:

```sh
psql "$DATABASE_URL" -f scripts/backend-perf-fixture.sql
psql "$DATABASE_URL" -f scripts/backend-perf-cleanup.sql
```

```sh
BACKEND_URL=http://localhost:8080 \
USER_TOKEN=... ADMIN_TOKEN=... RUNNER_TOKEN=... \
PERF_ITERATIONS=30 node scripts/backend-perf-smoke.mjs
```

The runner reports p50, p95, and response bytes and exits unsuccessfully when any
exercised endpoint has p95 latency of 300 ms or more. Use `EXPLAIN (ANALYZE, BUFFERS)`
for each paginated repository query before and after applying the optimization
migration; retain an index only when the representative plan uses it without an
unacceptable increase in write cost.

### Supabase Dev result (2026-08-23)

- Client: Apple Silicon macOS, Java 21, Node.js 26; backend `local` profile
- Database: Supabase Cloud Dev, PostgreSQL 17.6, Singapore session pooler
- Dataset: 10,000 users, 100 bots, 1,000 active feature installations, and
  50,000 wallet entries
- 30-request smoke result: works v2 p50 106.7 ms / p95 113.0 ms; cached runtime
  bootstrap p50 1.7 ms / p95 8.6 ms
- Index-plan execution: users 0.129 ms, user bots 0.074 ms, admin bots 0.158 ms,
  and wallet history 0.191 ms. Each representative plan used the corresponding
  cursor index.

Authenticated user/admin endpoints were not included in this run because the Dev
project's Auth email quota returned HTTP 429 while creating an ephemeral test user.
