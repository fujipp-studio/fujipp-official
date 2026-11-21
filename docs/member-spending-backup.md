# Member Spending Card data backup

The Database category offers Download Backup when the draft selects Fujipp
storage. The Backend independently checks the saved storage selection, active
account, bot ownership (or active administrator role), and the current Member
Spending installation on the requested bot/license. Save a storage change before
exporting. Expired licenses may still back up an existing installation's data.
Customer-owned PostgreSQL connections are not accessed by this export.

## API and quota

`GET` and `POST /api/v1/bots/{botId}/licenses/{licenseId}/member-spending/backup`
return the quota and create a ZIP respectively. Administrator routes use
`/api/v1/admin/bots/...` with the same permissions and quota rules. All responses
use `Cache-Control: no-store`. POST returns `application/zip` and an exposed
`Content-Disposition` attachment filename; GET never consumes quota.

The daily limit is five generated archives per installation, shared by owner
and administrators. Days reset at 00:00 in `Asia/Bangkok`. GET returns `remaining`,
`limit`, and `resetsAt` (an ISO timestamp). POST locks the installation row for the
transaction so concurrent requests and multiple Backend instances cannot exceed
five. The persistent quota increments only after ZIP generation and commits
before returning the response. Query, generation or transaction failures roll
back the quota. A lost connection after a successful commit still consumes one
export; the server cannot confirm whether a browser saved the file. The sixth
request returns 429. No automatic retries of POST occur.

The append-only migration `20261121000001_member_spending_backup.sql` creates
`private.member_spending_backup_quotas` with RLS and trusted service grants.
Deploy it through the ordered Database gate before releasing the Backend.
Existing Runner/bootstrap contracts and spending tables remain compatible.
Controller changes select a paired Backend/Runner release through the delivery
map, and both services must pass the selected compatibility checks.

## Archive format, version 1

Filename:
`fujipp_member-spending_{guildId}_{installationId}_{YYYY-MM-DD_HH-mm-ss}_ICT.zip`.
The timestamp uses Thailand time. Bots without a configured guild use
`unconfigured` in place of the guild ID.

- `members.csv`: `memberDiscordId`, `amountSatang`, `txCount`, `updatedAt`.
- `monthly-spending.csv`: `memberDiscordId`, `month`, `amountSatang`, `txCount`.
  Includes every saved monthly cycle, even when monthly tracking is disabled.
- `backup.json`: `manifest`, `members`, and `monthlySpending`.
- `manifest.json`: format version, feature, export time/timezone, bot/guild/
  installation IDs, currency (`THB`), unit (`satang`), member and monthly row counts.

Both CSVs use UTF-8 with BOM, CRLF, quoted/escaped fields and an unquoted header.
Import Discord IDs as text in spreadsheet software. JSON stores Discord IDs and
BIGINT satang amounts as strings to preserve their exact digits. The two data
arrays come from one PostgreSQL statement snapshot, without leaderboard limits
or pagination. Empty databases still export all four files with empty arrays
and CSV headers.

This is a feature balance snapshot scoped to the bot's existing spending data.
It does not include passwords, database URLs, bot credentials, configuration,
Discord profiles or the internal operation/idempotency ledger. It is not a full
PostgreSQL backup, and there is no import/restore endpoint in this change.

## Focused verification

`MemberSpendingBackupTests` covers authorization, shared quota boundaries,
archive contents, exact numeric values, generation failures and Thai dates.
`MemberSpendingBackupPostgresTests` applies the actual migration and catalog
check to a disposable database, then exercises ten concurrent requests across
two service instances, transaction rollback, rollover and saved external storage.
Set `SPENDING_BACKUP_TEST_DB_URL`, `SPENDING_BACKUP_TEST_DB_USER` and
`SPENDING_BACKUP_TEST_DB_PASSWORD`; the database name must start with
`spending_backup_test_`. It must be empty, with a test superuser able to create
roles. The fixture is synthetic and deliberately refuses application databases.

Frontend unit tests cover binary response parsing and rejected requests. The
Member Spending smoke spec exercises failed/successful downloads, quota refresh,
exhaustion and external-storage visibility on Desktop/Mobile in Light/Dark.
