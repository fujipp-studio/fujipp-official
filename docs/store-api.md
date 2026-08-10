# Bot Feature Store API Contract

## Overview

The Store API lets a user:

- browse purchasable bot features;
- purchase a feature with wallet credit;
- keep the purchased license in the user's inventory;
- install or remove a feature from the user's bots;
- configure normal values, encrypted secrets, and presentation overrides.

Feature prices use integer `priceSatang` and `totalSatang` values. For example,
`9900` means THB 99.00. Clients must not calculate entitlement or trust a price
supplied by the browser; checkout always uses the active offer stored by the
Backend.

## Authentication and authorization

The catalog is public:

```http
GET /api/v1/store/features
```

All other endpoints require the Supabase access token described in
[`auth-api.md`](auth-api.md):

```http
Authorization: Bearer <supabase-access-token>
```

User endpoints only return or mutate bots, orders, licenses, installations, and
configuration owned by the authenticated user. Media management endpoints also
require the `ADMIN` role.

## Feature catalog

### List published features

```http
GET /api/v1/store/features
```

Response: `200 OK`

```json
[
  {
    "id": "7d2c3754-d4ee-4f07-a889-ca7bfa5ea6c2",
    "code": "welcome-message",
    "name": "Welcome Message",
    "description": "Send a configurable welcome message.",
    "category": "COMMUNITY",
    "iconKey": "sparkles",
    "image": {
      "url": "https://res.cloudinary.com/example/image/upload/v1/fujipp/features/welcome-message.webp",
      "width": 1600,
      "height": 900,
      "format": "webp",
      "bytes": 145220,
      "altText": "Welcome Message feature preview"
    },
    "tutorialUrl": "https://www.youtube.com/watch?v=abcdefghijk",
    "featured": true,
    "version": "1.0.0",
    "offers": [
      {
        "id": "12629ce4-b2ad-4536-ae62-36176f8fcd05",
        "code": "lifetime",
        "name": "Lifetime",
        "kind": "ONE_TIME",
        "priceSatang": 9900,
        "currency": "THB",
        "billingPeriodDays": null,
        "installationLimit": 1
      }
    ]
  }
]
```

`image` is `null` when the feature has no image. Only published features,
published versions, and active offers are returned.

## Bots

### List the current user's bots

```http
GET /api/v1/bots
Authorization: Bearer <supabase-access-token>
```

Response: `200 OK`

```json
[
  {
    "id": "1759fb50-3b68-49f4-89f9-e43623029941",
    "name": "Community Bot",
    "discordApplicationId": "123456789012345678",
    "discordGuildId": "234567890123456789",
    "discordUsername": null,
    "discordAvatarUrl": null,
    "status": "ACTIVE",
    "createdAt": "2026-08-01T10:00:00+07:00",
    "updatedAt": "2026-08-01T10:00:00+07:00"
  }
]
```

### Create a bot

```http
POST /api/v1/bots
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "name": "Community Bot",
  "discordApplicationId": "123456789012345678",
  "discordGuildId": "234567890123456789"
}
```

Response: `201 Created` with the created bot. `name` is required and has a
maximum length of 100 characters. Discord IDs are optional but, when present,
must contain 15 to 30 digits.

### Set or rotate the Discord bot token

```http
PUT /api/v1/bots/{botId}/credentials/discord-token
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "token": "discord-bot-token"
}
```

Response: `204 No Content`. The token is encrypted at rest, is never returned
by a user-facing endpoint, and is only available to the authenticated internal
Bot Runner.

## Checkout

### Purchase a feature offer

```http
POST /api/v1/store/orders
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "offerId": "12629ce4-b2ad-4536-ae62-36176f8fcd05",
  "quantity": 1,
  "idempotencyKey": "checkout-welcome-20260801-001"
}
```

Response: `201 Created`

```json
{
  "id": "29a8049b-ea1b-469d-9d85-4f6694070f04",
  "orderNumber": "ORD-20260801-000001",
  "status": "PAID",
  "totalSatang": 9900,
  "currency": "THB",
  "paidAt": "2026-08-01T10:05:00+07:00",
  "licenseIds": [
    "3f1bb199-ee77-41e3-b30e-793568af04ea"
  ]
}
```

