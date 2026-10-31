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
