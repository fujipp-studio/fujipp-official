# Ticket

`ticket@1.0.0` creates private Discord text channels from a topic dropdown.
Settings use four categories: **Topics & forms**, **Ticket behaviour**, **History**
and **Commands**.

## Deployment and setup

1. Apply the catalog migration `20261029000002_create_ticket_feature.sql` and,
   for the approved THB 100 one-time offer, `20261029000003_publish_ticket_one_time_offer.sql`.
2. Apply `20261029000004_ticket_controls_and_archives.sql` before deploying the
   updated Backend, Runner and Frontend. It adds a private ticket registry,
   conversation snapshots and the `TICKET_BEHAVIOR` configuration definition.
3. Configure a Discord category ID for every topic. Order and support include
   editable forms by default. Add support role IDs to grant room access.
4. Give the bot View Channel, Manage Channels, Manage Roles, Send Messages,
   Embed Links and Read Message History. Enable Message Content Intent in the
   Discord Developer Portal so member message content can be archived.
5. Use `/ticket panel` to post the dropdown. Administrators may post panels;
   Bot Permissions can grant `ticket/panel` to other members. Change
   `TICKET_COMMAND_NAME` to rename `/ticket`. Saving valid topic settings also
   retries an earlier activation failure; command/design-only saves do not.

## Topics, emoji and channel names

`TICKET_CATEGORIES` contains 1–25 stable topic keys. Each topic chooses a Discord
category, up to 10 support roles, a description, optional emoji and room name.
An emoji may be a Unicode emoji, `<:name:123456789012345678>` or animated
`<a:name:123456789012345678>`. Custom emoji must be usable by the Discord bot.
Post a new panel after changing dropdown labels, descriptions or emoji.

The default `channelNameTemplate` is `ticket-{{topic}}-{{id}}`. Supported tokens:

| Token | Value |
| --- | --- |
| `{{username}}` | Discord username of the opener |
| `{{user_id}}` | Discord user ID of the opener |
| `{{topic}}` | Stable topic key |
| `{{id}}` | Identifier generated when opening the ticket |

Names are normalized, spaces become hyphens, unsafe separators/control characters
are removed and the final name is limited to 100 characters. Names apply to newly
opened tickets. New rooms have no system metadata in their channel topic.

## Forms and welcome messages

An optional modal can contain 1–5 short or paragraph questions with required
switches and placeholders. Each answer allows up to 1,000 characters. The room
opens after submission. The `opened` welcome design is sent **before** the saved
question/answer messages. Both Embed and Components V2 designs are supported.

The `panel` and `opened` slots retain the existing message editors. The Runner
adds dropdown and close/history controls automatically. Welcome variables are
`{{user}}`, `{{user_name}}`, `{{category}}`, `{{channel}}` and `{{auto_close}}`.

## Opening limits and close permissions

`TICKET_BEHAVIOR` defaults to:

```json
{"maxOpenPerUser":1,"confirmClose":true,"closeRoleIds":[],"closeUserIds":[]}
```

The opening limit is 1–25 tickets per person **across all topics** of this bot.
Open and closing tickets count; closed tickets do not. Opens are serialized so
concurrent submissions cannot bypass the limit in the bot process.

Only members with Discord Administrator permission can close by default. The
opener and support roles do not automatically receive close permission. Add up
to 10 closing roles or 25 closing users on the website to grant that permission.
These extra roles/users also receive access to newly created rooms. Existing
rooms retain their Discord access permissions; close authorization uses current
settings and freshly fetched Discord membership.

`confirmClose` controls the private confirmation for the close button and
`/ticket close`. When disabled, an authorized action begins closing immediately.
The Runner stores `CLOSING`, locks the opener's writing permissions, fetches and
saves the conversation, deletes the Discord channel, then records `CLOSED`.
The bot refreshes its channel permissions and application Message Content Intent
flags before archiving, refusing deletion if it cannot read the full content.
If archiving or deletion fails, it retains the room/closing intent for retry.
Closing never silently substitutes a partial transcript. Snapshots are limited
to 10,000 messages / 10 MiB; exceeding a limit keeps the room and reports the need
for a manual export. A crash after deletion is reconciled using the saved archive.

## Optional automatic deletion

Each topic has `autoCloseMinutes` from 0–43200. Zero disables the timer; enabling
it in the UI starts at 1440 minutes. `IDLE` counts from the newest message,
including bot messages. `OPENED` counts from creation regardless of activity.
The Runner checks each minute while online and on startup, so deadlines resume
after an outage. Timed closing archives and deletes automatically; it does not
wait for human confirmation. Turning on manual confirmation does not change this.
Existing tickets retain the timer policy and support roles captured when opened.

## Durable identity and conversation history

`private.ticket_channels` holds bot/installation-scoped identities, state and
saved conversation messages. It is not exposed to browser database clients.
Runner endpoints require the internal runner credential and check the active
Ticket installation/license and the actual channel guild before registration.
The Runner imports its old `fujipp-ticket:...` topics into the registry before
clearing those topics. It leaves ordinary or other installations' topics alone.
Old closed rooms are retained until explicitly closed/deleted through the bot.

The web reader supports search, open/closed filters, chronological pagination,
Thailand timestamps, authors/IDs, replies, edited indicators, forms, embeds,
Components V2 text and safe Discord attachment links. Open rooms use live Discord
messages; archived conversations remain readable after channel deletion, without
a Discord request or valid bot token. Only the current bot owner and website
administrators can read them. Responses use `Cache-Control: no-store`.

`TICKET_DISCORD_HISTORY_ENABLED` remains optional and defaults to `false`. When
on, the history button and `/ticket history` provide a private UTF-8 download
while the room exists, for its opener, support team, authorized closers or admins
who still have View Channel and Read Message History. Downloads show up to the
newest 2,000 messages / 5 MiB and explicitly mark partial exports. After deletion,
use the website. Disabling Discord history does not disable web archives.

Snapshots preserve the conversation as read when closing, not an audit of prior
edits/deletions. Deleting a room outside the bot before archiving cannot recover
its contents. Files are linked, not copied; Discord attachment URLs may expire.

## Validation

- Runner: `npm run build && npm test`
- Backend: `./mvnw --batch-mode test`
- Frontend: `bun run build`, `bun run test:unit --run`, `bun run lint`
- Browser: `bunx playwright test --config playwright.smoke.config.ts ticket.smoke.spec.ts ticket-history.smoke.spec.ts`

Browser tests use synthetic conversations. A live Discord server must still
verify the bot's permissions, custom emoji access and role hierarchy.
