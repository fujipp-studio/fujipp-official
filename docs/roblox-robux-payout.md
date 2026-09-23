# Roblox Robux Payout Feature

`roblox-robux-payout` sells configurable Robux packages using funds from
the per-bot member wallet created by `wallet-topup@1.0.0`.

Version `3.0.0` adds multiple independently posted shop panels. Each panel
selects the Roblox groups it offers, while each group has its own Robux-per-THB
rate. Administrators post a configured panel with
`/robux-panel panel:<panel>`. When only one panel exists, the `panel` option is
omitted. Each posted panel is tracked and refreshed independently.

Version `3.0.0` also keeps the membership checker and expanded username form from
the 2.0 releases, and sends a separately configurable successful-purchase
receipt to the purchasing member's Discord direct messages. The receipt exposes
only the purchased package, price, selected group, and transaction time, and it
can be designed as either an Embed or Components V2 message. The same receipt is
also sent to the configured receipt channel. Refunds and manual-review results
remain in the configured error notification channel only. An unavailable
receipt channel or closed DM does not change the payout outcome.

Administrators can also create a receipt for another kind of transaction with
`/robux-receipt`. Its package field accepts any text and suggests the common
values `ซื้อเกมพาส`, `เติม Robux ไอดี-พาส`, and `เติม โรพลัส` through
autocomplete. The command requires a manually entered THB price and adds the
transaction time automatically. Manual receipts use the separately editable
`manual_receipt` Components V2 presentation and never include group details.
They are sent to the configured receipt channel. The optional `user` argument
also sends a copy to that user's DM; a closed DM does not prevent the channel
receipt. The optional `image` attachment is added as the final component of
both receipt copies and must be an image file.

## Member flow

An administrator posts the shop with the configured panel command (default
`/robux-panel`) and selects a panel when more than one is configured. A member
can select only a Roblox group assigned to that panel, enters a username, and the
runner verifies group-payout eligibility. Available packages are filtered by
both wallet balance and the live Robux balance of the selected group.

Confirmation creates a recoverable financial job and debits the wallet in one
database transaction. Jobs are paid sequentially with a configurable cooldown.
A definite Roblox rejection refunds the debit exactly once. A network failure
or runner restart after the job entered `PROCESSING` changes the job to
`REVIEW_REQUIRED`; it is never retried automatically because Roblox one-time
payouts do not provide an application idempotency key.

## Configuration

- `PANEL_COMMAND_NAME`
- `ROBUX_ENABLED`
- `ROBUX_RATE` (fallback rate for groups upgraded without a group-specific rate)
- `ROBUX_PACKAGES` (`[{"robux":200}]`; the price uses the selected group's rate)
- `ROBUX_PAYOUT_COOLDOWN_SECONDS`
- `ROBUX_NOTIFICATION_CHANNEL_ID`
- `ROBUX_RECEIPT_CHANNEL_ID`
- `ROBLOX_GROUPS` (`[{"key":"main","name":"Main","groupId":123,"rate":3.5}]`)
- `ROBUX_PANELS` (`[{"key":"panel-1","name":"Panel 1","groupKeys":["main"]}]`)
- `ROBLOX_CREDENTIALS` (encrypted JSON object keyed by group key)

Example secret value:

```json
{
  "main": {
    "cookie": "ROBLOSECURITY value without the cookie name",
    "totpSecret": "BASE32TOTPSECRET"
  }
}
```

The Roblox security cookie and TOTP seed are secret configuration and must
never be placed in regular config, logs, runtime state, or presentation data.

The runner follows the proven legacy client's CSRF and authenticator challenge
flow with a single TOTP verification per payout. It sends the legacy
`FixedAmount`/`User` payload and only continues a challenge identified by Roblox
as `twostepverification`; a `chef` ID is never reinterpreted as a 2FA ID. If
Roblox returns `blocksession` or another unsupported challenge, the runner stops
immediately instead of retrying or attempting to bypass Roblox's security
controls. Repeated session blocks usually require the
operator to stop the queue, honor `Retry-After`, and establish a fresh Roblox
login from the same stable runtime environment.

Example Version 3 panel assignment:

```json
[
  { "key": "panel-1", "name": "Panel 1", "groupKeys": ["group-1", "group-2"] },
  { "key": "panel-2", "name": "Panel 2", "groupKeys": ["group-3"] }
]
```

## Presentation slots

The editable slots include `panel`, `eligibility`, `membership_result`,
`package_selector`, `confirmation`, `processing`, `queued`, `succeeded`,
`failed`, `notification_success`, `notification_error`, and the `receipt` slot
introduced in version 2.2.0. Version 2.2.0 also provides `manual_receipt` for
administrator-created receipts without group details.

## Internal API

All routes require `X-Runner-Token`:

- `POST /internal/v1/robux/jobs`
- `POST /internal/v1/robux/jobs/{jobId}/claim`
- `POST /internal/v1/robux/jobs/{jobId}/outcome`
- `POST /internal/v1/robux/jobs/{jobId}/refund`
- `GET /internal/v1/robux/jobs/recoverable`

Wallet debits and refunds remain append-only ledger entries. Operators must
inspect `REVIEW_REQUIRED` jobs against Roblox transaction history before making
any compensating wallet adjustment.
