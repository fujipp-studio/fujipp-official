# Ticket

`ticket@1.0.0` provides private Discord text-channel tickets. The public panel
contains a topic dropdown. Each topic chooses its Discord category, support
roles, optional form and automatic closing policy independently.

## Setup and commands

1. Deploy `20261029000002_create_ticket_feature.sql`, Backend, Frontend and Runner.
   The migration creates a draft product and version. Publish and grant/install
   them through the existing admin workflow when ready.
2. In Ticket settings, replace the empty Discord category IDs for **สั่งซื้อ**
   and **แจ้งปัญหา**. Both topics include editable forms by default. Add support
   role IDs, or leave them empty to use administrators only.
3. Give the bot View Channel, Manage Channels, Manage Roles, Send Messages,
   Embed Links and Read Message History in the selected categories. Do not use
   the server's `@everyone` role as a support role.
4. Use `/ticket panel` in the public destination channel. Administrators can
   post panels by default; Bot Permissions can grant `ticket/panel` to others.
   `TICKET_COMMAND_NAME` customizes the root command.

Members select a topic and submit its form, when enabled. The bot then creates
a private text channel visible to the opener, configured support roles, bot and
administrators. It posts form answers with notifications suppressed and includes
a close button. Each member can have one active ticket per topic; repeated or
concurrent clicks return the existing channel.

The opener, a configured support member or an administrator can request closure
with the button or `/ticket close`. A private confirmation precedes the change.
Closing denies the opener message, reaction and thread-writing permissions;
the channel and history remain available. Administrators retain Discord's
permission bypass. Closed channels remain in their category and count toward
Discord's channel limits; administrators can move or remove them as needed.

## Forms and timers

`TICKET_CATEGORIES` contains 1–25 topics with stable keys. Each topic supports up
to 10 unique support roles and an optional form with 1–5 questions. Questions
support short or paragraph answers, required switches and placeholders.
Answers are limited to 1,000 characters per question. Dropdown labels and
descriptions allow 100 characters; form titles and question labels allow 45.

`autoCloseMinutes` accepts 0–43200 minutes. Zero disables automatic closure.
Automatic closing is optional per topic and disabled by default. Enabling its
switch starts at 1440 minutes (24 hours), which can be changed, with
`autoCloseMode: IDLE`:

- `IDLE` counts from the latest message, including bot messages.
- `OPENED` counts from channel creation regardless of subsequent activity.

The Runner checks every minute while online and checks again on startup.
Timers therefore may run up to a minute late under normal conditions and
resume when an offline bot returns. Permission or history-read failures leave
the ticket retryable and record a recoverable feature error.

The channel topic stores an installation-scoped ticket marker, opener, support
roles, creation time, timer policy and status. Keep this topic intact. This
avoids growing the installation's 16 KiB runtime state with ticket records and
survives Runner restarts. Only channels carrying this installation's marker
are processed. Settings changes apply to new tickets; existing tickets retain
the support roles and timer policy captured when they opened. An interrupted
close persists `CLOSING` before changing permissions and retries after restart.

## Message designs

The `panel` and `opened` presentation slots support the existing Embed and
Components V2 editors. The Runner adds the topic dropdown or close button.
The opened message supports `{{user}}`, `{{user_name}}`, `{{category}}`,
`{{channel}}` and `{{auto_close}}`. Existing panels retain their posted dropdown;
post a new panel after adding or renaming topics. Selections for deleted topics
receive a private error.

## Conversation history

Open **Ticket history** from the bot settings menu or **Read ticket history**
from the Ticket feature settings. The website lists retained open and closed
ticket channels and supports searching by channel, member ID or topic,
filtering open/closed tickets, and loading earlier messages. Conversations show
author names and IDs, Thailand timestamps, edited indicators, reply references,
form/Embed text and Discord attachment links. Refresh retrieves the latest
messages; this view does not automatically poll Discord.

Only the bot's current owner and website administrators may use the web reader.
The Backend verifies bot ownership, configured guild and installation markers
before reading messages. Discord credentials remain on the Backend and responses
use `Cache-Control: no-store`. Opening the page does not require the Runner to
be online, provided the bot's token and Discord permissions remain valid.

`TICKET_DISCORD_HISTORY_ENABLED` is an optional boolean, default `false`.
When enabled, newly opened/closed tickets include an **อ่านประวัติแชท** button,
and `/<TICKET_COMMAND_NAME> history` downloads a private UTF-8 text transcript.
The opener, configured support team and Discord administrators must still have
View Channel and Read Message History in that ticket. Exports include at most
the latest 2,000 messages / 5 MiB of text and explicitly mark a partial export;
the website can page further back. Disabling the option removes the command
and rejects existing history buttons. The web reader remains available.

Enable **Message Content Intent** in the bot application's Discord Developer
Portal settings to receive member message text, embeds, components and
attachments over the API. Discord may require approval for verified apps.
The bot also needs View Channel and Read Message History. If these are missing,
Discord can return empty message content or an empty history.

History is read from the existing Discord channel, without a separate archive
database. Deleting a channel or message removes it from this reader. The reader
shows the latest retained version of an edited message, not an edit/deletion
audit trail. Downloaded attachments link to Discord and can expire; refresh the
history to obtain current links while the original message remains available.

## Validation

- Runner: `node --import tsx --test test/ticket.test.ts`
- Transcript: `node --import tsx --test test/ticket-history.test.ts`
- Backend: `./mvnw --batch-mode -Dtest=TicketConfigurationValidatorTests,StoreServiceTests test`
- Frontend unit: `bun run test:unit --run src/__tests__/Ticket.spec.ts`
- Browser: `bunx playwright test --config playwright.smoke.config.ts ticket.smoke.spec.ts`
- History browser: `bunx playwright test --config playwright.smoke.config.ts ticket-history.smoke.spec.ts`

The browser checks use synthetic data. A live Discord server must still verify
the deployed bot's role hierarchy and category permissions.
