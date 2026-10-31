# Wallet Top-up Feature

`wallet-topup` provides a per-bot member wallet with TrueMoney Voucher
and PromptPay/SlipOK top-ups. Amounts are integer satang and every successful
credit is recorded in an append-only ledger.

In version `2.1.0`, `/wallet-admin add|remove|set member:<member>` opens a modal
for the amount and audit reason. A successful change returns a configurable
Components V2 receipt in the command channel for everyone to see.

## Presentation slots

The feature exposes editable slots including `panel`, `balance`, `method_selector`,
`minimum_warning`, `promptpay_qr`, `expired`, `processing`, `failed`, and
`succeeded`, `admin_notification`, `adjustment_result`, `history`, `monthly_summary`, and
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
- `PROMPTPAY_QR_WATERMARK` (optional JSON; default `NONE`)
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
or `WALLET_ADMIN_ROLE_ID`. For `add`, `remove`, and `set`, select the member in
the command and complete the amount and reason in the modal. Every change
creates an append-only `ADJUSTMENT` entry containing the actor, operation, and
reason, then displays the `adjustment_result` receipt.

`/history`, `/topup-monthly`, and `/top` are administrator-only. Lifetime rank
totals include successful `TOPUP` ledger entries, not manual adjustments. The
temporary slip role is granted for the active QR window and removed after
success or expiry; an optional permanent member role is granted after success.

TrueMoney redemption is settled through the existing Voucher Service. Both
providers call the same atomic database credit function so retries return the
existing ledger result without increasing the balance twice.

