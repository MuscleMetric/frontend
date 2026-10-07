# Backend behaviour coverage

PR #45 expands the database safety net beyond workouts so refactoring can begin
without losing confidence in core application behaviour.

## Covered domains

- Workout completion
  - parent/child persistence
  - idempotent retries
  - transaction rollback
  - plan-workout completion side effect
  - workout target updates with ownership guards
  - cardio PR generation
- Plans and goals
  - cross-user read isolation
  - create/update/delete ownership
  - plan-workout ownership
- Social
  - public/followers/private profile visibility
  - immediate follow vs private follow request
  - blocking removes visibility and follow edges
- Notifications
  - recipient-only reads
  - recipient-only read-state changes
  - notification preference ownership
- Feedback
  - users can submit only as themselves
  - invalid shapes/tags are rejected by database constraints
- Achievements and weekly progress
  - cross-user isolation
  - achievement progress ownership
  - weekly goal stats ownership
- Security foundation
  - all public tables have RLS
  - privileged internal RPC access
  - stale notification worker recovery

## What this does not mean

This is not exhaustive end-to-end coverage of every screen. It establishes
backend contracts around the highest-risk data and permission boundaries so
frontend/service refactors can start safely.

From PR #46 onward, new/refactored code should add or adjust tests alongside the
change instead of waiting for another dedicated test phase.
