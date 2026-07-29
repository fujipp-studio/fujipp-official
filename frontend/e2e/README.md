# Local authentication E2E

This Playwright test verifies the local email authentication flow:

1. Sign up with a unique email.
2. Read the confirmation email from local Mailpit.
3. Open the confirmation link.
4. Confirm that the authenticated Navbar shows the Backend user.
5. Reload and confirm that the session is restored.
6. Sign out and sign in again with the same email and password.

## Prerequisites

From the repository root, start Supabase:

```bash
supabase start
```

On macOS, you can instead double-click `scripts/auth-e2e.command` to start the
required local services and run the headed E2E test.

Playwright starts an isolated Vite frontend on `http://127.0.0.1:5174` and a
local-profile Backend on `http://127.0.0.1:8081`, then stops both after the test.
This prevents E2E from accidentally using a development or production Backend
already running on port `8080`.

Install Chromium once:

```bash
cd frontend
bunx playwright install chromium
```

## Run

Headless:

```bash
cd frontend
bun run test:e2e
```

Show the browser:

```bash
bun run test:e2e:headed
```

Interactive Playwright UI:

```bash
bun run test:e2e:ui
```

Failure screenshots, video, and traces are written under `test-results/`.

This suite intentionally does not automate Google, Discord, or GitHub login.
Those providers may require consent, CAPTCHA, or two-factor authentication.
