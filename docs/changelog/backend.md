# Backend Changelog

| Date | Change |
| --- | --- |
| 2026-10-27 | Added Wallet-backed Discord role purchases with atomic debits, duplicate protection, refunds and restart recovery, and restored QR images in existing Wallet designs. |
| 2026-10-26 | Applied lifetime spending corrections to the active monthly cycle by their amount/count differences, with atomic rollback, retry protection, underflow checks and immediate monthly role refresh. |
| 2026-10-26 | Fixed Member Spending ranking roles under Discord Gateway rate limits, including servers with more than 1,000 members, and added feature-specific error Embeds with private fallbacks and partial-success warnings while preserving configured failure designs. |
| 2026-10-26 | Added opt-in monthly spending with configurable cycles, retry-safe updates and optional ranking roles, and applied feature Embed and Components V2 designs without restarting bots. Patched the Discord HTTP dependency to pass the security audit. |
| 2026-10-23 | Added public seasonal-effect settings reads and validated Admin-only updates with persisted editor attribution. |
| 2026-10-22 | Added Message Sets 1.1.0 commands to send SETs and update existing bot messages by ID with ownership checks. |
| 2026-10-21 | Added an opt-in VPS identity projection from verified Supabase JWTs, preserving database-controlled account roles and status. |
| 2026-10-21 | Reduced repeated runtime configuration reads while preserving state and expiry refreshes, and retained caches when reconciliation makes no changes. |
| 2026-10-21 | Added separate open/close Role pings to Shop Status, validating mentioned roles and their permissions before changing the shop while retaining independent everyone controls. |
| 2026-10-21 | Added independent opt-in @here/@everyone pings for Shop Status announcements with permission checks while keeping private replies and other features non-pinging. |
| 2026-10-21 | Added optional Shop Status announcement channel names for opening and closing, with permission checks, unchanged-name skips, and name/permission rollback on failed status changes; patched the vulnerable redirect dependency used by Bot Runner. |
| 2026-10-20 | Restored Member Spending 1.0.0 installations excluded from Runner bootstrap after legacy database startup failures, while retaining license, bot, configuration, removal, and disabled-state restrictions. |
| 2026-10-20 | Kept Member Spending commands available when an external database fails during bot startup, added connection retries and immediate acknowledgements, and verified recovery after installing Shop Status. |
| 2026-10-20 | Added configurable Shop Status announcement delivery with persistent message tracking and admin-only user Feature revocation with ownership checks, transactional installation removal, core protection, and runtime invalidation after commit. |
| 2026-10-20 | Added customizable shop open/close commands with role-based channel permissions and validation, and grouped donation rankings by account. |
| 2026-10-11 | Added validated Price Reader customization with configurable matching tolerance, shared result formatting, and separate all-failed message designs. |
| 2026-10-10 | Rejected empty and oversized Components V2 button rows before saving or sending, and kept Message Sets commands available after individual send failures, including recovery of affected installations. |
| 2026-10-08 | Changed Message Sets to post ordinary bot messages without public slash-command attribution and confirm success or failure privately to the caller. |
| 2026-10-08 | Added named Message Sets with live configuration updates without restarting bots, command ownership protection, and server-side validation of twenty unique SETs. |
| 2026-10-07 | Fixed Member Spending external database connections to prefer IPv4, fall back across validated addresses, and explain IPv6-only connection failures. |
| 2026-10-05 | Fixed Member Spending cards to show the selected customer’s Discord avatar, including server profiles and default-avatar fallback. |
| 2026-10-04 | Fixed customer-owned PostgreSQL connections for Member Spending while preserving validated IP pinning and TLS hostname verification. |
| 2026-09-30 | Added precise Roblox payout test diagnostics for blocked sessions, including challenge stage and provider retry timing when available. |
| 2026-09-30 | Fixed administrator Feature grants so their licenses include the configuration needed for Bot installation. |
| 2026-09-30 | Added an isolated administrator Roblox payout test with challenge reporting and a confirmed 1 Robux transfer. |
| 2026-09-26 | Added per-panel storefront and membership-only modes to Roblox Robux Payout 3.0. |
| 2026-09-23 | Added Roblox Robux Payout 3.0 with independently styled and refreshed sales panels, panel-scoped groups, and group-specific package rates. |
| 2026-09-12 | Added category channel-created messages and administrator-only exact-text Triggers that remove the source message before sending a configured template. |
| 2026-09-09 | Added optional image attachments to administrator-created Robux receipts and placed them last in the Components V2 message. |
| 2026-09-09 | Removed group details from administrator-created receipts, added a `เติม โรพลัส` Package suggestion, and supported optional recipient DMs. |
| 2026-09-08 | Added Roblox Robux Payout 2.2 with separate successful-purchase receipts delivered to members and a configured receipt channel. |
| 2026-09-08 | Batched portfolio summary queries, added owned-Bot reads and portfolio overview metadata, and returned wallet balance with paginated history without duplicate reads. |
| 2026-09-06 | Added Review Credit 1.1 with webhook-aware review counting and an administrator command for replacing the saved count. |
| 2026-09-06 | Added administrator-only Feature removal from customer Bots with soft removal, Core Feature protection, and immediate Runtime bootstrap invalidation. |
| 2026-09-06 | Added Roblox Robux Payout 2.1 with successful-purchase DM receipts and Wallet Top-up 2.1 with modal-based administrator adjustments and public Components V2 results. |
| 2026-08-29 | Added Roblox Robux Payout 2.0.1 with a longer purchase username field and clearer purchase form title while preserving earlier versions. |
| 2026-08-28 | Registered the Voice Keeper slash command globally and preserved it across Runner restarts. |
| 2026-08-27 | Added authenticated website wallet top-ups with first-party PromptPay QR generation, SlipOK verification, atomic balance credits, and cursor-paginated customer invoice history. |
| 2026-08-22 | Eliminated runtime bootstrap N+1 queries, added cache-aware metrics and invalidation, and introduced backward-compatible cursor-paginated APIs for growing collections. |
| 2026-08-13 | Added Wallet Top-up 2.0 with serialized Top Spender synchronization and full Discord-member reconciliation so Top 1 and Top 10 roles cannot remain over-assigned. |
| 2026-08-12 | Isolated the temporary Wallet slip role from Top Spender synchronization, retried expired-session cleanup, and enforced slip-role removal as the final successful top-up step. |
| 2026-08-12 | Added customer License upgrades and administrator access to installed Feature configuration on customer Bots. |
| 2026-08-12 | Added Price Reader 2.0 with standard purchase-price selection, Nitro-price exclusion, and simplified shop results. |
| 2026-08-11 | Reduced repeated runtime bootstrap database reads and skipped unchanged Runner payloads. |
| 2026-08-01 | Added secure feature-store, bot inventory, checkout, configuration, media administration, and internal runtime APIs. |
| 2026-08-01 | Added public portfolio queries and authenticated project administration APIs with Cloudinary image management. |
| 2026-07-29 | Added Supabase JWT authentication, account authorization, profile APIs, request rate limits, and security auditing. |
