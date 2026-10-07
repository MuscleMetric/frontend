# Workout behaviour contract

This document defines the backend behaviour MuscleMetric relies on for workout
creation and completed-workout persistence. The database tests in
`supabase/tests/database/` are executable versions of these rules.

## Ownership and privacy

A workout belongs to exactly one user.

An authenticated user must:

- be able to read their own workouts;
- be unable to read another user's workouts;
- be able to create a workout only for themselves;
- be unable to update or delete another user's workout;
- be unable to add or modify `workout_exercises` under another user's workout.

The same ownership boundary must propagate through completed-workout history:

- `workout_history` is visible only to its owner;
- `workout_exercise_history` is accessible only through an owned history row;
- `workout_set_history` is accessible only through an owned exercise-history row.

These rules are enforced by Postgres RLS, not by trusting the mobile client.

## Completing a workout

The app persists a completed workout through
`save_completed_workout_v1(jsonb)`.

A successful save must:

1. derive the user from `auth.uid()`;
2. require a non-empty `client_save_id`;
3. create exactly one `workout_history` row;
4. create one `workout_exercise_history` row for every completed exercise;
5. create every submitted set in `workout_set_history`;
6. preserve exercise/set order and submitted values;
7. apply optional plan/workout target updates only when the authenticated user
   owns the relevant records;
8. process cardio PRs after the history rows exist.

## Retry/idempotency behaviour

Mobile requests can be retried because of poor connectivity or app lifecycle
changes. Repeating the same completed-workout save with the same
`client_save_id` must:

- return the original `workout_history.id`;
- not create a second history row;
- not duplicate exercise history;
- not duplicate set history.

This is a hard data-integrity contract.

## Transaction behaviour

A completed workout must never be partially persisted. If any part of the save
fails, the parent history row and all child history rows from that call must roll
back together.

An explicit rollback regression test will be added after the initial happy-path
and idempotency suite is established.

## Test mapping

Current pgTAP coverage:

- `010_workout_rls.test.sql` — ownership and cross-user isolation;
- `020_save_completed_workout.test.sql` — successful save shape and retry
  idempotency.

Next coverage:

- transaction rollback on an invalid set;
- optional plan completion update;
- optional workout-target updates;
- cardio PR side effects;
- archived/deleted workout behaviour.
