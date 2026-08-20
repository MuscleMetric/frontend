# MuscleMetric Coach — Confirmed Product Scope

This document records the features supported by four personal trainer interviews. It is the working scope for the first MuscleMetric Coach implementation.

It deliberately separates **confirmed requirements** from decisions that still need validation. A feature should not move into the confirmed scope only because it sounds useful.

## Product principle

MuscleMetric Coach must make client administration quick and painless while allowing each PT to coach differently.

The product should provide reusable templates and fast duplication, but the PT controls each client's questionnaire, goals, programme, workout instructions, bookings and tracking.

## 1. Coach workspace

- A PT has a Coach workspace for managing clients.
- The existing MuscleMetric training experience remains available for the PT's own training.
- The Coach workspace must remain usable with at least 45 active clients.
- The initial design target is 50 active clients without requiring the PT to open every client individually.
- Client search, filters and an attention queue are required.

## 2. Client invitation and onboarding

### Confirmed workflow

1. The PT creates or selects an onboarding questionnaire.
2. MuscleMetric creates a secure invitation link.
3. The PT sends the link to a new client.
4. The client completes the questionnaire.
5. The client creates or connects a MuscleMetric account.
6. The PT reviews the submitted information.
7. The PT accepts the client and the coach–client connection becomes active.

The invitation link is specifically for onboarding. It is not intended to replace the normal signed-in client experience after connection.

### Questionnaire builder

- Every PT can create their own questionnaire.
- MuscleMetric provides an editable default template.
- Questions can be added, removed, reordered, required or optional.
- PTs can save questionnaires as reusable templates.
- Supported topics include:
  - health conditions;
  - injuries and movement limitations;
  - sports played;
  - training history;
  - current activity;
  - desired outcomes;
  - available equipment;
  - availability;
  - lifestyle;
  - emergency contact;
  - PT-created custom questions.
- The client supplies information; the PT makes the coaching decision.
- Submitted onboarding information must be reviewed before it creates active goals or a programme.

## 3. Client management

Each client record must support:

- active, paused and former states;
- onboarding answers;
- PT notes;
- goals;
- assigned programmes;
- workout history;
- bookings;
- bundle/session-credit balance;
- check-ins where enabled;
- completion and change alerts.

The client list must support:

- search;
- active/paused/former filters;
- online/in-person filters;
- needs-attention filtering;
- upcoming booking filtering;
- overdue or failed payment filtering;
- recent workout activity.

## 4. PT-created goals

- Goals are agreed between the PT and client, then created and managed by the PT.
- MuscleMetric must not restrict PTs to a fixed list of goal types.
- A goal can be numerical, performance-based, consistency-based, habit-based, assessment-based, subjective or fully custom.
- A goal can contain:
  - title;
  - description;
  - starting position;
  - target;
  - optional unit;
  - optional target date;
  - measurement method;
  - review frequency;
  - milestones;
  - PT notes;
  - status.
- Goals can be edited, paused, completed or replaced without deleting their history.

## 5. Programme and workout creation

### Speed and reuse

PTs must be able to:

- start from blank;
- use a saved programme template;
- duplicate an existing programme;
- copy a previous workout;
- save a workout as a template;
- copy a client setup without copying private client data;
- repeat workouts across future weeks;
- change one client's assignment without changing the original template;
- reactivate a returning client without rebuilding their setup.

The expected workflow is:

**Select template → adjust client-specific details → assign**

### Overall workout prescription

Each workout can include:

- title;
- purpose;
- scheduled day;
- estimated duration;
- warm-up instructions;
- overall workout notes;
- completion instructions.

### Exercise prescription

Each exercise can include:

- sets;
- reps or rep range;
- guideline weight;
- RPE or RIR target;
- tempo;
- rest time;
- technique cues;
- exercise-specific notes;
- alternative exercise;
- progression instructions.

Simple fields should appear first. Less common prescription fields can sit under advanced options.

## 6. Prescribed versus completed workouts

The PT's prescription and the client's completed performance must be stored separately.

- The client first sees the PT's guideline weight, reps and RPE/RIR.
- The client records what they actually completed.
- The prescribed values must remain visible for comparison.
- The client can indicate:
  - too easy;
  - about right;
  - too difficult;
  - could not complete;
  - exercise caused discomfort;
  - substitute exercise used.
