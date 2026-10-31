# Backend and Bot Runner delivery

The Backend workflow selects services and affected feature tests, verifies them, publishes runtime images
from the tested build outputs, then updates only selected VPS containers.
`deploy/ci-services.json` describes service roots and shared contract boundaries.
Keep that map current when moving internal APIs, DTOs or runner client types.
`deploy/ci-feature-map.json` links feature folders/files to routes, tests, guides
and explicit feature dependencies. Read it before changing a feature and update
its ownership and coverage when adding or moving code.

## Selection and checks

- PRs compare base/head commits. Main pushes compare against the latest successful
  **deploy job** on main, rather than the previous push. Failed releases, queued
  pushes and successful test-only runs therefore cannot hide pending code changes.
- Runner feature changes select Runner; backend implementation changes select
  Backend. Unknown files inside either service select that service conservatively.
- API controllers, request/response/status classes, Runtime/bootstrap/configuration,
  Runner API/types, migrations and delivery infrastructure select both services.
  This is deliberately broader than just DTO syntax; semantic contract changes
  outside these boundaries must update the map or include the affected service.
- Test-only changes validate the affected service without publishing or deploying.
  Delivery test changes validate both. Markdown outside runtime source and unrelated
  frontend/docs changes do not deploy application services.
- Manual runs and missing/unreadable deployment history validate and publish both.
  Only main can publish/deploy. API history requires the plan job's read-only
  `actions: read` permission; PR selection never reads production credentials.
- `verify` requires the plan, deployment rehearsals and every selected service check
  to succeed. Only deliberately unselected jobs may be skipped. The publish matrix
  contains only release services, so tests/docs-only runs do not create empty images.

Keep the `verify` aggregate check required in branch protection. The workflow also
enforces this gate before publishing/deploying regardless of branch protection.

## Feature tests and dependency coverage

Selection follows reverse Java type references and local TypeScript imports from
changed sources to their consumers and tests. It also expands the feature map's
`dependsOn` entries. Backend behavior changes include relevant Runner client
tests without publishing or restarting an unchanged Runner. For example:

- Runner Ticket mention changes select Ticket tests plus baseline registry/error
  checks; Backend is not selected.
- TrueMoney adapter changes select voucher, wallet and dependent purchase/payment
  checks, including relevant Runner clients. Backend currently falls back to its
  full suite because dependent Robux behavior lacks dedicated Backend tests.
  Only the Backend image is released.
- API contracts and delivery changes select both full suites and both releases.

Java reference matching deliberately includes same-package references and may
select extra consumers. Reflection, computed imports and dependencies without a
source reference need explicit map entries. The Runner graph is checked against
TypeScript's import parser as part of its baseline tests. Compilation still
covers the entire selected service, even when only some tests run.

Shared code, unknown/deleted sources, manual runs and affected features without
dedicated tests (including dependent features) use full service suites.
Test-only edits run the changed tests and baseline
checks. The only traversal boundary is the version registry, whose behavior is
always tested; shared configuration dispatch remains a full-suite change because
its validators can affect other feature writes. A new Runner feature folder
without an explicit owner fails map validation rather than silently skipping it.

Inspect a local test selection without running tests:

```sh
python3 deploy/ci-feature-tests.py bot-runner/src/features/ticket/mentions.ts
python3 deploy/ci-feature-tests.py backend/src/main/java/com/fujipp/backend/voucher/TrueMoneyVoucherAdapter.java
```

CI passes the selected file lists to `deploy/ci-run-tests.py`. This validates
paths and invokes Maven with fully qualified test classes or Node with explicit
test files; it does not disable missing-test failures. The plan summary records
feature scopes, test counts and full-suite fallback reasons.

## Compile once, publish the tested outputs

Backend runs Maven `verify`, including selected tests and executable JAR packaging. Its
artifact is uploaded as `app.jar`. Runner runs its TypeScript build, audit and
tests, then archives `dist/`. Only selected main releases upload artifacts.

