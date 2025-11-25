// app/features/workouts/create/workoutGenerator.ts
import { supabase } from "../../../../lib/supabase";

/* ---------- Types shared with the UI ---------- */

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type WorkoutGoal =
  | "build_muscle"
  | "lose_fat"
  | "get_stronger"
  | "improve_endurance";

export type WorkoutLocation = "home" | "gym" | "both";

export type FocusArea =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "glutes"
  | "core";

export type HomeEquipment =
  | "bodyweight"
  | "dumbbells"
  | "kettlebell"
  | "resistance_bands"
  | "pullup_bar"
  | "bench";

export type CardioType =
  | "running"
  | "cycling"
  | "rowing"
  | "skipping"
  | "hiit_circuits";

/** Raw exercise coming back from your view/table */
export type GeneratorExercise = {
  id: string;
  name: string;
  type: string | null;
  primary_muscle: string | null;
};

export type GeneratedWorkoutExercise = {
  exercise_id: string;
  name: string;
  order_index: number;
  notes?: string | null;
};

export type GeneratedWorkout = {
  title: string;
  estimated_duration_min: number;
  goal: WorkoutGoal;
  location: WorkoutLocation;
  exercises: GeneratedWorkoutExercise[];
  /** High-level guidance shown at the top of the workout */
  notes?: string | null;
};

export type GenerateWorkoutParams = {
  level: TrainingLevel;
  primaryGoal: WorkoutGoal;
  location: WorkoutLocation;
  sessionLengthMin: number;
  focusAreas: FocusArea[];
  homeEquipment: HomeEquipment[];
  cardioTypes: CardioType[];
};

/* ---------- Public API ---------- */

export async function generateWorkout(
  params: GenerateWorkoutParams
): Promise<GeneratedWorkout> {
  const candidates = await fetchCandidateExercises(params);

  switch (params.primaryGoal) {
    case "build_muscle":
      return generateHypertrophyWorkout(params, candidates);
    case "lose_fat":
      return generateFatLossWorkout(params, candidates);
    case "get_stronger":
      return generateStrengthWorkout(params, candidates);
    case "improve_endurance":
      return generateEnduranceWorkout(params, candidates);
    default:
      return generateHypertrophyWorkout(params, candidates);
  }
}

/* ---------- 1. Fetch candidates (fixed: no is_archived) ---------- */

async function fetchCandidateExercises(
  _params: GenerateWorkoutParams
): Promise<GeneratorExercise[]> {
  // Keep it simple for now – just pull a batch from the compact view
  const { data, error } = await supabase
    .from("v_exercises_compact")
    .select("id,name,type,primary_muscle")
    .limit(200);

  if (error) {
    console.warn("generateWorkout: exercise fetch failed", error);
    return [];
  }

  return (data ?? []) as GeneratorExercise[];
}

/* ---------- 2. Goal Generators (no sets/reps, with notes) ---------- */

function generateHypertrophyWorkout(
  params: GenerateWorkoutParams,
  all: GeneratorExercise[]
): GeneratedWorkout {
  const { level, focusAreas, sessionLengthMin } = params;

  const muscles = focusAreas.length
    ? focusAreas
    : (["chest", "back", "legs"] as FocusArea[]);

  const filtered = all.filter((e) => {
    if (!e.type || !e.primary_muscle) return false;
    if (e.type !== "strength") return false;

    const pm = e.primary_muscle.toLowerCase();

    const matchesFocus = muscles.some((m) => {
      const mLower = m.toLowerCase();
      if (mLower === "legs") {
        return (
          pm.includes("quad") ||
          pm.includes("ham") ||
          pm.includes("glute") ||
          pm.includes("legs")
        );
      }
      return pm.includes(mLower);
    });

    return matchesFocus;
  });

  const targetCount =
    level === "beginner" ? 6 : level === "intermediate" ? 8 : 10;

  const chosen = filtered.slice(0, targetCount);

  const exercises: GeneratedWorkoutExercise[] = chosen.map((e, i) => ({
    exercise_id: e.id,
    name: e.name,
    order_index: i,
    notes: hypertrophyNotes(level),
  }));

  const title = buildTitleFromFocus("Hypertrophy", focusAreas);

  return {
    title,
    estimated_duration_min: sessionLengthMin,
    goal: params.primaryGoal,
    location: params.location,
    exercises,
    notes:
      "Focus on controlled reps and progressive overload. Leave 1–3 reps in reserve on most sets and prioritise good technique.",
  };
}

