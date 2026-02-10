# MuscleMetric — Stage 2 + Stage 3 Onboarding (Post-Stage1)

This folder contains the **post-setup onboarding experiences** that happen *after* Stage 1 is completed.

- **Stage 2:** shown **after the user completes their first workout**
- **Stage 3:** shown **after the user reaches 5 total workouts completed**

These are designed to:
1) reinforce early wins,
2) guide the next best action,
3) progressively unlock “experienced” behaviours (plans, goals, consistency),
4) show once, and never annoy the user again.

---

## Goals (non-negotiables)

### Stage 2 (after first workout)
**Trigger:** first completion (workout count goes from 0 → 1)

**What it must achieve**
- Celebrate completion (small win moment).
- Confirm the app “understood” the workout (recap + highlights).
- Nudge a single, clear next action (pick one primary CTA).
- Introduce one habit concept (consistency / plan / goals) without overwhelming.
- Mark as “seen” so it doesn’t reappear every launch.

**What it should NOT do**
- Block the user from using the app.
- Ask for lots of new information.
- Present multiple primary CTAs at once.

---

### Stage 3 (after 5 workouts)
**Trigger:** user hits 5 total completions (count goes from 4 → 5)

**What it must achieve**
- Bigger celebration / milestone (unlock moment).
- Explain what’s unlocked (experienced behaviours / richer Home state).
- Present the best “next step”:
  - plan creation OR
  - goal setup OR
  - consistency commitment (choose one primary CTA, others as secondary).
- Encourage continuing momentum (streak / next week / next session).
- Mark as “seen” so it shows once.

**What it should NOT do**
- Re-run the Stage 1 setup flow.
- Show repeatedly once dismissed/completed.

---

## Definition of “seen” / “completed”

We store state server-side (preferred: columns on `profiles`).
- `onboarding_stage2_completed_at` (timestamptz) OR stored in `profiles.settings`
- `onboarding_stage3_completed_at` (timestamptz) OR stored in `profiles.settings`

**Stage 2 is considered done when:** completed_at is set (or dismissed_at if you allow skipping).
**Stage 3 is considered done when:** completed_at is set (or dismissed_at if you allow skipping).

---

## Navigation & entry points (how these screens are opened)

These are **feature screens**, not auth screens.

You can navigate to them from anywhere when the trigger hits:
- After workout completion flow
- Home screen gate (if user qualifies but hasn’t seen it yet)

Recommended routes (thin wrappers):
- `app/onboarding/stage2.tsx` → imports `app/features/onboarding/stage2_first_workout`
- `app/onboarding/stage3.tsx` → imports `app/features/onboarding/stage3_five_workouts`

(We keep the real UI in `app/features/onboarding/**`.)

---

## Folder structure (source of truth)
app/features/onboarding/
  README.md

  shared/
    types.ts
    schema.ts
    copy.ts
    storage.ts
    rpc.ts
    useOnboardingGate.ts

    components/
      Stepper.tsx
      TitleBlock.tsx
      CardShell.tsx
      PrimaryCTA.tsx
      SecondaryCTA.tsx
      IconBulletRow.tsx
      MetricRow.tsx
      StatPill.tsx
      ProgressRingMini.tsx
      Divider.tsx

  stage2_first_workout/
    index.tsx                 // screen entry
    types.ts
    schema.ts
    copy.ts

    components/
      WorkoutRecapCard.tsx
      PRHighlightsCard.tsx
      NextActionCard.tsx
      TipCarousel.tsx
      RestDayNudgeCard.tsx

    steps/
      Stage2WelcomeStep.tsx
      Stage2RecapStep.tsx
      Stage2PersonalizeStep.tsx
      Stage2ReadyStep.tsx

  stage3_five_workouts/
    index.tsx                 // screen entry
    types.ts
    schema.ts
    copy.ts

    components/
      UnlockHeroCard.tsx
      StreakCard.tsx
      PlanPromptCard.tsx
      GoalsPromptCard.tsx
      SharePromptCard.tsx
      NextWeekPreviewCard.tsx

    steps/
      Stage3CelebrateStep.tsx
      Stage3UnlocksStep.tsx
      Stage3NextStepStep.tsx
      Stage3ReadyStep.tsx

  previews/
    PhonePreview.tsx
    Stage2Preview.tsx
    Stage3Preview.tsx
    mockStage2Data.ts
    mockStage3Data.ts

---

## What each folder is responsible for

### `shared/`
Reusable building blocks and logic used by both Stage 2 and Stage 3.

- `types.ts`
  - shared types (e.g. OnboardingGateDecision, CompletionState)
- `copy.ts`
  - shared microcopy patterns, labels, button text defaults
- `storage.ts`
  - safe local helpers (optional) to store short-lived state (e.g., “just finished workout id”)
- `rpc.ts`
  - supabase calls used by both (fetch counts, set completed_at fields)
- `useOnboardingGate.ts`
  - the “should we show Stage 2/3 right now?” hook

#### `shared/components/`
UI primitives consistent with the onboarding design system.
These should NOT know about “stage2” or “stage3” — they are generic.

---

### `stage2_first_workout/`
The “First workout completed” experience.

- `index.tsx`
  - orchestrates steps, owns state, fetches any needed recap data
  - sets stage completion flag server-side
- `types.ts`, `copy.ts`
  - stage-specific stuff only
- `components/`
  - stage-specific cards (recap, highlights, next action)
- `steps/`
  - step screens that compose the stage-specific + shared components

---

### `stage3_five_workouts/`
The “5 workouts milestone” experience.

- `index.tsx`
  - orchestrates steps, owns state, sets completion flag server-side
- `types.ts`, `copy.ts`
  - stage-specific stuff only
- `components/`
  - milestone hero + unlock cards + next step cards
- `steps/`
  - step screens that compose the milestone flow

---

## Implementation rules (keep us aligned)

1) **One primary CTA per screen.**
2) **No repeated showing once completed/dismissed.**
3) **Don’t block app usage** for Stage 2/3 (Stage 1 is the only hard block).
4) **Keep steps short** — users just want to move on.
5) **Everything must match the existing design system**
   - use `useAppTheme()` tokens
   - use app `Icon` component (Ionicons)
   - avoid emojis in UI
6) **Server is truth for completion**
   - if server says “completed”, never show again.

---

## Next work items

1) Create `shared/useOnboardingGate.ts` + `shared/rpc.ts`
2) Create Stage 2 shell (`stage2_first_workout/index.tsx`) with placeholder steps
3) Create Stage 3 shell (`stage3_five_workouts/index.tsx`) with placeholder steps
4) Wire triggers:
   - workout completion flow -> check Stage 2 gate
   - workout #5 completion -> check Stage 3 gate
   - optional: Home gate for “missed” triggers