The publish jobs download artifacts from **the same workflow run** and use
`backend/Dockerfile.runtime` or `bot-runner/Dockerfile.runtime`. These images have
no compilation stages. Backend extracts the tested Spring Boot JAR into dependency,
loader, snapshot and application layers. Extracted timestamps are normalized so
an application-only change preserves dependency layer digests across builds.
Runner installs production npm dependencies in a separate layer before copying
`dist/`. It still installs those dependencies inside
Alpine so native packages match the target libc/architecture; Ubuntu CI
`node_modules` are never copied into Alpine. Both images carry the source revision
label and immutable commit tags. Artifacts expire after one day; image layer
caches use independent `backend-runtime` and `bot-runner-runtime` scopes.

The original Dockerfiles remain available for local Compose builds, where source
compilation is expected. No application build runs on the VPS.

## Scoped rollout and rollback

The deployment script accepts the original five arguments plus optional
`both`, `backend` or `bot-runner` (default `both`). Production paths are unchanged.
`FUJIPP_DEPLOY_APP_DIR` and `FUJIPP_DEPLOY_RUNTIME_ENV` are overrides for isolated
local rehearsals; the workflow uses their production defaults.

1. Upload files into `.incoming`, then stage Compose as
   `compose.production.candidate.yml`. The active Compose definition stays intact
   until the script has validated the existing release and pulled selected images.
2. Partial deployments require an existing immutable release and a running peer.
   Compose changes require both services; a Runner-only deployment cannot change
   the Backend port. Missing state alongside existing containers fails for inspection.
3. Keep the unselected image reference exactly as it was. A release may therefore
   contain two different commit tags. Never replace the unselected image with the
   current workflow's tag: that image may not have been built.
4. Pull only selected images before changing active release/configuration files.
   A pull failure leaves both running containers and the active release untouched.
5. Deploy Backend first when selected and check its public health endpoint before
   starting a selected Runner. Use `up --no-deps --wait` only for selected services.
   Inspect both services afterward without starting or recreating the unselected one.
6. On failure, restore the previous Compose definition and mixed image references.
   Stop only an attempted new Runner, restore an attempted Backend first, then
   restore the attempted Runner. Use cached old images with `--pull never` so
   recovery does not depend on registry availability. Rollback failures are explicit.

`previous-release.env` and `previous-compose.production.yml` retain the preceding
release for inspection. A failed first installation removes only its newly
created services and restores the initial configuration state. Release files are
parsed as data and validated; they are never sourced as shell code.

Main deployments remain serialized; new pushes do not cancel an active rollout. Operators
should use this workflow for releases: out-of-band manual image rollbacks are not
represented in GitHub deployment history. A manual full run reconciles both
services. Runtime environment/secret changes also need a deliberate full rollout,
because they are not stored in the Git diff. Do not prune rollback images during
deployment. Database migration/rollback remains a separate process.

## Runner readiness

New Runner images have an image-level healthcheck. The supervisor atomically writes
a private heartbeat only after a successful authenticated bootstrap/reconcile (or
ETag refresh). Startup and shutdown remove stale heartbeats. The healthcheck requires
a live supervisor PID and a heartbeat no older than the greater of 90 seconds or
three poll intervals. Docker checks every ten seconds, with a 30-second startup
grace and three retries. Failed bootstrap/authentication cannot report ready.

This proves supervisor/backend readiness, not that every Discord bot or feature
has activated successfully; individual runtime status remains the authority there.
Docker's restart policy does not itself restart an unhealthy running container;
the deployment wait fails and invokes rollback. Existing images without this
healthcheck still use the running-state check when rolled back, so the Compose
file does not reference a health script missing from old images.

## Validation

From the repository root:

```sh
python3 -m unittest discover -s deploy -p 'test_*.py' -v
bash -n deploy/deploy-backend.sh
```

These tests use temporary directories and Docker/curl test doubles, never the VPS.
They execute the real workflow gate and deploy script and cover selected services,
failed pulls, health failure, first installation, changed Compose, immutable
references, scoped rollback, feature dependencies and conservative fallbacks.
Runner heartbeat tests use temporary files and
no Discord connection. Runtime images should additionally be built from the
verified JAR/dist and rehearsed locally before release. Measure CI and deployment
durations in Actions after rollout; local timings do not include GHCR or VPS latency.