- A client change does not silently overwrite the PT's original prescription.

## 7. Coach notifications

- The PT is notified when a client completes a workout.
- A completion notification provides a summary rather than every set.
- The PT can open the notification to inspect the complete workout.
- The PT is alerted when a client changes prescribed values or reports a meaningful issue.
- Important examples include:
  - changed guideline weight;
  - RPE/RIR different from the target;
  - skipped exercise;
  - substituted exercise;
  - inability to complete;
  - reported pain or discomfort;
  - client note.
- The interface must be designed to avoid overwhelming a PT managing 45 clients.

Exact alert thresholds and immediate-versus-digest delivery remain to be validated.

## 8. Configurable online check-ins

- PTs can create their own check-in forms.
- Check-in questions can differ by client.
- Check-ins can be assigned on a repeating schedule.
- Clients can submit responses inside MuscleMetric.
- PTs can review and respond to submissions.
- Check-ins are optional for PTs who do not provide online or hybrid coaching.

## 9. PT-controlled booking availability

- A PT's calendar is unavailable by default.
- Clients can only book times deliberately opened by the PT.
- The PT can open one-off or repeating availability.
- Once booked, a slot is unavailable to other clients.
- The PT can manually create a booking for a client.
- Bookings support different services, durations and locations.
- The PT can block holidays and other unavailable periods.

## 10. Repeat bookings

The booking system must support:

- the same day and time every week;
- fortnightly repetition;
- monthly repetition;
- a fixed number of occurrences;
- booking the next two, three or four sessions;
- changing one occurrence without changing the complete series;
- ending the remaining series.

This reflects the interviewed PTs' common pattern of seeing a client one to four times per month, most often two or three times.

## 11. Bundles and session credits

- PTs can sell single sessions and multi-session bundles.
- Bundles are commonly intended to cover approximately one month.
- A bundle contains:
  - number of sessions;
  - eligible service/session type;
  - session duration;
  - price;
  - validity or expiry;
  - remaining credits.
- Booking an eligible session consumes a credit.
- PTs and clients can see the remaining credit balance.
- PTs can create individually priced arrangements where required.
- Repeat clients can purchase another bundle without repeating onboarding.

## 12. Payment timing and platform fee

### Confirmed commercial direction

- MuscleMetric charges a **1% platform fee on each paid client session booking**.
- The fee must be recorded transparently against the booking/payment.
- PT earnings, platform fee and payment status must be separately visible.
- The system must support taking payment 24 hours before an in-person session and holding it pending the session outcome.
- Bundle-credit bookings must retain a clear financial and credit audit trail.

### Still to define before implementation

- who absorbs third-party card-processing fees;
- exact payout timing;
- refund and late-cancellation rules;
- failed-payment behaviour;
- no-show disputes;
- PT cancellation rules;
- whether “holding” means captured funds held pending or a card authorisation;
- taxes and invoices.

These are payment-state and policy decisions, not reasons to change the confirmed 1% platform-fee direction.

## 13. Administration requirements

The feature is successful only if it reduces repetitive PT work.

The product must prioritise:

- sensible defaults;
- reusable questionnaire templates;
- reusable programme and workout templates;
- duplication;
- recurring bookings;
- returning-client reactivation;
- bulk and multi-week editing where safe;
- autosave;
- clear client status;
- a dashboard showing only clients who need attention.

## Initial delivery order

1. Coach identity, workspace and permissions.
2. Coach–client invitation and custom onboarding questionnaires.
3. Scalable client list and client detail.
4. PT-created goals.
5. Programme/workout templates and client assignments.
6. Prescribed-versus-completed workout logging.
7. Workout completion and change notifications.
8. PT-controlled availability and bookings.
9. Repeat bookings.
10. Bundles and session credits.
11. Payment states and the 1% platform fee.
12. Configurable online check-ins.

## Explicitly not locked yet

The interviews have not yet fixed:

- payment processor and processing-fee allocation;
- exact refund, cancellation and dispute rules;
- notification thresholds and digest frequency;
- full online-coaching scope beyond configurable check-ins;
- MuscleMetric Coach subscription pricing, if any;
- group-session requirements;
- calendar integrations;
- marketplace/discovery features;
- tax and invoicing requirements.

These require further validation or technical/payment research before they become committed scope.
