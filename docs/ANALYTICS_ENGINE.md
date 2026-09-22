# MuscleMetrics Analytics Engine

> Status: LIVE. This document describes the analytics logic currently implemented in the mobile app. Experimental readiness/fatigue prediction work is not an active roadmap commitment.

## Estimated 1RM (e1RM)
MuscleMetrics uses the **Epley formula**:

```text
e1RM = weight × (1 + reps / 30)
```

The implementation validates that weight and reps are finite and greater than zero. The product explanation states that the estimate is best used for normal strength sets between **1 and 15 reps**.

e1RM is used throughout Deep Analytics, including strength-over-time and weight-vs-reps views. New analytics should reuse the same definition rather than introducing a second e1RM formula silently.

## Strength trend
For a series of e1RM values:
- fewer than 3 values produces a flat trend;
- first-to-last change greater than +2% is `up`;
- less than -2% is `down`;
- otherwise it is `flat`.

The insight layer requires at least 3 e1RM observations before showing a strength trend summary.

## Confidence
Strength insight confidence is based on both sample count and variability.

1. Fewer than 3 series points -> **low**.
2. 3–5 points -> **medium**.
3. 6+ points -> calculate relative noise.
4. Relative noise = sample standard deviation of e1RM / mean e1RM.
5. If relative noise is greater than 8% -> **medium**.
6. Otherwise -> **high**.

This means high confidence requires both enough observations and reasonably consistent e1RM estimates.

### Volume insight confidence
Volume insights currently use a simpler count rule after the minimum data requirement:
- 3–5 values -> **medium**;
- 6+ values -> **high**.

## Volume
Set volume is calculated as:

```text
volume = weight × reps
```

Volume insights require at least 3 values. A first-to-last change above +10% is described as higher, below -10% as lower, and otherwise as steady.

## Plateau detection
The current helper considers a series plateaued when:
- there are at least `windowSize + 1` values;
- the best value in the recent window does not exceed the best value before that window.

The primary insight currently calls this with a recent window of 4.

This is a product heuristic, not a claim that the athlete is physiologically incapable of progressing.

## Weight vs reps
The Weight vs Reps chart plots logged sets and can draw an Epley-equivalent line for the current estimated 1RM. The line represents weight/rep combinations that produce approximately the same e1RM.

## Insight language
Analytics should describe observed logged-data patterns rather than overstate causation. Prefer language such as:
- "estimated strength trend is higher";
- "logged volume trend is lower";
- "recent estimate is similar".

Do not turn these metrics into medical, recovery or injury assessments.

## Previously explored R&D
MuscleMetrics previously explored a possible readiness/fatigue prediction system using ideas such as:
- a readiness form;
- systemic fatigue;
- per-muscle fatigue;
- daily e1RM prediction;
- recommended working weights;
- prediction-vs-actual learning and personalised coefficients.

That work did **not** become an approved product system and is **not currently on the committed roadmap**. It should not be described as planned functionality unless the product direction is explicitly reopened.

## Development rule
When changing an analytics formula, threshold or confidence rule:
1. update the implementation and tests;
2. update user-facing methodology/explanation where applicable;
3. update this document in the same PR;
4. avoid changing historical interpretation silently when a versioned approach would be more appropriate.
