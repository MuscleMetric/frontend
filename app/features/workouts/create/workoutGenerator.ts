// app/features/workouts/create/workoutGenerator.ts
//
// PHASE 1 – Clean, schema-aware generator
// ---------------------------------------
// ✅ Uses session length → # of exercises (30 → 4, 45 → 5, 60 → 6)
// ✅ Uses v_exercises_compact for type, popularity, primary_muscle
// ✅ Joins in exercises.equipment + exercises.level + exercises.is_compound
// ✅ Filters by selected focus areas (if any)
// ✅ Filters by home equipment when location === "home"
// ✅ Filters by exercise level vs user level
// ✅ "get_stronger" has custom logic:
//    - Enforces compound/accessory split per duration
//    - Ensures all selected muscles are represented
//    - Compound lifts displayed first
//    - Strength-specific workout + exercise notes.
//
// TODO – Next phases
// ------------------
// - Make each non-strength goal behave differently (exercise bias, volume targets, rep schemes).
// - Add real cardio logic for "improve_endurance" using cardioTypes.
// - More advanced strength logic: balance push/pull/legs, barbell vs machines, etc.
// - Better fallback UX when filters are too strict (surface a message in the UI).

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

/** Raw exercise after merging v_exercises_compact + exercises.{equipment,level,is_compound} */
export type GeneratorExercise = {
  id: string;
  name: string;
  type: string | null; // e.g. "strength"
  popularity: number | null;
  primary_muscle: string | null; // from v_exercises_compact
  equipment: string | null; // from exercises.equipment
  level: TrainingLevel | null; // from exercises.level
  is_compound: boolean | null; // from exercises.is_compound
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
  sessionLengthMin: number; // 30 / 45 / 60 from the UI
  focusAreas: FocusArea[];
  homeEquipment: HomeEquipment[];
  cardioTypes: CardioType[]; // TODO: used later for endurance-specific logic
};

/* ---------- Public API ---------- */

export async function generateWorkout(
  params: GenerateWorkoutParams
): Promise<GeneratedWorkout> {
  // 1) Fetch a pool of candidate exercises from the DB
  const candidates = await fetchCandidateExercises();

  // 2) Apply level + focus + equipment filters
  const filtered = filterExercisesForParams(params, candidates);

  // 3) Goal-specific builders
  switch (params.primaryGoal) {
    case "build_muscle":
      return buildWorkoutFromPool({
        params,
        pool: filtered,
        titlePrefix: "Build Muscle",
        globalNotes:
          "Focus on controlled reps, full range of motion, and progressive overload. Aim to leave 1–3 good reps in the tank on most sets.",
      });

    case "lose_fat":
      return buildWorkoutFromPool({
        params,
        pool: filtered,
        titlePrefix: "Lose Fat",
        globalNotes:
          "Keep your rest periods on the shorter side and maintain a steady pace. You should feel challenged but able to sustain the session.",
      });

    case "get_stronger":
      // Strength-specific composition (compounds vs non-compounds),
      // with coverage of all selected focus areas &
      // compounds ordered first, plus strength notes.
      return buildStrengthWorkout(filtered, params);

    case "improve_endurance":
      // TODO (Phase 2): use cardioTypes and build real cardio / conditioning workouts.
      // For now, reuse the generic builder so the feature works.
      return buildWorkoutFromPool({
        params,
        pool: filtered,
        titlePrefix: "Improve Endurance",
        globalNotes:
          "Move at a sustainable pace and focus on consistent effort across the session. You should finish feeling worked, not destroyed.",
      });

    default:
      return buildWorkoutFromPool({
        params,
        pool: filtered,
        titlePrefix: "Workout",
        globalNotes:
          "Train with intent, keep your technique tight, and adjust weight so the last few reps are challenging but controlled.",
      });
  }
}

/* ---------- 1. Fetch candidates (view + equipment + level + is_compound) ---------- */

/**
 * We:
 * 1) Pull from v_exercises_compact: id, name, type, popularity, primary_muscle
 * 2) Pull equipment + level + is_compound from exercises for those ids
 * 3) Merge into a single GeneratorExercise[]
 */
