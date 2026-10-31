Read `.agents/README.md` before doing anything in this repository.

For frontend work, also read `frontend/AGENTS.md`,
`frontend/ci/feature-map.json`, and `frontend/scripts/ci-affected.README.md`
before editing. Keep the feature map current with source paths, routes,
dependencies and coverage so AI and CI use the same impact information.

For Backend/Runner delivery changes, read `deploy/ci-services.json` and
`deploy/ci-feature-map.json` plus `docs/backend-delivery.md`. Before editing a
Backend/Runner feature, read its source paths, routes, tests, dependencies and guides
from that map. Update ownership and coverage with new or moved files/features.
Keep shared API/bootstrap contract boundaries current;
contract changes must validate and release both services together.

For Database work, also read `deploy/postgres/feature-map.json` and
`docs/database-delivery.md`. Production application data is on VPS PostgreSQL;
`supabase/migrations/` is the versioned SQL source, not a deployment target.
Keep migration files append-only and update feature ownership/checks with schema
changes. All pending migrations run in version order; feature selection only
scopes contract checks and must never skip pending SQL. Never replay history or
restore a backup automatically to recover a failed application deployment.
