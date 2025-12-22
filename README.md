# MuscleMetric — Mobile Frontend

MuscleMetric is a full-stack fitness tracking application focused on **structured workout logging**, **training consistency**, and **long-term performance analysis**.  
This repository contains the **mobile frontend**, built with **Expo + React Native (TypeScript)**.

## Product overview

MuscleMetric is designed for users who want **more than basic workout logs**.

Instead of simple “exercise + reps” entries, the app models training as **structured, relational data**:

- plans → workouts → exercises → sets
- full historical record of completed training
- measurable progress toward goals
- long-term consistency and streak tracking

The frontend is built to support **real-world gym usage**:
- fast input during workouts
- live timers and session state
- resilience to interruptions (locking phone, app backgrounding)
- clear progress feedback without clutter

The goal is to combine the **speed of a workout notebook** with the **depth of performance analytics**, while keeping the experience mobile-first and intuitive.

## Quick start

```bash
npm install
cp .env.example .env
npx expo start
```

## Screenshots / Demo

> Screenshots and short demo clips will be added as the UI stabilises.

Planned coverage:
- Home / dashboard view
- Workout plan editor
- Live workout session (sets, timer, progress)
- Workout history & progress charts
- Goals & achievements overview

Once available, assets will live under:
/assets/readme/

## Core features

### Workout creation & planning
- Create and edit workout plans
- Define workouts with ordered exercises
- Support multiple exercise types:
  - weight & reps
  - time-based
  - distance-based (cardio)
- Per-exercise notes and metadata

### Live workout sessions
- Set-by-set logging (reps, weight, time, distance)
- Rest timers and overall workout timer
- Clear progression through exercises and sets
- Automatic handling of workout completion

### Progress & history
- Workout history grouped by date
- Exercise-level progress tracking
- Volume, frequency, and trend metrics
- Historical comparisons across sessions

### Goals & achievements
- Assign goal exercises to plans
- Automatic goal progress tracking
- Achievement progress and unlocks

### Cross-platform support
- iOS and Android via Expo
- Development builds for native features
- OTA updates supported where appropriate

## Tech stack

### Frontend
- **Expo** (React Native)
- **TypeScript**
- **Expo Router** (file-based routing)
- React hooks and context for state management

### Backend
- **Supabase**
- **PostgreSQL**
- Supabase Auth
- Postgres views and functions for derived metrics

### Tooling & infrastructure
- **EAS Build** and **EAS Submit**
- ESLint & TypeScript
- GitHub for version control

## Architecture overview

High-level architecture:
```text
Mobile App (Expo / React Native)
        |
        |  Supabase client (auth + data queries)
        v
Supabase API (PostgREST)
        |
        v
PostgreSQL
(tables, views, functions, RLS)
```

### Architectural principles
- The mobile client is stateless beyond authentication and local UI state
- All authoritative data and calculations live in the database
- Derived metrics (streaks, totals, trends) are computed via views and functions
- Row Level Security (RLS) enforces user isolation and access control
- The frontend prioritises UX, performance, and reliability over business logic

## Project structure

```
├── app/                # Expo Router screens (file-based routing)
│   ├── (auth)/         # Authentication flows
│   ├── (tabs)/         # Main application tabs
│   └── features        # Feature broken down into segments
│   └── _layout.tsx     # Root layout
│
├── components/         # Reusable UI components
├── lib/                # Shared logic (Supabase client, hooks)
├── utils/              # Helper utilities (dates, formatting, calculations)
├── assets/             # Images, icons, fonts
├── ios/                # Native iOS project (present for dev builds)
├── eas.json            # EAS build configuration
├── app.json            # Expo app configuration
└── package.json
```

## Getting started

### Prerequisites
- Node.js (LTS recommended)
- npm (or pnpm / yarn)
- macOS + Xcode (for iOS development)
- Android Studio (for Android development)
- Expo CLI via npx

### Installation
Clone the repository and install dependencies:

```bash
npm install
```

Running locally
Start the Expo development server:
`npx expo start`

From the Expo menu you can:
- Run on the iOS Simulator
- Run on an Android Emulator
- Launch a development build on a physical device
- Scan with Expo Go (if compatible)
  
Note: Some native features (e.g. Live Activities, push notifications) require a development build and will not work in Expo Go.

## Environment variables

Create a .env file at the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Rules
- Only variables prefixed with EXPO_PUBLIC_ are exposed to the client
- Never commit secrets or service role keys
- Use EAS secrets for CI and production environments
- Restart the dev server after changing environment variables
- Environment variables are injected at build time and should be treated as public.

