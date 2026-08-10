# Roblox Robux Payout Feature

`roblox-robux-payout@1.0.0` sells configurable Robux packages using funds from
the per-bot member wallet created by `wallet-topup@1.0.0`.

## Member flow

An administrator posts the shop with the configured panel command (default
`/robux-panel`). A member selects a Roblox group, enters a username, and the
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
- `ROBUX_RATE` (Robux per THB used to calculate every package price)
- `ROBUX_PACKAGES` (`[{"robux":200}]`; price is rounded up from `robux / rate`)
- `ROBUX_PAYOUT_COOLDOWN_SECONDS`
- `ROBUX_NOTIFICATION_CHANNEL_ID`
- `ROBLOX_GROUPS` (`[{"key":"main","name":"Main","groupId":123}]`)
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

## Presentation slots

The editable slots are `panel`, `eligibility`, `package_selector`,
`confirmation`, `processing`, `succeeded`, `failed`, and `notification`.

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
