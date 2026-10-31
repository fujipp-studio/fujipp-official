Before changing this frontend, read `ci/feature-map.json` and
`scripts/ci-affected.README.md` relative to this directory.

- Find the owning feature using its `paths` rules. Read that feature's `guides`,
  inspect its `routes`, `dependsOn`, and mapped tests, and follow actual imports
  to identify other affected features.
- Update the map in the same change when adding/moving feature files, routes,
  dependencies, fixtures or tests. More specific paths override `bots-core`.
- Add a new integration boundary only after checking that it dispatches by route
  or feature and that the selected tests exercise that integration. A boundary
  changes test selection; it is not a general way to skip shared-code coverage.
- Run `bun scripts/ci-affected.ts check-map` from this directory. Use the generated
  CI plan to explain the selected tests; AI judgment alone must not skip checks.
- Keep shared/configuration/unknown/deleted-file fallbacks and the global
  lint/type/build/bundle checks. Keep build-output ownership separate from source
  ownership; shared chunks may change outside the edited source folder.
- Follow the repository's `.agents/scopes/frontend.md` validation rules. These
  instructions do not authorize publishing, opening or merging pull requests.