`quantity` must be between 1 and 20. `idempotencyKey` is required and has a
maximum length of 120 characters. Retrying with the same key, offer, and
quantity returns the original order without charging the wallet twice. Reusing
the key with different checkout details returns `409 Conflict`.

Checkout is atomic: the wallet debit, paid order, and licenses either all
succeed or all roll back. An inactive offer, insufficient wallet balance, or a
conflicting checkout returns an error without issuing a license.

## Feature inventory and installation

### List owned feature licenses

```http
GET /api/v1/feature-licenses
Authorization: Bearer <supabase-access-token>
```

Response: `200 OK`

```json
[
  {
    "id": "3f1bb199-ee77-41e3-b30e-793568af04ea",
    "featureProductId": "7d2c3754-d4ee-4f07-a889-ca7bfa5ea6c2",
    "featureCode": "welcome-message",
    "featureName": "Welcome Message",
    "version": "1.0.0",
    "status": "ACTIVE",
    "installationLimit": 1,
    "acquiredAt": "2026-08-01T10:05:00+07:00",
    "expiresAt": null,
    "installations": []
  }
]
```

### Install a license on a bot

```http
POST /api/v1/feature-licenses/{licenseId}/installations
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "botId": "1759fb50-3b68-49f4-89f9-e43623029941"
}
```

Response: `201 Created`

```json
{
  "installationId": "85c2e493-8057-45c5-9a43-f3c87b3ae9dd"
}
```

The bot and license must belong to the authenticated user. The active
installation count cannot exceed the license's `installationLimit`.

### Remove a feature from a bot

```http
DELETE /api/v1/feature-licenses/installations/{installationId}
Authorization: Bearer <supabase-access-token>
```

Response: `204 No Content`. Removing an installation does not delete the
license; it returns to the user's inventory and can be installed again.

## Feature configuration

### Get configuration metadata and current values

```http
GET /api/v1/feature-licenses/{licenseId}/configuration
Authorization: Bearer <supabase-access-token>
```

Response: `200 OK`

```json
{
  "licenseId": "3f1bb199-ee77-41e3-b30e-793568af04ea",
  "revision": 2,
  "validatedForBotId": null,
  "fields": [
    {
      "key": "CHANNEL_ID",
      "label": "Welcome channel",
      "description": "Channel used for welcome messages.",
      "type": "CHANNEL_ID",
      "required": true,
      "secret": false,
      "defaultValue": null,
      "value": "345678901234567890",
      "configured": true,
      "validation": { "pattern": "^[0-9]{15,30}$" },
      "ui": { "control": "channel-select" }
    },
    {
      "key": "WEBHOOK_TOKEN",
      "label": "Webhook token",
      "description": null,
      "type": "SECRET",
      "required": true,
      "secret": true,
      "defaultValue": null,
      "value": null,
      "configured": true,
      "validation": null,
      "ui": null
    }
  ],
  "presentations": [
    {
      "slotId": "bbdd1581-c658-4e25-b450-ee871ee4ed19",
      "key": "welcome_embed",
      "label": "Welcome embed",
      "type": "EMBED",
      "availableVariables": ["userMention", "guildName"],
      "defaultDefinition": {
        "title": "Welcome {{userMention}}"
      },
      "overrideDefinition": null
    }
  ]
}
```

Secret values are never returned. For a secret field, `configured` indicates
whether a value exists while `value` always remains `null`.

### Replace configuration values

```http
PUT /api/v1/feature-licenses/{licenseId}/configuration
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "values": {
    "CHANNEL_ID": "345678901234567890",
    "ENABLED": true
  },
  "secrets": {
    "WEBHOOK_TOKEN": "replace-with-the-real-secret"
  },
  "presentations": {
    "welcome_embed": {
      "title": "Welcome {{userMention}}",
      "description": "Please read the rules in {{guildName}}."
    }
  }
}
```