async function fetchCandidateExercises(): Promise<GeneratorExercise[]> {
  // STEP 1: base exercise info from your compact view
  const { data: base, error: baseError } = await supabase
    .from("v_exercises_compact")
    .select("id,name,type,popularity,primary_muscle")
    .limit(500);

  if (baseError || !base) {
    console.warn("generateWorkout: failed to fetch from v_exercises_compact", {
      error: baseError,
    });
    return [];
  }

  const ids = base.map((row: any) => row.id);
  if (ids.length === 0) return [];

  // STEP 2: fetch equipment + level + is_compound from exercises table for those ids
  const { data: equipRows, error: equipError } = await supabase
    .from("exercises")
    .select("id,equipment,level,is_compound")
    .in("id", ids);

  if (equipError) {
    console.warn(
      "generateWorkout: failed to fetch equipment/level/is_compound from exercises",
      { error: equipError }
    );
  }

  const equipmentById = new Map<string, string | null>();
  const levelById = new Map<string, TrainingLevel | null>();
  const isCompoundById = new Map<string, boolean | null>();

  (equipRows ?? []).forEach((row: any) => {
    equipmentById.set(row.id, row.equipment ?? null);

    const lvl = (row.level ?? null) as TrainingLevel | null;
    levelById.set(row.id, lvl);

    const ic =
      typeof row.is_compound === "boolean" ? row.is_compound : null;
    isCompoundById.set(row.id, ic);
  });

  // STEP 3: merge into GeneratorExercise objects
  const merged: GeneratorExercise[] = base.map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type ?? null,
    popularity: row.popularity ?? null,
    primary_muscle: row.primary_muscle ?? null,
    equipment: equipmentById.get(row.id) ?? null,
    level: levelById.get(row.id) ?? null,
    is_compound: isCompoundById.get(row.id) ?? null,
  }));

  return merged;
}

/* ---------- 2. Filtering by level + focus + equipment ---------- */

/**
 * Filters by:
 * - exercise level vs user level
 * - type: currently "strength" only
 * - focus areas (if any are selected)
 * - equipment restrictions for home workouts
 */
function filterExercisesForParams(
  params: GenerateWorkoutParams,
  all: GeneratorExercise[]
): GeneratorExercise[] {
  const { focusAreas, location, homeEquipment, level: userLevel } = params;

  let filtered = all.filter((e) => {
    // Only strength-type exercises for now.
    if (!e.type || e.type.toLowerCase() !== "strength") return false;
    if (!e.name) return false;

    // Level gate.
    if (!exerciseAllowedForLevel(e.level, userLevel)) return false;

    return true;
  });

  // --- Muscle focus filter (uses primary_muscle) ---
  if (focusAreas.length > 0) {
    filtered = filtered.filter((e) => exerciseMatchesAnyFocus(e, focusAreas));
  }

  // --- Equipment filter for home workouts ---
  if (location === "home") {
    const hasEquipmentPrefs = homeEquipment.length > 0;
    const selectedEquip = homeEquipment.map((e) => e.toLowerCase());

    filtered = filtered.filter((e) => {
      const eq = (e.equipment ?? "").toLowerCase().trim();

      if (!eq) {
        if (!hasEquipmentPrefs) return true;
        return selectedEquip.includes("bodyweight");
      }

      // naive mapping: assumes equipment strings roughly match these keys
      return selectedEquip.some((key) => {
        return eq.includes(key.replace("_", " "));
      });
    });
  }

  // For gym / both we keep all equipment.

  // Sort by popularity DESC by default (so "better" exercises are picked first)
  filtered.sort((a, b) => {
    const pa = a.popularity ?? 0;
    const pb = b.popularity ?? 0;
    return pb - pa;
  });

  return filtered;
}

/**
 * Beginner: only beginner exercises
 * Intermediate: beginner + intermediate
 * Advanced: all levels
 */
function exerciseAllowedForLevel(
  exerciseLevel: TrainingLevel | null,
  userLevel: TrainingLevel
): boolean {
  if (!exerciseLevel) {
    // If level is missing, be conservative: only allow it for intermediate/advanced
    return userLevel !== "beginner";
  }

  if (userLevel === "beginner") {
    return exerciseLevel === "beginner";
  }

  if (userLevel === "intermediate") {
    return exerciseLevel === "beginner" || exerciseLevel === "intermediate";
  }

  // advanced
  return true;
}

/**
 * Shared helper used for:
 * - filtering by selected focus areas
 * - ensuring each selected muscle is represented in strength workouts
 */
function exerciseMatchesAnyFocus(
  e: GeneratorExercise,
  focusAreas: FocusArea[]
): boolean {
  const pm = e.primary_muscle?.toLowerCase() ?? "";
  if (!pm) return false;
  const faLower = focusAreas.map((f) => f.toLowerCase());

  return faLower.some((area) => exerciseMatchesFocusArea(pm, area));
}

