# Database Rules

- Keep database migrations under `supabase/migrations/`.
- Create database changes on a task branch from `main`.
- Open a pull request and merge the reviewed migration into `main`.
- Merging migration files into `main` triggers the automatic database migration deployment.
- Treat `main` as the single source of truth. Do not use a persistent migration branch.
- Never make schema changes directly in the remote Supabase Dashboard. Capture every
  schema change in a migration and deploy it through the task branch and pull request.
- Use `auth.users` and `auth.identities` as the source of truth for authentication
  data. Do not duplicate passwords, login providers, phone numbers, or login
  timestamps in application profile tables.
- Keep application-facing profile data separate from authorization and account
  control data. Do not trust user-editable metadata for roles or permissions.
- Enable Row Level Security on every table in an exposed schema and grant only the
  operations required by each database role.
- Store THB monetary amounts as `BIGINT` satang values, never floating-point
  values. Apply balance changes and ledger inserts atomically under a row lock.
- Keep financial ledgers append-only. Correct mistakes with compensating entries
  and require an idempotency key for every retryable financial operation.
- Keep private financial schemas out of the Data API and perform financial writes
  through trusted backend operations only.
