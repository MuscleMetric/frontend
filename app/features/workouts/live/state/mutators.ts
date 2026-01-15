import type { LiveWorkoutDraft, LiveSetDraft } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function openExercise(d: LiveWorkoutDraft, exerciseIndex: number): LiveWorkoutDraft {
  const idx = clamp(exerciseIndex, 0, d.exercises.length - 1);
  return {
    ...d,
    ui: { ...d.ui, activeExerciseIndex: idx, activeSetNumber: 1 },
    updatedAt: nowIso(),
  };
}

export function setActiveSetNumber(d: LiveWorkoutDraft, setNumber: number): LiveWorkoutDraft {
  const { activeExerciseIndex } = d.ui;
  const ex = d.exercises[activeExerciseIndex];
  const maxSet = ex?.sets?.length ?? 1;

  return {
    ...d,
    ui: { ...d.ui, activeSetNumber: clamp(setNumber, 1, maxSet) },
    updatedAt: nowIso(),
  };
}

export function updateSetValue(d: LiveWorkoutDraft, args: {
  exerciseIndex: number;
  setNumber: number;
  field: "reps" | "weight" | "timeSeconds" | "distance";
  value: number | null;
}): LiveWorkoutDraft {
  const ex = d.exercises[args.exerciseIndex];
  if (!ex) return d;

  const nextSets = ex.sets.map((s) =>
    s.setNumber === args.setNumber ? { ...s, [args.field]: args.value } : s
  );

  const nextExercises = d.exercises.slice();
  nextExercises[args.exerciseIndex] = { ...ex, sets: nextSets };

  return { ...d, exercises: nextExercises, updatedAt: nowIso() };
}

export function addSet(d: LiveWorkoutDraft, exerciseIndex: number): LiveWorkoutDraft {
  const ex = d.exercises[exerciseIndex];
  if (!ex) return d;

  const lastSetNum = ex.sets.length ? ex.sets[ex.sets.length - 1].setNumber : 0;
  const nextSetNumber = Math.min(20, lastSetNum + 1);

  const newSet: LiveSetDraft = {
    setNumber: nextSetNumber,
    dropIndex: 0,
    reps: null,
    weight: null,
    timeSeconds: null,
    distance: null,
    notes: null,
  };

  const nextExercises = d.exercises.slice();
  nextExercises[exerciseIndex] = { ...ex, sets: [...ex.sets, newSet] };

  // keep UI within range if we're editing this exercise
  const ui =
    d.ui.activeExerciseIndex === exerciseIndex
      ? { ...d.ui, activeSetNumber: clamp(d.ui.activeSetNumber, 1, nextExercises[exerciseIndex].sets.length) }
      : d.ui;

  return { ...d, exercises: nextExercises, ui, updatedAt: nowIso() };
}

export function removeSet(d: LiveWorkoutDraft, exerciseIndex: number): LiveWorkoutDraft {
  const ex = d.exercises[exerciseIndex];
  if (!ex) return d;
  if (ex.sets.length <= 1) return d;

  const nextExercises = d.exercises.slice();
  nextExercises[exerciseIndex] = { ...ex, sets: ex.sets.slice(0, -1) };

  const ui =
    d.ui.activeExerciseIndex === exerciseIndex
      ? { ...d.ui, activeSetNumber: Math.min(d.ui.activeSetNumber, nextExercises[exerciseIndex].sets.length) }
      : d.ui;

  return { ...d, exercises: nextExercises, ui, updatedAt: nowIso() };
}

export function goPrevSet(d: LiveWorkoutDraft): LiveWorkoutDraft {
  return setActiveSetNumber(d, d.ui.activeSetNumber - 1);
}

export function goNextSet(d: LiveWorkoutDraft): LiveWorkoutDraft {
  return setActiveSetNumber(d, d.ui.activeSetNumber + 1);
}