function exerciseMatchesFocusArea(
  primaryMuscleLower: string,
  areaLower: string
): boolean {
  switch (areaLower) {
    case "chest":
    case "back":
    case "shoulders":
    case "biceps":
    case "triceps":
      return primaryMuscleLower.includes(areaLower);
    case "core":
      return (
        primaryMuscleLower.includes("core") ||
        primaryMuscleLower.includes("abs") ||
        primaryMuscleLower.includes("abdom")
      );
    case "glutes":
    case "legs":
      return (
        primaryMuscleLower.includes("glute") ||
        primaryMuscleLower.includes("quad") ||
        primaryMuscleLower.includes("ham") ||
        primaryMuscleLower.includes("calf") ||
        primaryMuscleLower.includes("leg")
      );
    default:
      return false;
  }
}

/* ---------- 3A. Core generic builder (for non-strength goals) ---------- */

type BuildWorkoutOptions = {
  params: GenerateWorkoutParams;
  pool: GeneratorExercise[];
  titlePrefix: string;
  globalNotes: string;
};

function buildWorkoutFromPool({
  params,
  pool,
  titlePrefix,
  globalNotes,
}: BuildWorkoutOptions): GeneratedWorkout {
  const { sessionLengthMin, focusAreas, primaryGoal, location } = params;

  const targetCount = getTargetExerciseCount(sessionLengthMin);

  if (pool.length === 0) {
    return {
      title: buildGoalTitle(primaryGoal, focusAreas, titlePrefix),
      estimated_duration_min: sessionLengthMin,
      goal: primaryGoal,
      location,
      exercises: [],
      notes:
        "No suitable exercises were found for your current focus, level, and equipment settings. Try adjusting your focus areas or home equipment options.",
    };
  }

  const actualCount = Math.min(targetCount, pool.length);
  const chosen = pool.slice(0, actualCount);

  const exercises: GeneratedWorkoutExercise[] = chosen.map((e, index) => ({
    exercise_id: e.id,
    name: e.name,
    order_index: index,
  }));

  const title = buildGoalTitle(primaryGoal, focusAreas, titlePrefix);

  return {
    title,
    estimated_duration_min: sessionLengthMin,
    goal: primaryGoal,
    location,
    exercises,
    notes: globalNotes,
  };
}

/* ---------- 3B. Strength-specific builder (compound vs non-compound) ---------- */

/**
 * Strength goal notes (global workout + per-exercise).
 */
const STRENGTH_WORKOUT_NOTES =
  "Warm up, get blood flowing and ensure muscles you are intending to train are ready for strenuous exercise. The aim for the workout is to get as close to failure as you can.";

const STRENGTH_COMPOUND_EXERCISE_NOTES =
  "3–5 sets with an aim of 3–6 reps. Ensure form is good throughout.";

const STRENGTH_ACCESSORY_EXERCISE_NOTES =
  "3–4 sets with an aim of 5–8 reps. Focus on getting a good mind–muscle connection.";

/**
 * For "get_stronger" we aim for:
 *
 * - 30 mins → 2 compound + 2 accessory
 * - 45 mins → 3 compound + 2 accessory
 * - 60 mins → 3 compound + 3 accessory
 *
 * plus:
 * - All selected focus muscles are represented at least once if possible.
 * - Compound lifts are shown first in the workout.
 * - Title is: "<Goal> – <Selected Muscles>", e.g. "Get Stronger – Chest, Back & Biceps".
 * - Exercises have strength-specific notes (compounds vs accessories).
 */
