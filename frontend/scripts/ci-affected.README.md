# Frontend feature map and incremental FTPS deployment

`frontend-cd.yml` runs Quality, Build and Smoke concurrently. The `verify` job
remains the required aggregate check. Deploy waits for it and downloads the
production build artifact instead of installing packages and building again.
On main, Deploy also waits for the shared
[VPS Database gate](../../docs/database-delivery.md), so pending schema changes
are checked and applied before FTPS publication. The database workflow uses the
existing `production` environment; FTP credentials remain scoped separately.
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
13m 07s and FTPS upload took 3m 54s. Measure both steps after rollout; sharding
and hash-based uploads address different parts of that time.

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
bun run test:unit --run scripts/ci-affected.test.ts scripts/deploy-ftps.test.ts
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

## FTPS file ownership and release state

`deploy-ftps.ts` inventories **all final build files**, including dotfiles, with
SHA-256 and size. Source ownership does not define build ownership: shared chunks
may change outside an edited source folder, so the full build is still compared.
Unchanged content is skipped even if build timestamps change; same-size changes
are uploaded. No full remote tree scan or timestamp-based mirror is used.

The generated plan and manifests live in ignored
`node_modules/.cache/ftps-deploy/` and are backed up as Actions artifacts for 30
days. A small `.fujipp-deploy-state.json` alongside the hosted site persists the
cross-run baseline, so runner cleanup and artifact expiration do not lose state.
It contains release IDs, deployed paths/hashes/sizes and retirement dates, never
credentials or source code. Plan artifacts describe intent; `committed.json` is
created only after verification, cleanup and the remote success-state write pass.

Deployment phases:

1. **Prepare:** read the remote state through certificate-verified explicit FTPS,
   then calculate changed/new files and expired previously managed files locally.
   List only the root once to identify a missing baseline. Connection, login,
   permission and invalid-state errors fail instead of silently trusting a cache.
2. **Upload:** mark the remote state `pending` before changing build files. Stage
   changed files under temporary names, transfer up to four in parallel, and rename
   them into place. Publish Discord preview HTML and `index.html` after assets.
3. **Verify:** fetch the live HTML, JS entry and Discord preview over HTTPS and
   compare their bytes with the downloaded build artifact. No manifest is promoted
   and no retired files are removed unless verification passes.
4. **Finalize:** remove expired owned files, then commit a `succeeded` state by
   temporary upload and rename. Unknown hosting files are never deletion targets.

The first deployment uploads everything and adopts only the new build as owned
files; it deliberately leaves untracked legacy files alone. An identical next
build uploads no build files. Removed files are retained for seven days for open
tabs and rollback clients, then deleted during the next successful deployment.
No separate cleanup scheduler runs. Reintroduced files leave the retirement list.

An interrupted upload, failed verification or interrupted cleanup leaves `pending`
state. The next deployment reuploads the entire desired build before resuming
incremental operation, including when returning to an older build. Ownership of
partially uploaded files is retained for later cleanup. A malformed state fails
closed for investigation. A transfer failure does not automatically restore the
previous HTML; rerun a known-good release to recover.

Out-of-band FTP edits are not detected by a hash baseline. Use the manual workflow
input `force_full_upload` to repair the live files while preserving ownership.
Keep production deployments serialized; only this workflow should write this
manifest. HTML publishing covers two entry files, not an atomic directory switch.
Non-hashed files can change while old tabs remain open.

Managed build paths currently include `assets/`, `icons/`, `images/`, `data/`,
the two HTML files, `.htaccess`, `.vite/manifest.json`, `robots.txt`, `sitemap.xml`
and `apple-touch-icon.png`. Adding a new top-level public output requires updating
the path allowlist and its tests. Unsupported characters, symlinks, traversal and
file/directory transitions fail before remote mutation. Expired-file cleanup also
removes its reserved transfer-temporary name. Empty directories and untracked
legacy temporary files are not recursively removed.

## Local deploy rehearsal (no hosting access)

From `frontend/`, after building:

```sh
bun scripts/deploy-ftps.ts plan --release=local-first
bun scripts/deploy-ftps.ts plan --release=local-next --state=node_modules/.cache/ftps-deploy/succeeded.json --out=node_modules/.cache/ftps-next
```

Review `plan.json`, staged uploads, and generated `upload.lftp` / `finalize.lftp`.
`plan` never connects to a server. `prepare`, `upload` and `finalize` are production
commands requiring an FTPS target and protected `.netrc` credentials; finalize also
requires fresh verification evidence from the HTTP verification step. `--force`
can be used for local repair rehearsals. The deploy job installs Bun and lftp;
it does not install application packages or rebuild the frontend.

With lftp installed, `python3 scripts/verify-ftps-commands.py` exercises the real
client against temporary local directories, including an interrupted parallel
upload, recovery, existing directories, publication ordering and repeated cleanup.
This also runs in the deploy job before FTP credentials are configured. Unit tests
use a filesystem-only test double for the complete prepare/upload/verify/finalize
CLI lifecycle. These rehearsals do not measure Rukcom network behavior or timing.
