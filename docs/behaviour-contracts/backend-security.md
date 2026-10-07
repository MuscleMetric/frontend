# Backend security contract

This document defines access expectations for privileged database operations.
The production baseline in PR #42 made these APIs visible in Git for the first
time, which exposed several permissions that need hardening with forward
migrations.

## Core rule

A `SECURITY DEFINER` function is privileged code. It must not be callable by
`PUBLIC`, `anon`, or ordinary `authenticated` users unless the function
explicitly authenticates and authorizes the caller for every privileged action.

## Internal notification APIs

The following are internal backend operations, not public client APIs:

- `claim_notification_push_jobs_v1(integer)`;
- the internal `create_notification_v1(...)` overload used by notification
  triggers;
- notification queue helpers that accept arbitrary recipient IDs.

Expected contract:

- anonymous callers cannot execute them;
- ordinary app users cannot forge recipients/actors or claim worker jobs;
- the service worker or trusted trigger path remains able to execute them.

## Workout test deletion RPC

`delete_workout_test_v1(user_id, workout_id)` is test/support functionality.

Expected contract:

- it must never allow an anonymous caller to archive another user's workout;
- it should be service-only, removed from production, or rewritten to derive the
  user from `auth.uid()` rather than trusting a caller-supplied user ID.

## Push worker recovery

Claiming a notification changes a job from `pending` to `processing`.

Expected contract:

- a transient failure after claiming must not strand the job permanently;
- the worker must either requeue/fail claimed jobs before returning, or claims
  must use a recoverable lease/stale-processing strategy.

## Rollout approach

1. Capture these expectations as tests.
2. Add forward migrations/code changes that satisfy them.
3. Run database/security tests in CI.
4. Only then deploy the hardening to production.

The production baseline files are historical starting points and must not be
edited to hide these findings.
