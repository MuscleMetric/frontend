# Contributing to MuscleMetric

## Main branch

`main` is the production-ready branch. Changes should reach `main` through a pull request rather than by direct push.

Every pull request targeting `main` should pass the repository CI checks before it is merged:

- ESLint
- TypeScript type checking
- Jest tests

## Branch naming

Use short-lived branches created from the latest `main`.

Preferred prefixes:

- `feat/` — new product functionality
- `fix/` — bug fixes
- `chore/` — tooling, maintenance, dependencies, or repository work
- `hotfix/` — urgent production fixes
- `docs/` — documentation-only changes

Examples:

```text
feat/readiness-prediction
fix/workout-save
chore/engineering-foundation
hotfix/auth-crash
docs/backend-architecture
```

Delete branches after their work has been merged unless there is a specific reason to keep them.

## Pull request workflow

1. Update local `main`.
2. Create a focused branch from `main`.
3. Make one logical change.
4. Run the local quality checks.
5. Push the branch and open a pull request into `main`.
6. Resolve review feedback.
7. Merge only when CI is green.
8. Delete the merged branch.

Run the same core checks locally with:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:ci
```

## Pull request scope

Keep pull requests small enough to review properly. Refactors should be split into incremental changes that leave the app working after each merge.

A pull request should explain:

- what changed,
- why it changed,
- how it was tested,
- any known risks or follow-up work.

## Merge strategy

Prefer squash merging for normal feature, fix, and maintenance pull requests so `main` keeps a concise history.

Native releases remain a separate step: merging to `main` means the source is production-ready, not that every merge must immediately create an App Store release.
