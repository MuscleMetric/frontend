# MuscleMetrics — Mobile App

**MuscleMetrics** is a workout planning, logging and progress-analysis app focused on structured training, fast gym-floor interactions and useful long-term history.

- **Official website:** https://musclemetric.github.io/musclemetric-legal/
- **iPhone App Store:** https://apps.apple.com/us/app/musclemetrics/id6755702103
- **Privacy Policy:** https://musclemetric.github.io/musclemetric-legal/privacy.html
- **Terms & Conditions:** https://musclemetric.github.io/musclemetric-legal/terms.html

> The GitHub organisation/repository URLs retain the older singular `MuscleMetric` spelling. The official product and App Store name is **MuscleMetrics**.

This repository contains the mobile frontend, built with **Expo + React Native + TypeScript**.

## Product overview

MuscleMetrics is designed for users who want more than isolated workout notes. Training is represented as connected data:

```text
plans → workouts → exercises → completed sets
```

That structure supports a workflow where users can plan a session, record what actually happened and then review the history and progress created by that work.

### Available product areas

- Structured workout-plan creation and editing
- Ordered workouts and exercises
- Weight-and-rep, timed and distance-based exercises
- Exercise notes and instructions
- Set-by-set live workout logging
- Reps, weight, time and distance recording
- Rest timers and overall workout timing
- Completed workout history
- Exercise-level performance history
- Training volume, frequency and progress views
- Goals and achievements

The public website clearly separates released functionality from future/planned Coach features.

## Quick start

```bash
npm install
cp .env.example .env
npx expo start
```

## Tech stack

### Frontend
- Expo / React Native
- TypeScript
- Expo Router
- React hooks and context

### Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Postgres views and functions for derived metrics

### Tooling
- EAS Build / EAS Submit
- ESLint / TypeScript
- GitHub

## Project structure

```text
├── app/                # Expo Router screens and feature modules
├── components/         # Reusable UI components
├── lib/                # Shared clients, hooks and application logic
├── utils/              # Formatting and calculation helpers
├── assets/             # Images, icons and fonts
├── ios/                # Native iOS project
├── eas.json            # EAS configuration
├── app.json            # Expo application configuration
└── package.json
```

## Backend model

The Supabase/PostgreSQL backend stores training as relational data. Core groups include:

**Templates**
- `plans`
- `workouts`
- `workout_exercises`

**History**
- `workout_history`
- `workout_exercise_history`
- `workout_set_history`

**Progress**
- `goals`
- `achievements`
- `user_achievements`
- `user_achievement_progress`

**Metadata**
- `exercises`
- `muscles`
- `exercise_muscles`

Row Level Security is used to separate user data at the database level.

## Typical workout flow

1. The user opens a planned workout.
2. The app loads its exercises and targets.
3. The user records completed sets during the session.
4. Completed workout, exercise and set history is persisted.
5. History, goals and progress views can use the recorded data.

## Environment variables

Create `.env` at the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Only variables prefixed with `EXPO_PUBLIC_` are exposed to the client. Never commit service-role keys or other secrets.

## Build and release

```bash
# Development
npx expo start

# iOS development build
eas build -p ios --profile development

# iOS production build
eas build -p ios --profile production
```

The verified public store availability linked above is iPhone. Do not infer a public Android release solely from development/build support in this repository.

## Testing

Testing is currently primarily manual and integration-focused using simulators, physical devices and the live Supabase backend. Critical workout-session reliability should be tested against real app lifecycle events such as backgrounding, locking the device and returning to an active workout.

## Roadmap

Current product work and planned features are tracked through GitHub issues/project planning. The public website also describes the future Coach/PT direction while explicitly marking those features as planned or in development.

See the official site for the current product story and public roadmap context:

https://musclemetric.github.io/musclemetric-legal/

## Contributing

- Use focused feature branches.
- Keep pull requests small and reviewable.
- Do not commit secrets or generated build artifacts.
- Follow existing patterns for data access, state and UI behaviour.
- Verify relevant workout, navigation and account flows before merging.

## License

License to be defined.

© MuscleMetrics