function generateFatLossWorkout(
  params: GenerateWorkoutParams,
  all: GeneratorExercise[]
): GeneratedWorkout {
  const { level, sessionLengthMin } = params;

  const filtered = all.filter((e) => {
    if (!e.primary_muscle) return false;
    const pm = e.primary_muscle.toLowerCase();
    return (
      pm.includes("quad") ||
      pm.includes("ham") ||
      pm.includes("glute") ||
      pm.includes("back") ||
      pm.includes("chest")
    );
  });

  const targetCount =
    level === "beginner" ? 6 : level === "intermediate" ? 8 : 10;

  const chosen = filtered.slice(0, targetCount);

  const exercises: GeneratedWorkoutExercise[] = chosen.map((e, i) => ({
    exercise_id: e.id,
    name: e.name,
    order_index: i,
    notes: "Keep rest periods short and move at a steady pace.",
  }));

  return {
    title: "Fat-Loss Session",
    estimated_duration_min: sessionLengthMin,
    goal: params.primaryGoal,
    location: params.location,
    exercises,
    notes:
      "This session focuses on big compound movements with short rests to drive energy expenditure. Aim to keep moving and breathe steadily.",
  };
}

function generateStrengthWorkout(
  params: GenerateWorkoutParams,
  all: GeneratorExercise[]
): GeneratedWorkout {
  const { level, focusAreas, sessionLengthMin } = params;

  const muscles = focusAreas.length
    ? focusAreas
    : (["chest", "back", "legs"] as FocusArea[]);

  const filtered = all.filter((e) => {
    if (!e.type || !e.primary_muscle) return false;
    if (e.type !== "strength") return false;

    const pm = e.primary_muscle.toLowerCase();
    const matchesFocus = muscles.some((m) => {
      const mLower = m.toLowerCase();
      if (mLower === "legs") {
        return (
          pm.includes("quad") ||
          pm.includes("ham") ||
          pm.includes("glute") ||
          pm.includes("legs")
        );
      }
      return pm.includes(mLower);
    });

    return matchesFocus;
  });

  const max = level === "beginner" ? 4 : 5;
  const chosen = filtered.slice(0, max);

  const exercises: GeneratedWorkoutExercise[] = chosen.map((e, i) => ({
    exercise_id: e.id,
    name: e.name,
    order_index: i,
    notes: "Lift heavy with full control. Take longer rests between sets.",
  }));

  const title = buildTitleFromFocus("Strength", focusAreas);

  return {
    title,
    estimated_duration_min: sessionLengthMin,
    goal: params.primaryGoal,
    location: params.location,
    exercises,
    notes:
      "Prioritise heavy, compound lifts. Rest 2–3 minutes between hard sets and focus on tight technique and bar speed.",
  };
}

function generateEnduranceWorkout(
  params: GenerateWorkoutParams,
  _all: GeneratorExercise[]
): GeneratedWorkout {
  const { cardioTypes, sessionLengthMin, level, location } = params;

  const types = cardioTypes.length
    ? cardioTypes
    : (["running"] as CardioType[]);

  const blockLength =
    level === "beginner" ? 8 : level === "intermediate" ? 10 : 12;

  const total = sessionLengthMin || 30;
  const blocksCount = Math.max(1, Math.round(total / blockLength));

  const exercises: GeneratedWorkoutExercise[] = [];

  for (let i = 0; i < blocksCount; i++) {
    const t = types[i % types.length];

    exercises.push({
      exercise_id: `cardio-${t}-${i}`,
      name: cardioLabel(t, location),
      order_index: i,
      notes:
        level === "beginner"
          ? "Stay at an easy pace where you can hold a conversation."
          : level === "intermediate"
          ? "Alternate easy and moderate pace within the block."
          : "Include short pushes above normal pace with easier recovery periods.",
    });
  }

  return {
    title: "Endurance Session",
    estimated_duration_min: total,
    goal: params.primaryGoal,
    location: params.location,
    exercises,
    notes:
      "Aim for a smooth, sustainable effort. You should feel challenged but not destroyed — finish feeling like you could do a bit more.",
  };
}

/* ---------- Helpers ---------- */

function buildTitleFromFocus(prefix: string, focus: FocusArea[]): string {
  if (!focus.length) return `${prefix} Workout`;
  if (focus.length === 1) return `${prefix} – ${capitalize(focus[0])}`;
  if (focus.length === 2)
    return `${prefix} – ${capitalize(focus[0])} & ${capitalize(focus[1])}`;
  return `${prefix} – Full Body`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hypertrophyNotes(level: TrainingLevel) {
  switch (level) {
    case "beginner":
      return "Practice technique and control. Don’t chase failure yet.";
    case "intermediate":
      return "Work close to technical failure while keeping form tight.";
    case "advanced":
      return "Push hard but keep 1–2 good reps in the tank on big lifts.";
    default:
      return "Focus on controlled reps and progressive overload.";
  }
}

function cardioLabel(type: CardioType, location: WorkoutLocation): string {
  const locPrefix =
    location === "home" ? "Home" : location === "gym" ? "Gym" : "Cardio";

  switch (type) {
    case "running":
      return `${locPrefix} Running / Jogging`;
    case "cycling":
      return `${locPrefix} Cycling`;
    case "rowing":
      return `${locPrefix} Rowing`;
    case "skipping":
      return `${locPrefix} Skipping Rope`;
    case "hiit_circuits":
      return `${locPrefix} HIIT Circuits`;
    default:
      return "Cardio Block";
  }
}
