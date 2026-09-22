# MuscleMetrics Product Specification

> Status: living product document. Current behaviour is grounded in the app repository; future sections are explicitly labelled.

## Product purpose
MuscleMetrics is a mobile-first workout planning, logging and progress-analysis product. It is designed to keep gym-floor logging fast while turning structured training history into useful feedback over time.

## Product principles
1. **Logging must stay fast.** Analytics are valuable only if recording a workout remains low-friction.
2. **History is structured data.** Plans, workouts, exercises, sets and completed sessions should remain relational rather than becoming free-form logs.
3. **Progress should be understandable.** Prefer actionable trends and plain-language insights over data for its own sake.
4. **The core app is free.** Legacy subscription/RevenueCat code may remain while unused, but user-facing core functionality must not depend on a paywall.
5. **Server data is authoritative.** Persisted Supabase data is the source of truth for user progress.
6. **Build for real training conditions.** Backgrounding, phone locking, interruptions, timers and session recovery are normal usage.

## Current product — LIVE

### Navigation
The main application exposes five primary tabs:
- Home
- Progress
- Social
- Workouts
- Profile

### Onboarding
The app has progressive onboarding rather than a single first-run form:
- initial profile/training setup;
- a post-first-workout stage;
- a later stage triggered after additional training history.

### Home
Home adapts to user state and can surface plan/goals, weekly goal, streak, latest PR, recent workout, volume trend, achievements and starter content.

### Plans and goals
Users can create and edit training plans, define plan information, create workouts, select exercises, configure goals and review the plan before saving. Goals are connected to users and may be connected to a plan and exercise.

### Workouts
Users can create/edit workouts and run live sessions. Current code supports strength and cardio-style inputs, exercise notes, supersets, dropsets, optional sessions, adding/swapping exercises, session timers, workout review and recovery/persistence of an active workout.

### History
Completed workouts have dedicated history list/detail flows. Workout history can be searched, reviewed and shared.

### Progress and deep analytics
Progress includes consistency, strength highlights, recent activity and exercise summaries. Deep analytics currently models:
- current/top performance;
- estimated 1RM;
- volume trend;
- weight-vs-reps;
- set contribution;
- strength/progress over time;
- generated insight states with confidence.

### Social
The current app includes a social feed, search, profiles, inbox/notifications, comments, workout posts and PR posts.

### Profile and settings
Profile adapts to user state and surfaces activity, plan/history and achievements. Settings include personal/training information and account actions.

### Activity and achievements
The product tracks steps/step goals, workout consistency and achievements.

## Product areas — PLANNED

### Feedback loop
A simple in-app path for users to submit product suggestions is planned. It should be easy to reach and should not interrupt training.

## Product area — FUTURE

### Coach / PT platform
The future Coach platform is a separate expansion of MuscleMetrics, not a reason to compromise the athlete app. Planned concepts and decisions live in `COACH_PLATFORM.md`.

## Terminology
- **Plan** — a structured training programme containing workouts and goals.
- **Workout** — a reusable workout definition/template.
- **Live workout** — the active in-gym session.
- **Workout history** — a persisted completed session.
- **Exercise history** — exercise instances within a completed workout.
- **Set history** — actual set performance within exercise history.
- **e1RM** — estimated one-repetition maximum, currently calculated using the Epley formula. See `ANALYTICS_ENGINE.md` for the implemented analytics rules.

## Change rule
When product behaviour changes, update this document in the same PR when the change materially alters a product area, product principle, user journey or feature status.
