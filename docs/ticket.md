# Ticket

`ticket@1.0.0` creates private Discord text channels from a topic dropdown.
Settings use five categories: **Topics & forms**, **Ticket behaviour**, **History**,
**Ticket numbers** and **Commands**.

## Deployment and setup

1. Apply the catalog migration `20261029000002_create_ticket_feature.sql` and,
   for the approved THB 100 one-time offer, `20261029000003_publish_ticket_one_time_offer.sql`.
2. Apply `20261029000004_ticket_controls_and_archives.sql` before deploying the
   updated Backend, Runner and Frontend. It adds a private ticket registry,
   conversation snapshots and the `TICKET_BEHAVIOR` configuration definition.
3. Apply `20261030000001_ticket_numbers_and_retention.sql` before deploying numbered
   tickets and the monthly retention worker. It adds per-bot counters and permits
   the Backend to remove expired closed archives.
4. Configure a Discord category ID for every topic. Order and support include
   editable forms by default. Add support role IDs to grant room access.
5. Give the bot View Channel, Manage Channels, Manage Roles, Send Messages,
   Embed Links and Read Message History. Enable Message Content Intent in the
   Discord Developer Portal so member message content can be archived.
6. Use `/ticket panel` to post the dropdown. Administrators may post panels;
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
| `{{id}}` | Five-digit per-bot sequence from `00000` to `99999` |

Names are normalized, spaces become hyphens, unsafe separators/control characters
are removed and the final name is limited to 100 characters. Names apply to newly
opened tickets. New rooms have no system metadata in their channel topic.

## Ticket numbering

Under **Ticket numbers**, set the next integer (0–99999) or reset to `00000`.
This action saves immediately, separately from **Save all**, and changes no
existing channel names. Counters are allocated atomically across topics and
survive Runner restarts. Failed creation attempts may leave gaps. Resetting can
reuse old numbers; reaching `99999` stops further allocation until a manual reset.
Monthly history cleanup does not reset the counter.

## Forms and welcome messages

An optional modal can contain 1–5 short or paragraph questions with required
switches and placeholders. Each answer allows up to 1,000 characters. The room
opens after submission. The `opened` welcome design is sent **before** the saved
question/answer messages. Both Embed and Components V2 designs are supported. Each topic has an optional
custom welcome title, Markdown body and HTTPS image/GIF, inheriting the shared
format/colour. Disabling the override uses the shared `opened` design. The
welcome and separate answer cards are combined into one message where Discord's
limits permit, with the **Manage ticket** control last. Large content is split
without dropping answers; controls appear on the final message.

The `panel` and `opened` slots retain the existing message editors. The Runner
adds the dropdown and management controls automatically. Welcome variables are
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

The public **Manage ticket** button opens an ephemeral menu for the clicking
member. Close and decision buttons are disabled for unauthorized members in
that private menu; server-side checks still run for every action. Discord shared
messages cannot have a different disabled state per viewer. Older shared close
buttons still enforce permissions and show private disabled controls to members
who cannot close.

`confirmClose` controls the private confirmation for the close button and
`/ticket close`. When disabled, an authorized action begins closing immediately.
The Runner stores `CLOSING`, locks the opener's and added participants' writing permissions, fetches and
saves the conversation, deletes the Discord channel, then records `CLOSED`.
The bot refreshes its channel permissions and application Message Content Intent
flags before archiving, refusing deletion if it cannot read the full content.
If archiving or deletion fails, it retains the room/closing intent for retry.
Closing never silently substitutes a partial transcript. Snapshots are limited
to 10,000 messages / 10 MiB; exceeding a limit keeps the room and reports the need
for a manual export. A crash after deletion is reconciled using the saved archive.

## Adding ticket participants

An authorized closer can open **Manage ticket** and choose a member under
**Add member**, or use `/ticket add-user member:<member>` in the ticket room.
The picker is disabled for members without closing permission; every selection
and command also checks current administrator/closing role/user permissions.
Only existing server members can join, and bot accounts are rejected.

Each open ticket can have up to 25 added participants. Members receive access
to read existing messages, chat, attach files and embed links. Joining does not
grant closing or exemption-decision permission. When Discord history is enabled,
participants can export it while they retain room access and Read Message
History. Website history remains restricted to the bot owner and website admins.
Participant identities survive restarts, and closing locks their writing access
before archiving. A ticket already closing cannot accept more members.

Participant state uses the existing private registry JSON; no additional database
migration is required beyond the setup migrations above. Deploy the updated
Runner and Backend together, then let the Ticket feature register its updated
slash command.

## Optional automatic deletion

Each topic has `autoCloseMinutes` from 0–43200. Zero disables the timer; enabling
it in the UI starts at 1440 minutes. `IDLE` counts from the newest message,
including bot messages. `OPENED` counts from creation regardless of activity.
The Runner checks each minute while online and on startup, so deadlines resume
after an outage. Timed closing archives and deletes automatically; it does not
wait for human confirmation. Turning on manual confirmation does not change this.
Existing tickets retain the timer policy and support roles captured when opened.

## Requests to keep a ticket open

An administrator or configured closing role/user can use `/ticket no-auto-close`
in the ticket room to disable automatic closing immediately. The private menu's
**Cancel automatic closing** button does the same, including when a request is
already pending. The exemption survives restarts and affects only this ticket;
manual closing remains available to authorized closers.

An ordinary opener can use the same command or the private management menu to
request an exemption. Only one request can be pending. A request posts a notice
in the ticket; authorized closers approve or reject in their private menu.
Pending/rejected requests keep the original deadline. Approval sets this
Ticket's auto-close policy to Off and survives restarts, without changing the
topic defaults or other tickets. A closing/closed ticket cannot be exempted.

## Opening latency

Ordinary opens reuse the loaded registry and Discord channel/role caches rather
than fetching every room and role serially. The minute sweep refreshes the
registry and imports legacy topics. Creation still checks category permissions
and registration still verifies the actual Discord guild. Welcome/answer
batching reduces message API calls. Logs record opening work duration; actual
latency also depends on Discord and rate limits, so no fixed timing is promised.

## Durable identity and conversation history

`private.ticket_channels` holds bot/installation-scoped identities, state and
saved conversation messages. It is not exposed to browser database clients.
Runner endpoints require the internal runner credential and check the active
Ticket installation/license and the actual channel guild before registration.
The Runner imports its old `fujipp-ticket:...` topics into the registry before
clearing those topics. It leaves ordinary or other installations' topics alone.
Old closed rooms are retained until explicitly closed/deleted through the bot.

At 00:00 on the first day of each month in `Asia/Bangkok`, the retention worker
removes closed archives saved before that month. An hourly pass catches up after
downtime. Open and closing identities are never purged by this job. The policy
removes website archive rows, not Discord channels or financial records.

The web reader supports search, open/closed filters, chronological pagination,
Thailand timestamps, authors/IDs, replies, edited indicators, forms, embeds,
Components V2 text and safe Discord attachment links. Open rooms use live Discord
messages; archived conversations remain readable after channel deletion, without
a Discord request or valid bot token, until monthly cleanup. Only the current bot owner and website
administrators can read them. Responses use `Cache-Control: no-store`.

`TICKET_DISCORD_HISTORY_ENABLED` remains optional and defaults to `false`. When
on, the history button in the private management menu and `/ticket history` provide a private UTF-8 download
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
