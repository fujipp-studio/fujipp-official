# Frontend feature map and CI selection

`frontend-cd.yml` runs Quality, Build and Smoke concurrently. The `verify` job
remains the required aggregate check. Deploy waits for it and downloads the
production build artifact instead of installing packages and building again.
Production build variables are read from `frontend-production`; PR builds use
`frontend-ci` (no production environment access). Existing environment protection
rules apply to the build as well as the deploy job.

Smoke runs across four independent GitHub-hosted jobs with Playwright's
`--shard=1/4` through `--shard=4/4`. Each job computes the same affected-test plan,
then runs its share of the selected Desktop and Mobile tests. File-level
sharding preserves the existing execution order inside each test file. The
aggregate `verify` check requires every shard to pass; a failing shard does not
cancel the others. No tests, retries or production checks are removed.

This trades more concurrent runners and repeated setup for less elapsed time.
Runner availability and uneven test-file durations can limit the speedup. The
2026-10-31 main run `41171490933` took 18m 04s: smoke execution alone took
13m 07s and FTPS upload took 3m 54s. Measure both steps after rollout; FTPS
is unaffected by test sharding.

## Feature ownership for AI and CI

`../ci/feature-map.json` is the shared source of truth. Read it before editing a
feature, as required by `../AGENTS.md`. Every feature records repository-relative
source/fixture paths, browser routes, explicit dependencies, smoke and unit tests,
and guides. Paths ending in `/` match a folder; a trailing `*` matches a filename
prefix. Exact and longer rules take precedence over the broad `bots-core` folder.

Add or update the map with the implementation when moving files, adding a feature,
changing routes or introducing a dependency. `check-map` validates reference
files, smoke coverage names, dependencies and ownership of feature folders. A new
unclassified file inside the shared Bots folder still receives full coverage.

For example, Ticket components select Ticket and history smoke specs. Wallet
changes also select Role Shop and Roblox Payout through their `dependsOn` entries.
AI reads the same routes, guides and coverage that the CI selector uses.

## Selection rules

- Compare PR base/head SHAs, or the previous/current push SHAs. A manual run,
  missing comparison, deleted file, unknown path or shared/configuration change
  runs all tests.
- Feature-local changes select coverage from the map. Reverse static imports,
  re-exports and literal lazy imports extend selection to consuming features and
  test files. Declared dependencies expand coverage transitively, including
  relationships that do not appear as source imports.
- Documented integration boundaries stop traversal through the route registry
  and feature-code dispatchers. Editing a dispatcher itself still runs all tests.
  Check its feature isolation and integration coverage before adding a boundary.
- Shared Auth and Bots core changes run the full suite. Unknown paths, shared
  fixtures, new unclassified features, deletions and map/configuration edits also
  fall back to full coverage. Computed imports need explicit map relationships.
- Units include mapped/directly affected tests plus Vitest `related` for changed
  source files. These can overlap; correct coverage takes priority over avoiding
  a short repeated unit run. Unit-only edits skip smoke; smoke-only edits skip
  units. Global lint, type checking, build, bundle budgets and token checks remain.
- Both desktop and mobile projects run for every selected smoke spec. The plan
  and fallback reason appear in the Actions step summary.

When adding routes or changing shared flows, review the smoke map together with
the tests. This map describes existing coverage; it does not create coverage for
pages without dedicated tests. Keep global lint/type/build checks enabled.

## Local checks

From `frontend/`:

```sh
bun scripts/ci-affected.ts check-map
bun run test:unit --run scripts/ci-affected.test.ts
CI_EVENT=push CI_BASE=<previous-sha> CI_HEAD=<current-sha> bun scripts/ci-affected.ts plan
bun scripts/ci-affected.ts unit
bun scripts/ci-affected.ts smoke
bun scripts/ci-affected.ts smoke --shard=1/4
```

Extra arguments after `smoke` are passed to Playwright after the selected spec
paths, so `--list`, `--project` and `--shard` work for full and affected plans.

The plan is stored under ignored `node_modules/.cache`. A missing plan fails
rather than silently skipping checks. Production timings must be measured in
GitHub Actions after rollout; local checks do not measure FTPS or runner setup.
