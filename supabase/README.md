# MuscleMetric Supabase

This directory is the version-controlled source for MuscleMetric's Supabase backend.

## Production baseline

PR #42 establishes a current-state baseline from the live Supabase project as of
2026-10-07. The production project pre-dates a complete migration workflow, so
only four migration versions existed remotely even though the database already
contained the full application schema.

To align local history with production safely, those same four remote migration
versions are present in `supabase/migrations/`, but their contents are a
**squashed reconstruction of the current production state**, not a historical
replay of what each original migration contained.

This matters because all four versions are already marked as applied in
production. A future `supabase db push` will therefore not try to recreate the
baseline on the live database.

Do not edit these four baseline files for future schema changes.

## Baseline scope

The baseline includes:

- 49 `public` tables with RLS state
- 17 `public` views
- 189 `public` functions
- 125 `public` RLS policies
- public triggers, indexes, constraints and object privileges
- the application-owned `admin` schema:
  - 3 tables
  - 1 view
  - 2 sequences
  - 1 function
- all three deployed Edge Functions:
  - `close-expired-plans`
  - `process-notification-push-jobs`
  - `revenuecat-webhook`

Production user data is not committed.

## Edge Function configuration

`supabase/config.toml` mirrors the deployed JWT behaviour.

`revenuecat-webhook` has `verify_jwt = false` because RevenueCat is an
external webhook and cannot supply a Supabase user JWT. The function performs
its own Bearer-secret validation using `REVENUECAT_WEBHOOK_SECRET`.

The other two functions require JWT verification.

## Operational configuration intentionally not replayed

Hosted cron rows are runtime configuration rather than application schema and
are not automatically recreated by this baseline.

Production currently contains active jobs for ending due plans, weekly
maintenance, notification push processing and HTTP-response cleanup, plus
inactive historical jobs. One notification cron command contains a
production-specific function URL/token placeholder, so blindly copying it into
local development would be unsafe.

Cron configuration will be reviewed and versioned deliberately in a later
operations/security PR.

There are currently no Storage buckets and no tables in the
`supabase_realtime` publication.

## Local verification

With Docker running and the Supabase CLI installed:

```bash
supabase db start
supabase db reset
```

The GitHub CI `Database baseline` job performs this rebuild automatically on
every PR.

## Future database changes

From this point forward, database changes must be migration-first.

```bash
supabase migration new descriptive_change_name
# edit the generated migration
supabase db reset
```

Then commit the migration with the application change that depends on it.

Do not make production-only Dashboard/SQL-editor schema changes and leave them
unversioned. If emergency drift occurs, pull/reconcile it immediately before
continuing development.

## Seeds and tests

`seed.sql` is intentionally minimal and contains no production data. Database
tests should create only the fixtures they require.

The next engineering phase will add pgTAP/database behaviour tests under
`supabase/tests/database/`, beginning with RLS isolation and completed-workout
persistence.
