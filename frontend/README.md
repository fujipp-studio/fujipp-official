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
    api/                         Transport, visible-page collections and visibility polling
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
- Settings load and poll `GET /api/v2/bots/{botId}`, which checks ownership on the
  Backend. The My Bot dashboard uses the same visibility-aware polling scheduler;
  requests never overlap within a poll flow and stop when the scope is disposed.
- Work requests the visible 4/6-item page and a separate overview for category totals
  and featured cards. Its bounded public cache expires after 60 seconds and is cleared
  on editor exit or retry. Admin users and wallet history load 50 rows at a time through
  the existing scroll surface. Wallet v2 returns current balance and cursor metadata
  in one contract. Complete inventories and selectors still aggregate cursor pages.
- `useFeatureSettings` handles configuration loading/saving and field conversion;
  `usePresentationEditor` handles message edits. Their typed context lives only within
  the feature editor tree. The editor CSS is nested under `.feature-settings` so it
  applies to extracted children without leaking to other pages.
- Admin pages are children of the persistent Admin layout. Add a lazy child route
  with `adminSection` metadata instead of another manual component switch.
- Add UI copy to matching EN/TH namespaces and register new route namespaces in
  `i18n/index.ts`. The router loads required copy before rendering, and language changes
  prepare both selected-language messages and English fallbacks before switching.
  Feature-specific overrides for labels
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
They also check sequential/hidden-tab polling, stale page cancellation, lazy translation
loading, and internal-link keyboard/modifier/disabled behavior.

For deterministic browser tests without a real account or Backend:

```sh
bunx playwright install chromium
bun run test:smoke
```

The smoke suite runs Chromium at Desktop and Mobile sizes. It covers role guards,
Admin navigation/account edits, checkout retry idempotency, configuration/message
saving, load-error retry, navigation and Light/Dark themes. CI runs this suite.
It also checks Home-to-Work navigation without a document reload, Work Load more/filter
behavior, and scroll-driven Admin users and wallet history pagination.

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
check. CI also runs the budget check against the normal build. Initial JS must stay at
or below 180 KiB gzip and CSS at or below 50 KiB gzip. Route JS limits are Home 150,
Work 160, My Bot 230, Feature config 250 and Presentation editor 260 KiB gzip; each
includes both languages, required async components and the session SDK where needed.
The check also keeps the Auth dialog out of the initial bundle. Images, fonts, API
payloads and browser responsiveness need separate measurement.

Original artwork that is no longer served lives in `artwork/archive/`; it is retained
for editing without being copied into `dist/`. See the measured baseline and outcome
in [the frontend performance audit](../docs/frontend-performance-audit.md).

Release the Backend endpoints before this Frontend: `/api/v2/works/overview`,
`/api/v2/bots/{botId}`, and wallet-history v2 metadata. No database migration is needed.

Production hosting should serve hashed `/assets/*` with
`Cache-Control: public, max-age=31536000, immutable`, `index.html` with
`Cache-Control: no-cache`, and enable Brotli/gzip. These headers belong to the web
server/CDN; the current deployment uploads static files over FTPS.
