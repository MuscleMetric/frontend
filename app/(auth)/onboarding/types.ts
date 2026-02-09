export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "build_muscle" | "lose_fat" | "get_stronger" | "improve_endurance";
export type Gender = "male" | "female" | "other";

export type UnitWeight = "kg" | "lb";
export type UnitHeight = "cm" | "ft";

export type OnboardingDraft = {
  // about you
  fullName: string;
  email: string;
  dob: Date | null;
  gender: Gender | null;

  // metrics (store canonical values in cm/kg)
  heightCm: number | null;
  weightKg: number | null;
  unitHeight: UnitHeight;
  unitWeight: UnitWeight;

  // training profile
  level: Level;
  primaryGoal: Goal;

  // consistency
  workoutsPerWeek: number; // 1..7
  stepsGoal: number; // >= 0
};

export type ErrorMap = Partial<Record<
  | "fullName"
  | "dob"
  | "gender"
  | "height"
  | "weight"
  | "level"
  | "primaryGoal"
  | "workoutsPerWeek"
  | "stepsGoal",
  string
>>;
