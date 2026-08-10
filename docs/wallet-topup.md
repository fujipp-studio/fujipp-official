# Wallet Top-up Feature

`wallet-topup@1.0.0` provides a per-bot member wallet with TrueMoney Voucher
and PromptPay/SlipOK top-ups. Amounts are integer satang and every successful
credit is recorded in an append-only ledger.

## Presentation slots

The feature exposes editable slots including `panel`, `balance`, `method_selector`,
`minimum_warning`, `promptpay_qr`, `expired`, `processing`, `failed`, and
`succeeded`, `admin_notification`, `history`, `monthly_summary`, and
`leaderboard`. Each definition stores a `mode` of `EMBED` or `COMPONENTS_V2`;
different slots may use different modes.

Simple definitions use `title`, `description`, `image_url`, and `actions`. An
advanced override may instead provide complete Discord `components` or `embeds`
arrays. Nested strings receive variable substitution, and an object such as
`{"action":"wallet.topup"}` expands to the stable reusable Discord button.

Common variables include `{{member_mention}}`, `{{member_avatar_url}}`,
`{{amount}}`, `{{balance}}`, `{{currency}}`, `{{payment_method}}`,
`{{transaction_time}}`, `{{minimum_amount}}`, `{{truemoney_fee}}`,
`{{account_name}}`, `{{remaining_time}}`, `{{qr_url}}`, `{{session_id}}`,
`{{failure_code}}`, and `{{failure_reason}}`.

Reusable actions use stable codes: `wallet.topup`, `wallet.balance`,
`wallet.promptpay`, and `wallet.truemoney`. Another Feature presentation may
reference these codes without copying message-specific Discord custom IDs.

## Configuration

- `PANEL_COMMAND_NAME`
- `MIN_TOPUP_SATANG`
- `TRUEMONEY_FEE_SATANG`
- `TRUEMONEY_FEE_MODE` (`FIXED` or `PERCENT`)
- `TRUEMONEY_FEE_PERCENT` (0–100)
- `TRUEMONEY_PHONE`
- `PROMPTPAY_ID`
- `PROMPTPAY_ACCOUNT_NAME`
- `PROMPTPAY_QR_EXPIRY_MINUTES` (1–60 minutes; default 5)
- `SLIPOK_BRANCH_ID` (encrypted secret)
- `SLIPOK_API_KEY` (encrypted secret)
- `SLIP_CHANNEL_ID`
- `SLIP_SUBMITTER_ROLE_ID`
- `TOPUP_NOTIFICATION_CHANNEL_ID`
- `WALLET_ADMIN_ROLE_ID` (optional; Discord Administrators are always allowed)
- `TOPUP_MEMBER_ROLE_ID` (optional permanent paying-member role)
- `WALLET_HISTORY_DEFAULT_LIMIT`
- `TOP_SPENDER_TOP1_ROLE_ID`
- `TOP_SPENDER_TOP10_ROLE_ID`
- `TOP_SPENDER_MILESTONE_ROLES`
- `TOP_SPENDER_LEADERBOARD_CHANNEL_ID`

PromptPay sessions expire after the per-bot `PROMPTPAY_QR_EXPIRY_MINUTES` value.
A member with the configured role
may attach the bank-slip image in `SLIP_CHANNEL_ID`; the runner pairs it with
that member's latest pending session. `/topup-slip session:<id> slip:<attachment>`
remains available as a fallback. The Backend sends the Discord CDN
URL to SlipOK with `log: true` and the exact expected amount. SlipOK therefore
checks duplicate slips, amount, and the configured receiving account; the local
ledger independently enforces unique provider references and idempotency.

The QR response updates `{{remaining_time}}` every second and expires
automatically. Its link button opens the configured slip channel. Slip messages
recover the latest pending database session after a runner restart instead of
depending only on in-memory runtime state.

`MIN_TOPUP_SATANG` applies to PromptPay. TrueMoney fees can be a fixed satang
amount or a percentage; percentage fees are rounded to the nearest satang.

## Internal API

All routes require `X-Runner-Token`:

- `GET /internal/v1/wallet/balance`
- `POST /internal/v1/wallet/topups/truemoney`
- `POST /internal/v1/wallet/topups/promptpay`
- `POST /internal/v1/wallet/topups/slip`
- `POST /internal/v1/wallet/adjustments`
- `GET /internal/v1/wallet/history`
- `GET /internal/v1/wallet/monthly-summary`
- `GET /internal/v1/wallet/leaderboard`

`/wallet-admin balance|add|remove|set` is restricted to Discord Administrators
or `WALLET_ADMIN_ROLE_ID`. Every change requires a reason and creates an
append-only `ADJUSTMENT` entry containing the actor, operation, and reason.

`/history`, `/topup-monthly`, and `/top` are administrator-only. Lifetime rank
totals include successful `TOPUP` ledger entries, not manual adjustments. The
temporary slip role is granted for the active QR window and removed after
success or expiry; an optional permanent member role is granted after success.

TrueMoney redemption is settled through the existing Voucher Service. Both
providers call the same atomic database credit function so retries return the
existing ledger result without increasing the balance twice.

SlipOK behavior follows the official [check-slip documentation](https://slipok.com/api-documentation/),
including duplicate, amount, and receiver checks.
