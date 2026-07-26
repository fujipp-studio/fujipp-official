# GitHub Rules

## Workflow

1. Create a new branch for one task.
2. Commit each distinct change separately.
3. When the task is complete, open a pull request into `main`.
4. Merge the pull request into `main`.
5. Delete the merged branch.
6. Create a new branch before starting the next task.

The repository owner uses a separate GitHub account to open pull requests and merge them into `main`.
AI agents must not open or merge pull requests unless explicitly asked.

### Database Changes

- Use the same task branch and pull request workflow as other changes.
- Keep migration files under `supabase/migrations/`.
- Merging a migration into `main` triggers the automatic database migration deployment.
- Do not use a persistent `db/migrations` branch.

## Commits

- Keep each commit focused on one concern.
- Do not mix unrelated changes in one commit.
- Each commit should be safe to revert without removing unrelated work.

## Branch Naming

Use:

```text
<type>/<scope>-<task>
```

### Types

| Prefix | Use for | Example |
| --- | --- | --- |
| `feat/` | New features or systems | `feat/add-shop-cart` |
| `fix/` | Bug fixes | `fix/bot-not-reply` |
| `hotfix/` | Urgent production fixes | `hotfix/payment-crash` |
| `refactor/` | Internal changes without behavior changes | `refactor/bot-command-handler` |
| `chore/` | Maintenance, dependencies, or configuration | `chore/update-nextjs` |
| `docs/` | Documentation | `docs/update-readme` |
| `perf/` | Performance improvements | `perf/optimize-image-loading` |
| `test/` | Test additions or changes | `test/auth-login` |

### Scope

Include the affected system when the project area is relevant.

```text
feat/core-supabase-auth
fix/bot-command-error
feat/shop-stripe-payment
```
