# Seasonal effects

The website supports one decorative seasonal effect at a time, independently of
Light / Dark / System color mode. The initial setting is **Off**.

| Value | Appearance | Desktop / mobile maximum |
| --- | --- | --- |
| `NONE` | No decorations | 0 / 0 |
| `HALLOWEEN` | Four ghost illustrations that float, fade, and rotate between visits | 2 / 1 |
| `CHRISTMAS` | Light snowfall, softer over the center of the page | 24 / 10 |
| `VALENTINE` | Small hearts that float up with gaps between visits | 3 / 1 |

## Administration

Open **Admin → Seasonal effects** (`/admin/seasonal-effects`). Select an effect,
preview it privately, then save to change the website. Selecting and previewing do
not write settings. Choose **Off** and save to remove decorations.

The panel supports Thai and English. Its preview uses the same renderer as the
website. Reduced-motion preferences produce still illustrations in the preview
and disable live animations. There is no automatic calendar scheduling.

Settings persist in `private.website_effect_settings`, a singleton row with an
allowlisted effect, update timestamp, and authenticated editor ID. The migration
seeds `NONE`, enables RLS, and grants only SELECT/UPDATE to `service_role`.
Browser database roles cannot read or write this table directly. When present,
the dedicated VPS application role `fujipp_backend` also receives SELECT/UPDATE.

## API

| Method and endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/v1/site/seasonal-effects` | Public | Returns effect and update time, with `Cache-Control: no-cache` |
| `GET /api/v1/admin/site/seasonal-effects` | ADMIN | Reads settings with `Cache-Control: no-store` |
| `PUT /api/v1/admin/site/seasonal-effects` | ADMIN | Saves an allowlisted effect; editor comes from the JWT |

PUT body:

```json
{ "effect": "HALLOWEEN" }
```

Response:

```json
{ "effect": "HALLOWEEN", "updatedAt": "2026-10-23T08:00:00Z" }
```

The public DTO never includes the editor ID. Invalid names, numeric enum values,
and missing/null effects are rejected. Existing account checks and rate limits
apply. API tests exercise anonymous, non-admin, and admin access.

## Browser lifecycle

- The app fetches settings without delaying page content. Only the lightweight
  host/settings code loads while effects are off; the renderer is loaded on demand.
- Visible pages check for updates every 60 seconds. Returning to a tab refreshes
  settings when stale. Hidden tabs stop polling and remove active animations.
- Successful saves update the current tab immediately. A slow earlier public read
  cannot overwrite that save. Other open pages update on their next poll.
- A failed initial read leaves effects off. Later failures retain the last good
  setting until a successful read; invalid effect values resolve to Off.
- Effects are hidden on admin/auth-callback routes and while dialogs or overlay
  menus are open. Decorations never receive pointer events or keyboard focus.
- CSS handles animation frames. Changing an effect or closing a preview removes
  the previous particles. Ghost artwork changes only at animation boundaries.
- Public color, font, and layout tokens remain unchanged. Decoration-specific
  semantic colors adapt to the existing color mode.

## Development and validation

Frontend commands, from `frontend/`:

```sh
bun run build
bun run test:unit --run
bun run lint
bun run test:smoke seasonal-effects.smoke.spec.ts
```

For a local demonstration without production data, run `bun run dev:smoke` and
open `http://127.0.0.1:5176/admin/seasonal-effects`. This fixture bootstrap uses a
test admin session and in-memory settings; restarting its server resets them.
It is never included in the production entry point.

Backend commands, from `backend/`, with JDK 21:

```sh
./mvnw -Dtest=SeasonalEffectControllerTests,BackendApplicationTests test
```

An additional repository round-trip test runs against **local Supabase only**
after the migration has been applied. It rolls all setting changes back:

```sh
SEASONAL_INTEGRATION_TESTS=true ./mvnw -Dtest=SeasonalEffectRepositoryIntegrationTests test
```

Browser tests cover private preview, saving/reloading, failed-save retry, Thai,
all effect types, reduced motion, overlay suppression, visible refreshes, hidden
tabs, navigation, and disabling effects on desktop/mobile. Visual QA also checks
the admin panel, previews, and live effects in Light and Dark modes.

## Rollout

Apply `20261023000001_create_website_effect_settings.sql` to the database used by
the production Backend's `DB_URL`, then deploy the backend before the frontend.
The migration directory name does not determine the database host. The production
configuration verified on 2026-10-23 points to VPS PostgreSQL database
`migration_cutover_20261022` with the `fujipp_backend` role; Supabase Auth remains
the authentication provider.

Record the applied version in `supabase_migrations.schema_migrations` and retain
the versioned SQL on the VPS. Apply the SQL and history insert in one transaction.
The default remains Off until an admin explicitly saves another effect. Verify the local
database round-trip before deployment when a local Supabase instance is available.
Local tests never activate a production effect. Schema installation leaves the
effect at Off; activation remains an explicit Admin action after code deployment.

### VPS schema verification (2026-10-23)

The migration was rehearsed in a fresh temporary PostgreSQL database on the VPS.
Checks covered the Off default, allowed effect values, singleton constraint, RLS,
editor foreign key, and SELECT/UPDATE under the dedicated backend role. The
temporary database was removed after validation.

The same migration and history entry were then applied atomically to
`migration_cutover_20261022`. Production verification confirmed that
`fujipp_backend` can read the Off setting, the migration version is recorded,
and Backend/Runner/database services remain healthy. The versioned SQL is retained
under `/opt/fujipp/apps/fujipp-postgres/migrations/site/`.

Application code deployment follows the repository's reviewed-main CI/CD flow.
Installing the schema alone does not expose the new API or Admin page.
