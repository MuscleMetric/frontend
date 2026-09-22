# MuscleMetrics Coach / PT Platform

> Status: FUTURE. This records agreed concepts and boundaries; it is not a description of current athlete-app functionality.

## Product direction
Extend MuscleMetrics so a coach/PT can manage clients without creating a disconnected second fitness product. Athlete training history remains central.

## Agreed concepts
- Distinct athlete/user and Coach/PT experiences.
- Coach can invite/onboard a client through a link.
- Coach can customise onboarding questions, including goals, injuries/limitations and sports context.
- Coach can create individualised training plans.
- Coach can leave notes at workout and exercise level.
- Coach controls bookable availability.
- Clients can book sessions into those available slots.
- Session bundles are supported.
- The intended commercial model discussed is a 1% platform commission on accepted client sessions.
- Typical PT usage must support clients training multiple times per week and coaches with substantial client rosters.

## Core domains

### Coach identity
Coach profile, services and availability must be distinct from athlete training profile data even when the same person can use both modes.

### Coach-client relationship
Requires an explicit relationship/permission model. A coach must never gain blanket access to athlete data merely by knowing a user ID.

### Client onboarding
Invite link -> client joins/links account -> coach questionnaire -> goals/context -> programme.

Questionnaires should be configurable but structured enough that important information is not buried in unqueryable text.

### Programming
Coach should be able to:
- create/assign plans;
- customise workouts per client;
- add workout/exercise notes;
- review completion and relevant progress.

Prefer extending the existing plan/workout/history model over duplicating athlete data.

### Booking
Coach opens availability; client books a permitted slot. Booking design must handle timezone, conflicts, cancellation and session state explicitly.

### Bundles/payments
Bundle balance and payment/commission ledger must be auditable. Payment state must not be inferred only from UI state.

## Architecture boundaries
- Do not weaken existing RLS to make coach access easier.
- Add explicit coach-client permissions.
- Keep athlete historical records attributable and stable.
- Financial records should be append/audit friendly.
- Booking and payment operations that require authority should execute server-side.

## Design direction
Coach surfaces must use the same MuscleMetrics design system. Coach mode can have denser management screens, but should still feel like the same product.

## Not yet finalised
The following require product/technical decisions before implementation:
- exact coach pricing/payment processor flow;
- cancellation/refund rules;
- bundle expiry rules;
- coach verification;
- messaging scope;
- calendar integrations;
- exact permissions for historical/readiness data;
- database schema.

## Delivery rule
Design each major Coach page/flow completely before implementation. Move features through:
`IDEA -> DESIGNED -> APPROVED -> BUILDING -> LIVE`.