Response: `200 OK` with the updated configuration response. All three maps are
required; send `{}` for a section that is not being changed. Unknown keys,
incorrect value types, secret keys placed in `values`, or normal keys placed in
`secrets` return `400 Bad Request`.

Supported field types are:

- textual: `STRING`, `TEXT`, `CHANNEL_ID`, `ROLE_ID`, `USER_ID`, and `ENUM`;
- numeric: `INTEGER` and `DECIMAL`;
- `BOOLEAN`, `STRING_LIST`, `JSON`, and `SECRET`.

Presentation overrides must be JSON objects. Secret values are encrypted with
AES-256-GCM before storage and are not written to normal configuration tables.
Updating configuration increments `revision` and clears previous bot
validation so the configuration can be validated again at runtime.

## Admin feature media

All endpoints in this section require `ROLE_ADMIN`.

### Get feature media

```http
GET /api/v1/admin/store/features/{featureId}/media
Authorization: Bearer <admin-supabase-access-token>
```

Response: `200 OK`

```json
{
  "url": "https://res.cloudinary.com/example/image/upload/v1/fujipp/features/welcome-message.webp",
  "width": 1600,
  "height": 900,
  "format": "webp",
  "bytes": 145220,
  "altText": "Welcome Message feature preview",
  "tutorialUrl": "https://youtu.be/abcdefghijk"
}
```

### Upload or replace a feature image

```http
POST /api/v1/admin/store/features/{featureId}/image
Authorization: Bearer <admin-supabase-access-token>
Content-Type: multipart/form-data

file=<binary image>
altText=Welcome Message feature preview
```

Response: `200 OK` with the feature media. `file` is required. JPEG, PNG, and
WebP are accepted, with a default maximum size of 8 MiB. Uploading a new image
replaces the stored Cloudinary asset and metadata.

### Delete a feature image

```http
DELETE /api/v1/admin/store/features/{featureId}/image
Authorization: Bearer <admin-supabase-access-token>
```

Response: `204 No Content`. The tutorial URL is not removed.

### Set or clear the tutorial URL

```http
PUT /api/v1/admin/store/features/{featureId}/tutorial
Authorization: Bearer <admin-supabase-access-token>
Content-Type: application/json
```

```json
{
  "tutorialUrl": "https://www.youtube.com/watch?v=abcdefghijk"
}
```

Response: `200 OK` with the feature media. The URL must use HTTPS and be a
YouTube watch, Shorts, or `youtu.be` URL. Send `null` or an empty string to
clear it. The maximum length is 500 characters.

## Error responses

Errors use `application/problem+json`.

```json
{
  "type": "about:blank",
  "title": "Invalid store operation",
  "status": 400,
  "detail": "Unknown configuration key: unsupportedKey"
}
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Invalid JSON, request validation, configuration type, upload, or tutorial URL. |
| `401 Unauthorized` | Missing, expired, or invalid access token. |
| `403 Forbidden` | Inactive account or non-admin access to an admin endpoint. |
| `404 Not Found` | Feature, offer, bot, license, installation, or configuration was not found or is not owned by the current user. |
| `409 Conflict` | Duplicate bot identity, installation limit, checkout conflict, or insufficient wallet balance. |
| `429 Too Many Requests` | Per-user API rate limit exceeded. |
| `502 Bad Gateway` | Cloudinary upload or deletion failed. |

Bean-validation failures include an `errors` object keyed by request field, as
documented in [`auth-api.md`](auth-api.md).

## Backend configuration

Store secrets require a Base64-encoded 32-byte encryption key:

```text
STORE_SECRET_KEY_BASE64
STORE_SECRET_KEY_VERSION=v1
```

Feature images use Cloudinary:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_FEATURE_FOLDER=fujipp/features
CLOUDINARY_MAX_FILE_SIZE_BYTES=8388608
```

Production must provide `STORE_SECRET_KEY_BASE64`. Do not reuse JWT, database,
Cloudinary, or provider credentials as the store encryption key. Rotate keys by
introducing a new key version and re-encrypting stored values before retiring
the previous key.
