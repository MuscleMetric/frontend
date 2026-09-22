# MuscleMetrics Architecture

## Current stack
- Expo / React Native
- TypeScript
- Expo Router
- React hooks/context plus Zustand where appropriate
- Supabase Auth + PostgreSQL/PostgREST/RPCs
- EAS Build / Submit
- Jest / React Native Testing Library
- Sentry
- Native integrations including notifications and Live Activities

## High-level model
```text
Expo / React Native UI
        |
        +-- feature state / session state
        |
        +-- Supabase client
                |
                +-- Auth
                +-- tables
                +-- RPC/functions
                +-- RLS
                |
             PostgreSQL
```

## Repository boundaries
- `app/` — Expo Router routes and feature implementation.
- `app/features/` — feature-oriented modules.
- `ui/` — reusable design-system primitives and tokens.
- `lib/` — cross-feature infrastructure: auth, Supabase, billing legacy, notifications, session/runtime utilities.
- `supabase/` — Supabase project/function configuration.
- `ios/` — generated/native iOS project required by native functionality.
- `__tests__/` — automated tests.

## Feature organisation
Prefer feature-local folders for screens, data hooks, state, UI and utilities. Reusable product-agnostic primitives belong in `ui/`; cross-feature infrastructure belongs in `lib/`.

Do not move feature-specific business behaviour into the design system simply because more than one screen currently imports it.

## Data ownership
Persisted Supabase/PostgreSQL data is authoritative for completed training and user progress. Client state is appropriate for:
- in-progress form/draft state;
- live workout state;
- temporary UI state;
- recoverable local persistence required for an interrupted session.

A live workout is a special case: the app contains local/session persistence and server persistence so an interruption should not destroy an active workout.

## Database access
- Use the authenticated Supabase client.
- Prefer existing RPCs for complex/derived queries.
- Do not bypass RLS assumptions.
- Do not ship service-role credentials in the client.
- Keep user isolation enforced server-side.
- Derived metrics that are shared or authoritative should live server-side where practical.

## Authentication and routing
Authentication is provided by Supabase. Main-tab routing gates users through progressive onboarding before normal app access. Routing is file-based via Expo Router.

## UI architecture
Use `useAppTheme()` and components/tokens in `ui/`. New feature screens should not establish independent colours, spacing scales or typography.

## Error handling and observability
- User-facing failures need an explicit recoverable error state where possible.
- Unexpected failures should be logged without exposing secrets or personal data.
- Sentry is available for production observability.
- Network-dependent screens should distinguish loading, empty and error states.

## Native behaviour
Features such as Live Activities, notifications and native iOS configuration require development/production builds; do not assume Expo Go represents production behaviour.

## Billing
RevenueCat/paywall implementation remains in the repository as legacy infrastructure. Current product direction is that core functionality is free. New pages must not introduce a dependency on the legacy paywall unless the product decision is explicitly changed.

## Development conventions
- TypeScript types should remain explicit and accurate.
- Prefer existing patterns over introducing a second state/data library for one feature.
- Keep PRs focused.
- Do not commit secrets.
- Run lint/type/tests appropriate to the changed area.
- When architecture materially changes, update this document with the code change.

## Architectural decision test
Before adding infrastructure, ask:
1. Does an existing feature pattern already solve this?
2. Is the state temporary UI state, recoverable session state, or authoritative persisted data?
3. Does this logic need server authority/security?
4. Is this component truly reusable?
5. Will this still be understandable six months from now?
