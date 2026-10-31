# Discord CI/CD summary

`.github/workflows/discord-ci.yml` creates one revision card and updates that
message when monitored workflows start or finish. It observes Frontend, Backend /
Runner, Database and Security. Database checks/deployment inside reusable workflow
calls are summarized in one Database field. Smoke shards and CodeQL jobs remain
details linked from the card rather than individual channel messages.

Reports use English system labels and a consistent `FUJIPP STUDIO • CI/CD REPORT`
heading, with one status icon and a status color. Status, Branch, Commit and
Triggered by appear before the workflow results. States use `IN PROGRESS`,
`SUCCEEDED`, `FAILED`, `CANCELLED`, `SKIPPED` or `UNCONFIRMED`. Workflow rows
distinguish `Checks passed`, `Deployment succeeded` and `Deployment skipped`.
Failure details and recovery guidance appear only when relevant, followed by
Workflow/Commit/Pull Request links. Source commit titles and step names retain
their original wording; the notifier does not translate GitHub metadata.

## Setup

- Keep the native Discord webhook URL in repository Actions secret
  `DISCORD_CI_WEBHOOK`. Do not append `/github`; that endpoint is for GitHub's
  built-in payload adapter rather than custom cards. The webhook needs a normal
  server text channel, not a forum/thread channel.
- The workflow needs `contents: read`, `actions: read`, and `statuses: write`.
  It uses the standard `GITHUB_TOKEN`; no bot, database, PAT or state branch is
  required. Repository/organization policy must allow the requested token scope.
- The notifier becomes active after its workflow and script reach the default
  branch. PR validation only runs local mocked tests; it never receives webhook
  credentials or posts a test message.
- Once the custom card works, disable the old repository webhook sender in
  GitHub Settings → Webhooks. Keep the Discord webhook itself: the new workflow
  uses it. Leaving both senders active produces both old individual events and
  the new summary.

## Grouping and updates

A card is grouped by repository, source commit SHA, source event, head repository
and head branch. Frontend/Backend/Security runs for the same push or PR revision
share a message. A new commit creates a new card; this is not one forever-edited
message for an entire PR. Manual and scheduled source runs each get their own
card so a weekly scan or manual release cannot overwrite an earlier release.
Rerunning the same source run updates the existing card.

The notifier queries current workflow runs and their latest-attempt jobs rather
than trusting an old completion event. It serializes notification jobs by card
key. A newer pending notification can replace an older pending one; it still
reconciles all current workflow results. An in-progress notification is not
cancelled halfway through sending.

Only workflows returned by GitHub are summarized. A missing run is explicitly
labelled **No run observed for this revision**; it is not counted as a
successful/skipped workflow.
GitHub can register runs at slightly different times, so a later start/completion
event updates that field. The green heading describes the observed workflows,
not a guarantee that every possible workflow ran or that production remains up.
The report description explicitly limits the result to observed workflows.

The card distinguishes running, failed, cancelled, skipped, checks-only and
deployment outcomes. Production deployment labels require a successful deploy
job in a main push/manual source run. PR job names cannot claim a production
deployment. Durations come from run/job timestamps and are per workflow; parallel
durations are not added together.

Failure details include failing job/step names and direct Actions links. The
notifier does not download logs or artifacts, infer root causes, claim a rollback
succeeded, or invent FTPS upload/migration counts. Database gate success can mean
that the database was already current. Exact operational details remain in Actions.
Messages use `FUJIPP CI` as the sender name, contain no role/everyone mentions,
and update silently. A notification failure does not prevent or roll back the
independent application/database release workflows.
Existing cards with the original full-hash footer remain editable and receive
the new format on their next update. The footer shows a shorter audit reference;
the full revision key and durable message pointer stay unchanged.

## Message pointer and uncertain sends

The commit status context `discord/ci/<card-key>` stores the Discord message link
and the rendered payload hash. This survives runner cleanup and cache eviction.
It is delivery bookkeeping, not the build/release verdict. Do not add this status
as a required production deployment check. The URL contains public server/channel/
message IDs, not the webhook credential.

Before creating a message, the workflow records a pending send intent. It then
uses `wait=true` and records the confirmed message ID. Later runs verify the
message's webhook owner and card marker before editing. Unchanged cards are not
patched again; changed/corrupted owned cards are repaired. A known HTTP rejection
can be retried after configuration is fixed. Discord 429 responses respect a
bounded `retry_after`; ambiguous POST timeouts/5xx are never blindly retried.

Sending to Discord and recording GitHub state cannot be one atomic transaction.
If delivery was confirmed but the pointer could not be saved, or the response was
lost, the next run fails closed instead of sending a possible duplicate. Recover
using **Actions → Discord CI Summary → Run workflow** on the default branch:

1. Set `source_run_id` to the numeric run ID from the source Actions URL.
2. If a card already exists, copy its Discord message ID and enter it in
   `recover_message_id`. The notifier verifies ownership/revision before updating
   it and restoring the pointer. The notifier's error includes the message ID if
   it received one. Discord Developer Mode exposes **Copy Message ID**.
3. If the card was deleted or you have confirmed that no card was sent, leave the
   recovery ID empty and enable `allow_new_message`. This explicitly allows a
   replacement and may create a duplicate if an old card still exists.

Leave both recovery options at their defaults for normal manual refreshes. A
different webhook/channel cannot silently take over an existing pointer. Keep
status history intact and fix a missing secret/403 permission error in settings.

## Trust boundary and validation

Privileged jobs check out notifier code at the event's trusted default-branch SHA
(both jobs use the same pinned `github.sha`), with
persisted Git credentials disabled. They do not check out or execute the source
PR, consume its artifacts, evaluate titles as shell code, or fetch customer/VPS
data. GitHub/Discord credentials go only to their respective fixed HTTPS hosts;
redirects are rejected and HTTP failures never print the secret-bearing URL.
Display text is escaped and `allowed_mentions.parse` is empty on creates/edits.

From the repository root:

```sh
python3 -m unittest discover -s .github/scripts -p 'test_discord_ci.py' -v
```

Tests use fake APIs only. They cover one-message updates, stale events/reruns,
failed and skipped jobs, nested Database results, ownership checks, message
recovery, pagination, rate limits, missing pointers and uncertain responses.
`python3 .github/scripts/discord_ci.py preview --snapshot /path/to/snapshot.json`
renders a local JSON payload without credentials or network requests. A snapshot
contains `repository`, `key`, `anchor`, `runs` keyed by workflow path, and `jobs`
keyed by source run ID. API access and the first real send are verified after merge.

References: GitHub's [workflow_run trust boundary](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
[commit statuses](https://docs.github.com/en/rest/commits/statuses), and Discord's
[webhook API](https://docs.discord.com/developers/resources/webhook).
