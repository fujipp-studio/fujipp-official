# Infrastructure Changelog

| Date | Change |
| --- | --- |
| 2026-08-30 | Added Semantic token checks and isolated Desktop/Mobile browser smoke tests to Frontend verification. |
| 2026-08-27 | Added production runtime configuration and fail-fast deployment validation for PromptPay and SlipOK credentials. |
| 2026-08-11 | Added configurable in-process runtime snapshot caching without introducing another production service. |
| 2026-08-10 | Added verified Explicit FTPS delivery for production Frontend releases on shared hosting. |
| 2026-08-10 | Isolated temporary GHCR credentials for production image pulls without changing legacy registry access. |
| 2026-08-10 | Added health-checked parallel Backend delivery with immutable container releases and automatic rollback. |
| 2026-08-10 | Grouped non-major dependency updates by ecosystem and made Java and secret security scans organization-compatible. |
| 2026-08-01 | Added a resource-limited multi-bot Discord Runner and Docker Compose deployment for an 8 GiB VPS. |
| 2026-07-29 | Added isolated local authentication commands, branded confirmation email configuration, and CAPTCHA-ready Supabase settings. |
