# MuscleMetrics Database Guide

> Current baseline: supplied schema snapshot plus repository usage. The schema snapshot is context, not an executable migration. Supabase migrations/RPC definitions remain the implementation source where present.

## Core model
```text
profiles
  ├── plans
  │    └── plan_workouts ── workouts
  │                         └── workout_exercises ── exercises
  │
  ├── goals ── plans / exercises
  ├── workout_history
  │    └── workout_exercise_history
  │         └── workout_set_history
  ├── user_achievements / user_achievement_progress
  └── daily_steps / weekly & step stats

exercises
  └── exercise_muscles ── muscles
```

## Template vs history
This distinction is fundamental.

### Training definitions
- `plans` — user training plans and date/session targets.
- `plan_workouts` — associates ordered workouts with plans.
- `workouts` — reusable user-owned workout definitions.
- `workout_exercises` — ordered exercise prescriptions, targets, notes, supersets/dropsets.

### Completed training
- `workout_history` — completed workout session.
- `workout_exercise_history` — exercise instance within that completed session.
- `workout_set_history` — actual set result (reps/weight/time/distance/drop index).

Do not overwrite historical performance when a workout template is edited.

## Users
### `profiles`
Extends the authenticated user with product data including name/email, body metrics, date of birth, settings, timezone, weekly workout goal, active plan, streak and volume target.

Profile ID maps to the auth user ID.

## Exercises
### `exercises`
Exercise catalogue with name, equipment, type/level, popularity, media/instructions.

### `muscles`
Canonical muscle catalogue.

### `exercise_muscles`
Many-to-many exercise-to-muscle mapping with a 0–100 contribution value. This is important groundwork for future muscle-fatigue calculations.

## Plans and goals
### `plans`
User-owned programme with start/end date, completion state and weekly target sessions.

### `plan_workouts`
Connects a plan to workouts and stores plan ordering/archive state.

### `goals`
User goals with optional plan/exercise relationships, numeric target, unit, deadline and active state.

### `plan_shares`
Tokenised plan-sharing records with expiry/active state.

## Achievements
- `achievements` defines an achievement and JSON rule.
- `user_achievement_progress` stores progress.
- `user_achievements` records unlocks.

## Activity/consistency
- `daily_steps` — daily user step count.
- `user_steps_stats` — aggregated step-goal/streak statistics.
- `user_weekly_goal_stats` — weekly goal outcome.
- `user_weekly_workout_stats` — weekly workout goal/completion state.

## Notifications
`device_tokens` stores per-user push tokens and platform.

## Security rules
- User-owned rows must be protected by RLS.
- Client code uses the anon/public client with authenticated user context.
- Never expose the service role to the mobile app.
- Foreign-key ownership does not replace RLS.
- New Coach/PT relationships will require explicit access policies; do not weaken athlete isolation to implement them.

## Schema-change checklist
For a new table/column:
1. Define ownership and lifecycle.
2. Add constraints and foreign keys.
3. Define RLS/select/insert/update/delete policy requirements.
4. Decide whether history must remain immutable when templates change.
5. Add indexes for actual query patterns.
6. Update generated/types/RPCs as required.
7. Update this document.