function buildStrengthWorkout(
  pool: GeneratorExercise[],
  params: GenerateWorkoutParams
): GeneratedWorkout {
  const { sessionLengthMin, focusAreas, primaryGoal, location } = params;

  const targetCount = getTargetExerciseCount(sessionLengthMin);
  const { compoundTarget, accessoryTarget } =
    getStrengthCompoundAccessoryTargets(sessionLengthMin);

  if (pool.length === 0) {
    return {
      title: buildGoalTitle(primaryGoal, focusAreas),
      estimated_duration_min: sessionLengthMin,
      goal: primaryGoal,
      location,
      exercises: [],
      notes:
        "No suitable strength exercises were found for your current focus, level, and equipment settings. Try adjusting your focus areas or home equipment options.",
    };
  }

  const compounds = pool.filter((e) => e.is_compound === true);
  const accessories = pool.filter(
    (e) => e.is_compound === false || e.is_compound === null
  );

  const chosen: GeneratorExercise[] = [];
  const usedIds = new Set<string>();

  // --- Step 1: ensure each selected focus area is represented at least once ---
  if (focusAreas.length > 0) {
    for (const area of focusAreas) {
      const areaLower = area.toLowerCase();
      const candidate = pool.find(
        (e) =>
          !usedIds.has(e.id) &&
          exerciseMatchesFocusArea(
            (e.primary_muscle ?? "").toLowerCase(),
            areaLower
          )
      );
      if (candidate) {
        chosen.push(candidate);
        usedIds.add(candidate.id);
      }
    }
  }

  // Count current composition from coverage step
  let currentCompoundCount = chosen.filter((e) => e.is_compound === true).length;
  let currentAccessoryCount = chosen.length - currentCompoundCount;

  let needCompounds = Math.max(0, compoundTarget - currentCompoundCount);
  let needAccessories = Math.max(0, accessoryTarget - currentAccessoryCount);

  // --- Step 2: top up compounds to reach target where possible ---
  for (const e of compounds) {
    if (chosen.length >= targetCount) break;
    if (needCompounds <= 0) break;
    if (usedIds.has(e.id)) continue;

    chosen.push(e);
    usedIds.add(e.id);
    needCompounds--;
    currentCompoundCount++;
  }

  // --- Step 3: top up accessories to reach target where possible ---
  for (const e of accessories) {
    if (chosen.length >= targetCount) break;
    if (needAccessories <= 0) break;
    if (usedIds.has(e.id)) continue;

    chosen.push(e);
    usedIds.add(e.id);
    needAccessories--;
    currentAccessoryCount++;
  }

  // --- Step 4: if still short, fill from the remaining pool (any type) ---
  if (chosen.length < targetCount) {
    for (const e of pool) {
      if (chosen.length >= targetCount) break;
      if (usedIds.has(e.id)) continue;
      chosen.push(e);
      usedIds.add(e.id);
    }
  }

  // --- Step 5: order so compounds are displayed first ---
  const ordered: GeneratorExercise[] = [
    ...chosen.filter((e) => e.is_compound === true),
    ...chosen.filter((e) => e.is_compound !== true),
  ];

  const exercises: GeneratedWorkoutExercise[] = ordered.map((e, index) => ({
    exercise_id: e.id,
    name: e.name,
    order_index: index,
    notes:
      e.is_compound === true
        ? STRENGTH_COMPOUND_EXERCISE_NOTES
        : STRENGTH_ACCESSORY_EXERCISE_NOTES,
  }));

  const title = buildGoalTitle(primaryGoal, focusAreas);

  return {
    title,
    estimated_duration_min: sessionLengthMin,
    goal: primaryGoal,
    location,
    exercises,
    notes: STRENGTH_WORKOUT_NOTES,
  };
}

/* ---------- Session length helpers ---------- */

/**
 * Maps session length → total number of exercises.
 * 30 mins → 4 exercises
 * 45 mins → 5 exercises
 * 60 mins → 6 exercises
 */
function getTargetExerciseCount(sessionLengthMin: number): number {
  if (sessionLengthMin <= 30) return 4;
  if (sessionLengthMin <= 45) return 5;
  return 6;
}

/**
 * Strength-specific target split for compound vs accessory.
 *
 * 30 mins → 2 compound / 2 accessory
 * 45 mins → 3 compound / 2 accessory
 * 60 mins → 3 compound / 3 accessory
 */
function getStrengthCompoundAccessoryTargets(sessionLengthMin: number): {
  compoundTarget: number;
  accessoryTarget: number;
} {
  if (sessionLengthMin <= 30) {
    return { compoundTarget: 2, accessoryTarget: 2 };
  }
  if (sessionLengthMin <= 45) {
    return { compoundTarget: 3, accessoryTarget: 2 };
  }
  return { compoundTarget: 3, accessoryTarget: 3 };
}

/* ---------- Title + formatting helpers ---------- */

function prettyGoal(goal: WorkoutGoal): string {
  switch (goal) {
    case "build_muscle":
      return "Build Muscle";
    case "lose_fat":
      return "Lose Fat";
    case "get_stronger":
      return "Get Stronger";
    case "improve_endurance":
      return "Improve Endurance";
    default:
      return "Workout";
  }
}

function formatFocusList(focus: FocusArea[]): string {
  if (focus.length === 0) return "";
  const pretty = focus.map(capitalize);
  if (pretty.length === 1) return pretty[0];
  if (pretty.length === 2) return `${pretty[0]} & ${pretty[1]}`;
  return `${pretty.slice(0, -1).join(", ")} & ${
    pretty[pretty.length - 1]
  }`;
}

/**
 * Goal-driven workout title:
 * e.g. "Get Stronger – Chest & Back" or "Build Muscle – Chest, Shoulders & Triceps"
 */
function buildGoalTitle(
  goal: WorkoutGoal,
  focus: FocusArea[],
  overridePrefix?: string
): string {
  const base = overridePrefix ?? prettyGoal(goal);
  const focusStr = formatFocusList(focus);
  if (!focusStr) return `${base} Workout`;
  return `${base} – ${focusStr}`;
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
