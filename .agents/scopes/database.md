# Database Rules

- Database migrations will live under `supabase/migrations/` once the directory is introduced.
- Create database changes on a task branch from `main`.
- Open a pull request and merge the reviewed migration into `main`.
- Merging migration files into `main` triggers the automatic database migration deployment.
- Treat `main` as the single source of truth. Do not use a persistent migration branch.
