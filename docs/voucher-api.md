# Voucher API

The Voucher API redeems TrueMoney gift vouchers for an installed `wallet-topup`
bot feature. It runs inside the existing Backend process to avoid the memory cost
of a second Java service.

## Authentication and authorization

The endpoint is internal and accepts only the Bot Runner token:

```http
X-Runner-Token: <RUNNER_API_TOKEN>
```

The supplied `botId` must have:

- a non-suspended, non-decommissioned bot;
- an active `wallet-topup` installation and license;
- a non-expired license; and
- a valid `TRUEMONEY_PHONE` Feature config value.

The recipient phone is loaded by the Backend. A Discord command cannot supply or
override the destination phone.

## Redeem a TrueMoney voucher

```http
POST /internal/v1/vouchers/truemoney/redeem
X-Runner-Token: <RUNNER_API_TOKEN>
Content-Type: application/json
```

```json
{
  "botId": "1759fb50-3b68-49f4-89f9-e43623029941",
  "memberDiscordId": "1494842858132471980",
  "gift_url": "https://gift.truemoney.com/campaign/?v=exampleVoucherCode",
  "idempotencyKey": "voucher:interaction-id"
}
```

`idempotencyKey` is required, contains 8–100 safe characters, and should be
derived from the Discord interaction ID. Retrying the same key and payload
returns the existing result. Reusing a key or voucher with another payload
returns `409 Conflict`.

Response: `200 OK`

```json
{
  "id": "99066b4d-ce42-4999-b746-9db76f3f9a93",
  "botId": "1759fb50-3b68-49f4-89f9-e43623029941",
  "memberDiscordId": "1494842858132471980",
  "status": "SUCCEEDED",
  "amountSatang": 5000,
  "currency": "THB",
  "issuer": "Voucher Owner",
  "reference": "upstream-reference",
  "failureCode": null,
  "failureMessage": null,
  "processingStartedAt": "2026-08-01T14:00:00+07:00",
  "completedAt": "2026-08-01T14:00:01+07:00",
  "createdAt": "2026-08-01T14:00:00+07:00"
}
```

Possible persisted statuses are:

- `REDEEMING`: the irreversible upstream operation has started;
- `VERIFY_FAILED`: TrueMoney rejected the voucher before redemption;
- `REDEEM_FAILED`: a pre-receipt upstream request failed (historical rows may lack phase information);
- `RECONCILIATION_REQUIRED`: the response was lost or processing became stale;
- `SUCCEEDED`: a positive THB amount and upstream reference were recorded.

`RECONCILIATION_REQUIRED` must be checked against TrueMoney manually. The service
will not blindly retry because the voucher may already have been redeemed.

Raw voucher URLs are never stored. The database retains only a SHA-256 hash and
keeps successful amounts as integer satang.


Wallet credits must use `POST /internal/v1/wallet/topups/truemoney`. A voucher
response of `SUCCEEDED` means the provider receipt was captured, not that a Wallet
credit has been committed. New Wallet claims snapshot the fee and opt into
receipt-based atomic settlement/recovery; the direct voucher API and Payment
Trigger invoices never implicitly credit a customer Wallet.

All redemption paths enforce one recipient and exact satang parsing, including
properly grouped amounts such as `2,000.00`. The irreversible POST is sent once;
HTTP 400, timeouts and malformed post-receipt data never cause another POST.
Accepted but invalid receipts remain `RECONCILIATION_REQUIRED`, with bounded
private receipt evidence when available. They require investigation, not automatic
re-redeeming. See [Wallet top-up](wallet-topup.md#reliable-truemoney-receipts).
