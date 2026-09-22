# MuscleMetrics Prediction Engine

> Status: PLANNED / R&D. This document records agreed direction; it does not claim the readiness/fatigue recommendation system is live.

## Objective
Use a user's own training history plus same-day readiness to estimate current strength capacity and recommend an appropriate working weight. The system should become more personalised as prediction-vs-actual data accumulates.

## Agreed build order
1. Store readiness form.
2. Calculate systemic fatigue.
3. Calculate muscle fatigue by muscle.
4. Predict today's e1RM.
5. Recommend working weight.
6. Store prediction vs actual.
7. Show prediction accuracy.
8. Train user coefficients after enough data.

Do not jump directly to adaptive coefficients before the earlier stages are observable and testable.

## Existing foundation
The app already records:
- completed workout timestamps;
- exercise identity;
- set weight and reps;
- time/distance for relevant exercise types;
- exercise-to-muscle contribution mappings;
- progress/deep-analytics e1RM-related data.

This provides historical training signal but not the full readiness signal.

## Readiness inputs
The final form is not yet frozen. Previously identified high-value factors include:
- sleep;
- nutrition/pre-workout food;
- subjective energy/readiness;
- recent training load/fatigue.

Inputs must be answerable by a normal user without requiring a wearable. Where health-platform data is eventually available, it should reduce manual entry rather than make the feature unusable without a device.

## Systemic fatigue
Systemic fatigue represents whole-body/recovery load rather than fatigue of one muscle. The exact formula and decay coefficients are **not yet approved** and must be validated before being treated as product truth.

## Muscle fatigue
Use exercise-to-muscle contribution as part of a per-muscle load model. The current database supports contribution values from 0–100. Exact load and recovery equations remain to be specified/tested.

## e1RM baseline
Prediction should combine:
- historical exercise performance;
- recent performance with greater relevance than stale history;
- same-day readiness/fatigue adjustment.

The current deep analytics system already exposes e1RM values. The readiness engine should not silently introduce a contradictory e1RM definition; formula choice must be explicit and shared/documented.

## Working-weight recommendation
A recommendation must explain enough context to be useful:
- recommended load;
- intended rep/effort context;
- why today's recommendation differs from baseline where applicable;
- confidence/insufficient-data state.

Avoid false precision.

## Prediction vs actual
Persist the pre-session prediction separately from the observed session outcome. Never recompute old predictions using future coefficients, otherwise accuracy history becomes misleading.

Suggested conceptual fields (not approved schema):
- user/exercise/session reference;
- generated timestamp;
- baseline e1RM;
- predicted e1RM;
- recommended load;
- readiness/fatigue inputs or versioned feature snapshot;
- model/formula version;
- observed result;
- prediction error.

## Accuracy
Accuracy should be shown only when the metric is statistically meaningful. The UI should distinguish insufficient data from poor accuracy.

## Personal coefficients
Personalisation comes last. Coefficients should only adapt after enough observations and must be bounded/versioned to avoid unstable recommendations. Exact minimum sample size and learning method are still open decisions.

## Safety/product constraints
- This is a training recommendation, not a medical assessment.
- Do not diagnose recovery, injury or health conditions.
- Make uncertainty visible.
- Users can always choose a different load.
- Avoid increasing load solely to satisfy a prediction.

## Open decisions
- Exact e1RM formula shared across analytics/prediction.
- Readiness question set and scoring.
- Fatigue decay functions.
- Minimum observations for personalised coefficients.
- Confidence calculation.
- Apple Health data scope and permissions.