## Backend overview (Supabase)

The backend is powered by **Supabase** using a relational **PostgreSQL** database designed specifically for structured fitness data.

### Core data groups

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

### Design notes
- All user data is protected with **Row Level Security (RLS)**
- Views and database functions compute derived metrics such as:
  - streaks
  - totals
  - progress trends
- The frontend never trusts client-side calculations
- The database is the single source of truth for user progress

## State & data flow

The application follows a **server-authoritative data model** with minimal persistent client state.

### Typical workout session flow

1. User opens a workout
2. App fetches workout structure and exercises from the backend
3. User logs sets locally during the session
4. On workout completion:
   - a record is inserted into `workout_history`
   - set-level data is inserted into `workout_set_history`
   - derived metrics are updated via database views/functions
5. The UI refreshes from backend state

### Key principles
- Session state is ephemeral and exists only for the duration of a workout
- No progress data is considered valid until persisted server-side
- UI state is rebuilt from backend data on reload
- This approach ensures consistency even if the app is backgrounded or closed mid-session


## Build & release (EAS)

Builds and distribution are managed using **Expo Application Services (EAS)** and the configuration defined in `eas.json`.

### Common build commands

```bash
# Development builds (native features enabled)
eas build -p ios --profile development
eas build -p android --profile development

# Production builds
eas build -p ios --profile production
eas build -p android --profile production
```
Distribution notes
- iOS builds are distributed via TestFlight
- Android builds can be distributed internally or via the Play Store
- Development builds are recommended for testing native features
- OTA updates are used selectively for UI-only or non-breaking changes

Versioning
- App versioning is managed via Expo/EAS configuration
- Native build numbers are incremented per store requirements

## Troubleshooting

### iOS bundle identifier ignored
- This is expected when an `ios/` directory exists
- Native configuration takes precedence over values in `app.json`

### iOS build / CocoaPods failures
If builds fail during the Pods install phase:

```bash
rm -rf node_modules
npm install
cd ios && pod install && cd ..
```

Environment variables not loading
- Ensure variables are prefixed with EXPO_PUBLIC_
- Restart the dev server with cache cleared:
`npx expo start -c`

Supabase permission errors
- Verify Row Level Security (RLS) policies
- Confirm the authenticated user has access to the queried rows
- Ensure the correct user ID is being passed in queries

Expo Go limitations
- Some native features (notifications, Live Activities, widgets) do not work in Expo Go
- Use a development build for accurate testing

## Testing

At present, testing is primarily **manual and integration-focused**, reflecting the mobile-first and UX-driven nature of the application.

### Current approach
- Manual testing during development using:
  - iOS Simulator
  - Android Emulator
  - Physical devices via development builds
- End-to-end flows validated against the live Supabase backend
- Database constraints and RLS policies act as a safety net for invalid writes

### Planned improvements
- Introduce unit tests for utility functions and calculation helpers
- Add integration tests for critical flows (auth, workout completion)
- Explore end-to-end testing using device automation tooling

Testing strategy prioritises **real-world reliability** during workouts over isolated component tests.

## Contributing

Contributions are welcome, but should follow a few guidelines to keep the codebase consistent and maintainable.

### Workflow
- Create feature branches using the format: `feature/<short-description>'
- Keep pull requests small, focused, and easy to review
- Avoid committing generated files, build artifacts, or secrets

### Code standards
- Follow existing patterns for state management and data fetching
- Prefer clear, explicit logic over abstraction
- Keep UI components focused and reusable
- Ensure TypeScript types remain accurate and strict

### Before opening a PR
- Run the app locally and verify core flows
- Ensure no environment variables or secrets are committed
- Confirm changes do not bypass backend security assumptions

For larger changes, open an issue or discussion first to align on approach.

## Roadmap

Planned and exploratory improvements for MuscleMetric include:

### Short-term
- UI polish and performance improvements
- Expanded progress visualisations
- Improved workout history browsing

### Medium-term
- Apple Watch companion app
- Live Activities enhancements
- Home screen widgets (iOS)
- Advanced analytics dashboards

### Long-term / R&D
- Social features (friends, kudos, sharing)
- Coach / PT plan sharing and management
- Video-based exercise analysis and form feedback
- Performance profiling (velocity-based training concepts)

The roadmap is intentionally flexible and driven by real-world usage and feedback.

## License

License to be defined.

© MuscleMetric


