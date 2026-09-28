# Feedback feature

Self-contained review-stage feedback feature for MuscleMetric.

## Feedback types

1. `IssueFeedbackForm` — report something that is not working correctly.
2. `ImprovementFeedbackForm` — suggest a change or feature improvement.
3. `AppRatingFeedbackForm` — rate MuscleMetric overall from 1–5 stars.

All three forms submit through `data/feedback.mutations.ts`, which writes to `public.app_feedback` using the existing authenticated Supabase client.

## Usage

```tsx
import {
  AppRatingFeedbackForm,
  ImprovementFeedbackForm,
  IssueFeedbackForm,
} from "@/app/features/feedback";

<IssueFeedbackForm sourceScreen="settings" onSubmitted={() => {}} />;
<ImprovementFeedbackForm sourceScreen="progress" onSubmitted={() => {}} />;
<AppRatingFeedbackForm sourceScreen="home" onSubmitted={() => {}} />;
```

`sourceScreen` is optional, but callers should provide it where possible so feedback can be grouped by where it originated.

## Database

`data/schema.sql` contains the proposed table, indexes and RLS policy. It is intentionally committed with the feature instead of being applied directly to the live Supabase project while this work is awaiting review.

Before these forms are wired into production screens:

1. Review and apply `data/schema.sql` to Supabase.
2. Confirm `public.app_feedback` is exposed to the authenticated Data API role.
3. Test one submission of each type while signed in.
4. Confirm anonymous users cannot insert rows.

The client automatically records app version, platform, OS version and device model with each submission. Users do not need to enter technical diagnostics themselves.
