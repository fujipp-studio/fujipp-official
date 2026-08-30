# Fujipp frontend

Vue 3 + TypeScript application built with Vite and Bun. Vue Router owns navigation,
Pinia holds session/theme state, and Tailwind CSS v4 consumes the shared design tokens.

## Run locally

Use the Bun version pinned in `.github/workflows/frontend-cd.yml` (currently 1.3.14).

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Configure the public Supabase URL/key, Backend URL, Turnstile site key, and site URL
in `.env.local`. Never place private service keys in `VITE_*` variables or commit
real environment files. The normal app needs the Backend and Supabase for signed-in
features; public pages can render without a session.

## Source structure

```text
src/
  features/
    auth/api.ts                  Account API and current-user types
    admin/api/                   Users, bots, packages, runtime administration
    bots/
      api.ts, runtime-api.ts     Bot/license and runtime endpoints
      components/                Config fields, Embed and Components V2 editors
      composables/               Shared settings data and editor controllers
      config/                    Feature-provided field/message descriptions
      models/                    Presentation model helpers
      styles/                    Styles scoped to the feature root
      views/                     Routed pages and persistent settings shell
    store/, topup/, work/        Feature-owned API contracts and UI
  shared/
    api/http.ts                  Headers, typed errors, cancellation, timeout, cursors
    layout/navbar/               Navbar, user menu, mobile navigation
    ui/                          Reusable controls and request-error feedback
  router/                        Lazy routes, nested layouts, authentication/role guards
  stores/                        Shared authentication and theme state
  i18n/locales/{en,th}/           Translation namespaces
  styles/                        Semantic colors, typography, spacing and layout tokens
  __tests__/                     Unit/integration tests and synthetic fixture data
```

`services/seo.ts` remains the document metadata adapter. Feature API consumers import
from the owning feature; there is no all-features Backend barrel.

## Adding or changing a feature

- Keep endpoint paths, DTOs and domain behavior with their feature. Use the shared
  transport for headers, response handling and bounded requests. Do not call an API
  directly from a presentational component.
- Let routed views coordinate focused components and composables. Use local state
  for a single view, provide/inject for a persistent route flow, and Pinia only for
  state shared outside that flow. Never put editable secret values into persistent storage.
- The bot settings shell provides one `useBotSettingsData` instance to its children.
  Loads share an in-flight promise, polls run sequentially every three seconds after
  completion, hidden documents pause polling, and disposed/stale responses cannot
  replace current data. Children update this shared state after successful mutations.
- The user API currently exposes a bot list, not a single-bot status endpoint, so a
  status poll still reads the list. Cursor aggregation remains deliberate for complete
  inventories and selectors; large datasets will need a dedicated Backend contract
  before replacing these with visible-page pagination.
- `useFeatureSettings` handles configuration loading/saving and field conversion;
  `usePresentationEditor` handles message edits. Their typed context lives only within
  the feature editor tree. The editor CSS is nested under `.feature-settings` so it
  applies to extracted children without leaking to other pages.
- Admin pages are children of the persistent Admin layout. Add a lazy child route
  with `adminSection` metadata instead of another manual component switch.
- Add UI copy to matching EN/TH namespaces. Feature-specific overrides for labels
  supplied by the Backend are kept in `bots/config/feature-editor.ts`.
- Use Semantic color tokens and shared spacing/radius/layout tokens. Keep mobile as
  the default and use `tablet`, `desktop`, `wide`. Preserve keyboard focus and
  reduced-motion support. Run `check:tokens` to catch nonexistent Semantic references.

## Verification

```sh
bun run type-check
bun run test:unit --run
bun run lint
bun run check:tokens
bun run build
bun run performance:bundle
```

Lint applies fixes; review its diff. Unit/integration tests cover session refresh and
logout races, route roles, API cancellation/errors, shared bot requests and stale
responses, configuration serialization, secrets and failed saves, plus the existing
wallet, authentication UI, inventory and presentation tests.

For deterministic browser tests without a real account or Backend:

```sh
bunx playwright install chromium
bun run test:smoke
```

The smoke suite runs Chromium at Desktop and Mobile sizes. It covers role guards,
Admin navigation/account edits, checkout retry idempotency, configuration/message
saving, load-error retry, navigation and Light/Dark themes. CI runs this suite.

To inspect the same synthetic UI manually:

```sh
bun run dev:smoke
```

Open `http://127.0.0.1:5176/admin` or
`http://127.0.0.1:5176/my-bot/fixture-bot/settings/packages/fixture-license`.
The fixture bootstrap defaults to a fake Admin; append `?role=USER` or `?role=GUEST`
to check access behavior. This separate Vite config serves only on loopback and is
not used by production builds. It does not call Supabase, process payments, or write
real user data. Browser smoke tests do **not** replace the real local email-auth E2E
suite documented in [e2e/README.md](e2e/README.md).

Before committing UI changes, also inspect the affected Desktop/Mobile pages in
Light/Dark and capture screenshots. Automated smoke assertions do not measure
pixel-level visual parity, contrast, or screen-reader usability.

## Production and performance

The normal `bun run build` uses `index.html`; it does not include the fixture entry
or fixture middleware. Keep SPA history fallback enabled (`public/.htaccess`).

`bun run performance` performs the optional performance build and bundle budget
check. Initial JS must stay at or below 180 KiB gzip and initial CSS at or below
50 KiB gzip. This budget does not measure images, fonts, or all lazy routes.

Production hosting should serve hashed `/assets/*` with
`Cache-Control: public, max-age=31536000, immutable`, `index.html` with
`Cache-Control: no-cache`, and enable Brotli/gzip. These headers belong to the web
server/CDN; the current deployment uploads static files over FTPS.
