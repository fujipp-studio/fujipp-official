# Infrastructure Changelog

| Date | Change |
| --- | --- |
| 2026-11-01 | Standardized Discord CI reports with English status labels, FUJIPP STUDIO branding, clear revision metadata and compatible updates to existing cards. |
| 2026-11-01 | Consolidated CI/CD notifications into one Discord card per revision with durable message updates, failure links and recovery that avoids uncertain duplicate sends. |
| 2026-11-01 | Waited for the final PostgreSQL instance in Database CI, preventing bootstrap readiness races from blocking otherwise successful application releases. |
| 2026-11-01 | Gated Backend and Frontend releases on verified VPS migrations while avoiding application image publishing and container restarts for database-only changes. |
| 2026-11-01 | Added dependency-aware Backend/Runner feature checks, reusable runtime image layers and service-scoped deployments with preserved peer images and tested rollback. |
| 2026-10-31 | Added shared feature-based test selection, four smoke-test shards and content-hash FTPS deployment with verified release state, interrupted-upload recovery and delayed owned-file cleanup. |
| 2026-10-28 | Scoped the secret-scan exception to one synthetic Discord ID in the Payment Trigger API fixture while retaining detection for other IDs and files. |
| 2026-10-27 | Included fontconfig and a bundled Thai font so Backend QR text watermarks render in the production container. |
| 2026-10-21 | Added a private resource-limited VPS PostgreSQL stack, scheduled backups, snapshot verification and isolated Backend migration rehearsals. |
| 2026-10-21 | Reduced duplicated Frontend CI/CD work with affected test selection, parallel checks, dependency caching, a reusable production build artifact, and Vue-aware dependency parsing that resolves the new CodeQL finding. |
| 2026-10-20 | Added per-feature configuration bundle budgets, made Vue development tools opt-in, and normalized Maven wrapper line endings so merged CI checkouts remain clean. |
| 2026-10-11 | Included shared Price Reader logic changes in Frontend verification and deployment triggers. |
| 2026-10-08 | Bounded Frontend CI verification and browser installation, using the HTTPS Ubuntu mirror to prevent stalled dependency downloads. |
| 2026-09-30 | Updated the Bot Runner dependency lockfile to clear the high-severity npm audit gate. |
| 2026-09-08 | Enforced initial and route-specific JavaScript/CSS bundle budgets in Frontend CI. |
| 2026-08-30 | Added Semantic token checks and isolated Desktop/Mobile browser smoke tests to Frontend verification. |
| 2026-08-27 | Added production runtime configuration and fail-fast deployment validation for PromptPay and SlipOK credentials. |
| 2026-08-11 | Added configurable in-process runtime snapshot caching without introducing another production service. |
| 2026-08-10 | Added verified Explicit FTPS delivery for production Frontend releases on shared hosting. |
| 2026-08-10 | Isolated temporary GHCR credentials for production image pulls without changing legacy registry access. |
| 2026-08-10 | Added health-checked parallel Backend delivery with immutable container releases and automatic rollback. |
| 2026-08-10 | Grouped non-major dependency updates by ecosystem and made Java and secret security scans organization-compatible. |
| 2026-08-01 | Added a resource-limited multi-bot Discord Runner and Docker Compose deployment for an 8 GiB VPS. |
| 2026-07-29 | Added isolated local authentication commands, branded confirmation email configuration, and CAPTCHA-ready Supabase settings. |