SlipOK behavior follows the official [check-slip documentation](https://slipok.com/api-documentation/),
including duplicate, amount, and receiver checks.

## QR images and slip links

Use `{{qr_url}}` in an image or media field to display the active PromptPay QR.
Use `{{slip_channel_url}}` in a link button to open `SLIP_CHANNEL_ID`; a Discord
channel page is not an image. The settings preview uses a bundled example QR
labelled “PREVIEW ONLY”, and its slip link has a valid Discord channel URL.

The Backend generates the payment QR locally with the same PromptPay encoder
used by website top-ups and returns its PNG as `qrImageDataUri`. The runner uploads
that PNG with the private Discord response and resolves `{{qr_url}}` to
`attachment://promptpay-qr.png`. Countdown edits retain the uploaded image; the
expiry response removes it. No image-provider request is needed for this flow.
The QR amount and recipient are encoded before creating the pending session, so
invalid configuration does not leave an unusable payment request.

The legacy `qrUrl` field remains available for older runners during deployment.
A newer runner receiving a response without `qrImageDataUri` uses that legacy URL;
an invalid generated image is reported as an error rather than silently switching
back to an external image provider.

For existing `promptpay_qr` designs that placed `{{slip_channel_url}}` in an image
field, the runner and preview render that image using `{{qr_url}}`. Text and link
buttons keep the channel URL. This compatibility behavior covers flat/nested
Embed designs, raw Embed arrays and Components V2 media without modifying saved
designs.

The `role-shop` feature shares this Wallet with Roblox Payout. Purchases and
refunds appear in the same history; refunds are adjustments, not top-ups. See
[Role Shop](role-shop.md) for setup and recovery behavior.

## Optional QR watermark

In Wallet Top-up settings, open **QR appearance** and choose:

- **No watermark** (`NONE`): the default plain payment QR.
- **Shop name / text** (`TEXT`): one line of up to 60 characters, including Thai.
  An empty text value uses the bot's Discord username, then its configured name.
- **Uploaded logo** (`LOGO`): PNG, JPEG or WebP up to 2 MB and 16 megapixels.
  The browser contains the image within a transparent 160 × 64 PNG and saves it
  with the private feature configuration. No external image host is needed.

The JSON shape is `{"mode":"NONE","text":"","logoDataUri":""}`. Switching modes
preserves the draft text and logo; **Remove logo** clears the image and selects
`NONE`. An invalid or missing logo cannot be saved in `LOGO` mode. The Backend
accepts only inline PNGs up to 60,000 characters and 320 × 160 pixels, and validates
image dimensions before decoding. Remote image URLs and SVGs are rejected.

Branding occupies a separate footer beneath the complete QR and its four-module
white border. The payment amount, recipient and QR pixels are unchanged by the
watermark. The plain image is 512 × 512; branded images are 512 × 608. Thai text
uses the bundled Noto Sans Thai font and its SIL Open Font License. The Backend
runtime includes fontconfig for rendering in the container. No font or image
service is contacted while creating payments.

Save the settings to apply branding to newly created payment QR images. Existing
sessions retain their original attachment until payment or expiry. The settings
preview is an example of placement and cannot be used to pay.

Verification includes frontend upload/save/reload and category-switching tests
on Desktop/Mobile in Light/Dark modes, exact QR pixel comparisons, and full-image
ZXing decoding for phone and 13-digit recipients with text and logo watermarks.
The six synthetic plain/text/logo images also passed the independent macOS
barcode detector with matching recipient and amount payloads.

### VPS migration (2026-10-27)

`20261027000002_wallet_qr_watermark.sql` was applied to
`migration_cutover_20261022` on the VPS after a verified local backup and a
schema-only scratch rehearsal. Reapplying the migration inserted no duplicates;
unrelated features were unchanged. All three existing Wallet versions default
to `NONE`. Wallet, ledger and saved-configuration row checksums remained unchanged
within the transaction, and source SQL was recorded atomically in migration
history. The scratch database was removed. The backup, schema and atomic apply
wrapper remain in
`/opt/fujipp/apps/fujipp-postgres/migrations/wallet-qr-watermark-20261027/`.
Application rollout follows the repository owner's PR and main-branch deployment.


## Reliable TrueMoney receipts

New Wallet claims accept only one-recipient gifts. The Backend verifies the gross
amount and that it exceeds the configured fee before sending one redemption POST.
It accepts exact decimal THB and correctly grouped thousands, converts to integer
satang, and rejects unsupported precision, zero, negative and overflowing values.
Both supported campaign URL spellings share a canonical voucher claim; gift codes
remain case-sensitive. Raw gift URLs are not stored.

The recipient and fixed/percentage fee are captured with the claim. A verified
provider success is persisted independently of Wallet settlement. Settlement locks
that receipt, computes the net from its immutable fee snapshot, and commits the
Wallet balance, append-only ledger entry and receipt link in one transaction.
The stable credit key uses the redemption UUID, so a new Discord interaction or
later fee configuration change cannot create another credit. Fees equal to or
greater than the gift are rejected before receiving, rather than silently capped.

The Backend recovery worker polls every 10 seconds for v2 verified receipts still
uncredited after 15 seconds (first poll 30 seconds after startup). It only settles
stored receipts; it never calls TrueMoney. Multiple Backend instances are safe
because the database serializes receipt settlement. This is eventual recovery,
not a promised completion deadline during a database outage.

A lost POST response, malformed accepted receipt, mismatched amount/reference or
stale in-flight claim requires investigation. The customer sees `TOPUP_REVIEW_REQUIRED`
or `TOPUP_PROCESSING` and is told not to pay again. A bounded private
`provider_evidence` object retains only provider success, a sanitized amount lexeme
and voucher reference when available. It contains no full response, gift URL,
recipient phone or owner profile. Unconfirmed receipts never auto-credit.

Historical rows have no `wallet_flow_version`; the migration never opts them in
or credits them. Replaying an already credited legacy receipt can read its ledger
result, but an uncredited historical receipt requires manual review, including
checking Admin adjustments. In particular, do not replay or credit an incident
already compensated through `/wallet-admin`. Corrections use new compensating
ledger entries; existing financial entries cannot be updated or deleted.

The runner returns the customer receipt immediately after the financial commit.
Discord role/ranking changes and Admin notification run afterward. Notifications
are best effort, and a repeated ledger result does not send another Admin notice.
The Wallet ledger and website are the authoritative financial history.

## Bot settings → Money

Owners of bots with Wallet-related installations can open **Money** in Bot
settings. The Admin settings route provides the same view behind an Admin role
check. Every query checks the authenticated account and scopes data by bot ID;
Discord IDs shared by multiple bots still have separate balances. Historical
records remain readable through the route even after a feature expires.

Each customer has one per-bot Wallet shared by TrueMoney and SlipOK. The page shows
customer balances, lifetime credited top-ups per provider, and provider-filtered
history with gross amount, fee, net credit, reference and status. Missing legacy
amounts/fees are shown as unknown, never fabricated as zero. The review tab includes
only new-system unresolved receipts and pending credits; historical attempts are
labelled separately to avoid accidental repayment after an Admin correction.
These are read-only views, not a manual recovery/credit control.

Routes (all authenticated, `Cache-Control: no-store`):

- `GET /api/v1/bots/{botId}/money/overview`
- `GET /api/v1/bots/{botId}/money/customers`
- `GET /api/v1/bots/{botId}/money/topups`
- Admin equivalents under `/api/v1/admin/bots/{botId}/money/…`

Lists use cursor pagination (25 default, 100 maximum), optional exact `member`
Discord ID, and top-ups additionally support `provider=TRUEMONEY|SLIPOK` and
`review=true`. Cursors are bound to owner, bot and filters, and every SQL query
still independently applies the bot predicate. Satang values in this read API are
strings to preserve precision for large aggregates in browsers. Only the active
tab fetches rows; changing bot/account aborts and clears prior requests. The page
does not wait for Discord member lookups. Refresh reloads its financial snapshot.

Validation uses mocked TrueMoney HTTP responses, authorization tests, real
PostgreSQL replay/concurrency/rollback/provider-filter fixtures, and browser
coverage on Desktop/Mobile in Light/Dark. No validation redeems real gifts or
modifies production Wallets.
