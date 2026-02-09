import type { ErrorMap, OnboardingDraft } from "./types";

const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

export function calcAge(d: Date) {
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Step-based validation
 *
 * stepIndex:
 * 0 = About You
 * 1 = Body Metrics
 * 2 = Training Profile
 * 3 = Consistency
 */
export function validateStep(
  draft: OnboardingDraft,
  stepIndex: number
): ErrorMap {
  const errors: ErrorMap = {};

  // ─────────────────────────────
  // STEP 0 — ABOUT YOU
  // ─────────────────────────────
  if (stepIndex >= 0) {
    if (!draft.fullName.trim()) {
      errors.fullName = "Add your full name";
    }

    if (!draft.dob) {
      errors.dob = "Select your date of birth";
    } else {
      const age = calcAge(draft.dob);
      if (age < 13) {
        errors.dob = "You must be at least 13 years old";
      }
    }

    if (!draft.gender) {
      errors.gender = "Select a gender";
    }
  }

  // ─────────────────────────────
  // STEP 1 — BODY METRICS
  // ─────────────────────────────
  if (stepIndex >= 1) {
    if (
      draft.heightCm == null ||
      !Number.isFinite(draft.heightCm)
    ) {
      errors.height = "Enter your height";
    } else if (
      draft.heightCm < MIN_HEIGHT_CM ||
      draft.heightCm > MAX_HEIGHT_CM
    ) {
      errors.height = `Height must be ${MIN_HEIGHT_CM}–${MAX_HEIGHT_CM}cm`;
    }

    if (
      draft.weightKg == null ||
      !Number.isFinite(draft.weightKg)
    ) {
      errors.weight = "Enter your weight";
    } else if (
      draft.weightKg < MIN_WEIGHT_KG ||
      draft.weightKg > MAX_WEIGHT_KG
    ) {
      errors.weight = `Weight must be ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG}kg`;
    }
  }

  // ─────────────────────────────
  // STEP 2 — TRAINING PROFILE
  // ─────────────────────────────
  if (stepIndex >= 2) {
    if (!draft.level) {
      errors.level = "Select a fitness level";
    }

    if (!draft.primaryGoal) {
      errors.primaryGoal = "Select a primary goal";
    }
  }

  // ─────────────────────────────
  // STEP 3 — CONSISTENCY
  // ─────────────────────────────
  if (stepIndex >= 3) {
    if (
      !draft.workoutsPerWeek ||
      draft.workoutsPerWeek < 1 ||
      draft.workoutsPerWeek > 7
    ) {
      errors.workoutsPerWeek = "Pick 1–7 workouts per week";
    }

    if (
      draft.stepsGoal == null ||
      !Number.isFinite(draft.stepsGoal) ||
      draft.stepsGoal < 0
    ) {
      errors.stepsGoal = "Steps goal must be 0 or more";
    }
  }

  return errors;
}

export function hasErrors(errors: ErrorMap) {
  return Object.keys(errors).length > 0;
}
