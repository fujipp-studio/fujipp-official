# Frontend CI selection

`frontend-cd.yml` runs Quality, Build and Smoke concurrently. The `verify` job
remains the required aggregate check. Deploy waits for it and downloads the
production build artifact instead of installing packages and building again.
Production build variables are read from `frontend-production`; PR builds use
`frontend-ci` (no production environment access). Existing environment protection
rules apply to the build as well as the deploy job.

## Selection rules

- Compare PR base/head SHAs, or the previous/current push SHAs. A manual run,
  missing comparison, deleted file, unknown path or shared/configuration change
  runs all tests.
- Feature-local changes select smoke specs from `smokeByFeature` in
  `ci-affected.ts`. Reverse static imports, re-exports and literal lazy imports
  extend selection to consuming features. The route registry is a boundary:
  importing a page does not make every other route affected. Editing the registry
  itself runs all tests.
- Auth and Bots currently run the full suite because their smoke specs share
  authentication and Bot Settings flows. New features default to the full suite
  until their smoke coverage is explicitly mapped.
- Unit tests use Vitest `related` for feature-local source changes. Smoke-only
  edits run those specs without unrelated unit tests. No related unit tests is
  allowed; type checking, bundle budgets, lint and token checks still run globally.
- Both desktop and mobile projects run for every selected smoke spec. The plan
  and fallback reason appear in the Actions step summary.

When adding routes or changing shared flows, review the smoke map together with
the tests. This map describes existing coverage; it does not create coverage for
pages without dedicated tests. Keep global lint/type/build checks enabled.

## Local checks

From `frontend/`:

```sh
bun run test:unit --run scripts/ci-affected.test.ts
CI_EVENT=push CI_BASE=<previous-sha> CI_HEAD=<current-sha> bun scripts/ci-affected.ts plan
bun scripts/ci-affected.ts unit
bun scripts/ci-affected.ts smoke
```

The plan is stored under ignored `node_modules/.cache`. A missing plan fails
rather than silently skipping checks. Production timings must be measured in
GitHub Actions after rollout; local checks do not measure FTPS or runner setup.
