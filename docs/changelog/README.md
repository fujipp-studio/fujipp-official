# Changelog

Changelogs record completed work that is ready to enter `main`.

## Workflow

1. Finish the assigned work.
2. Prepare the final commits.
3. Add one concise entry to each affected area changelog.
4. Push the branch.
5. Open a pull request into `main`.
6. Merge the pull request.

Do not add entries for work in progress or changelog-only edits.

## Areas

Create an area file only when that area ships its first change:

- `frontend.md`
- `backend.md`
- `database.md`
- `infrastructure.md`
- `docs.md`

## Format

Add the newest entry at the top of the table.

```markdown
| Date | Change |
| --- | --- |
| YYYY-MM-DD | Concise completed outcome. |
```

Use one entry per affected area for each pull request. Describe what became better without documenting implementation steps.
