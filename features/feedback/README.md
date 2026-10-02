# Feedback feature

Settings-integrated feedback feature for MuscleMetric.

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
} from "@/features/feedback";

<IssueFeedbackForm sourceScreen="settings" onSubmitted={() => {}} />;
<ImprovementFeedbackForm sourceScreen="progress" onSubmitted={() => {}} />;
<AppRatingFeedbackForm sourceScreen="home" onSubmitted={() => {}} />;
```

`sourceScreen` is optional, but callers should provide it where possible so feedback can be grouped by where it originated.

## Database

`data/schema.sql` matches the create_app_feedback migration applied to MuscleMetric on 2 October 2026. Do not run it again against an existing table.

Settings contains three separate links to /features/feedback/issue, /features/feedback/improvement and /features/feedback/rating. Shared components live outside app/ so Expo Router only sees route screens.

Users can insert their own feedback but cannot read, update or delete it. Review submissions through Supabase Table Editor or SQL Editor as a database administrator. Profile deletion cascades to feedback.

The client records the installed native app version, platform, OS version and device model. Web development falls back to the Expo config version. Failed submissions preserve form text and repeated taps are locked while submitting.

Database allow/deny tests run in a transaction and roll back all test submissions. Device testing is still required for keyboard layout and navigation.
