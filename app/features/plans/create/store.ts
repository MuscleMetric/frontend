// app/features/plans/create/store.ts
import { create, type StateCreator } from "zustand";

export type ExerciseRow = {
  id: string;
  name: string;
  type: "strength" | "cardio" | "mobility" | null;
};

export type WorkoutExercise = {
  exercise: ExerciseRow;
  order_index: number;
  supersetGroup?: string | null;
  isDropset?: boolean;
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | null;
  target_time_seconds?: number | null;
  target_distance?: number | null;
  notes?: string | null;
};

export type WorkoutDraft = {
  title: string;
  notes: string | null;          // ✅ nullable
  exercises: WorkoutExercise[];
};

export type GoalDraft = {
  exercise: ExerciseRow;
  mode: "exercise_weight" | "exercise_reps" | "distance" | "time";
  unit?: string;
  start?: number | null;
  target: number;
};

type PlanDraftState = {
  title: string;
  endDate: string | null; // ISO yyyy-mm-dd
  workoutsPerWeek: number;
  workouts: WorkoutDraft[]; // length must equal workoutsPerWeek
  goals: GoalDraft[];

  reset: () => void;

  setMeta: (
    p: Partial<Pick<PlanDraftState, "title" | "endDate" | "workoutsPerWeek">>
  ) => void;

  initWorkouts: (n: number) => void;
  ensureWorkouts: (n: number) => void;   // ✅ new
  setWorkout: (index: number, w: WorkoutDraft) => void;
  setGoals: (g: GoalDraft[]) => void;
};

const emptyWorkoutDraft = (i: number): WorkoutDraft => ({
  title: `Workout ${i + 1}`,
  notes: null,            // ✅ no default notes
  exercises: [],
});

function normalizeWorkouts(n: number, current: WorkoutDraft[]) {
  const count = Math.max(0, Number(n || 0));
  const cur = Array.isArray(current) ? current : [];

  // trim
  const trimmed = cur.slice(0, count);

  // pad
  const padded = trimmed.slice();
  while (padded.length < count) {
    padded.push(emptyWorkoutDraft(padded.length));
  }

  // re-label placeholders if user never edited them (optional but nice)
  return padded.map((w, idx) => ({
    ...w,
    title: String(w?.title ?? "").trim().length ? w.title : `Workout ${idx + 1}`,
    notes: w?.notes ?? null,
    exercises: Array.isArray(w?.exercises) ? w.exercises : [],
  }));
}

const creator: StateCreator<PlanDraftState> = (set) => ({
  title: "",
  endDate: null,
  workoutsPerWeek: 3,
  workouts: normalizeWorkouts(3, []),
  goals: [],

  reset: () =>
    set(() => ({
      title: "",
      endDate: null,
      workoutsPerWeek: 3,
      workouts: normalizeWorkouts(3, []),
      goals: [],
    })),

  setMeta: (p) =>
    set((s) => {
      const next = { ...s, ...p };

      // ✅ whenever workoutsPerWeek changes, keep workouts aligned
      if (typeof p.workoutsPerWeek === "number") {
        next.workouts = normalizeWorkouts(p.workoutsPerWeek, next.workouts);
      }

      return next;
    }),

  initWorkouts: (n: number) =>
    set((s) => ({
      ...s,
      workoutsPerWeek: n,
      workouts: normalizeWorkouts(n, []),
    })),

  ensureWorkouts: (n: number) =>
    set((s) => ({
      ...s,
      workoutsPerWeek: n,
      workouts: normalizeWorkouts(n, s.workouts),
    })),

  setWorkout: (index: number, w: WorkoutDraft) =>
    set((s) => {
      const arr = s.workouts.slice();
      const safeIndex = Math.max(0, Math.min(index, Math.max(0, arr.length - 1)));

      // If index is beyond current length (shouldn't happen after ensure), pad defensively
      while (arr.length <= index) arr.push(emptyWorkoutDraft(arr.length));

      arr[index] = {
        title: String(w?.title ?? "").trim() ? w.title : `Workout ${index + 1}`,
        notes: w?.notes ?? null,
        exercises: Array.isArray(w?.exercises) ? w.exercises : [],
      };

      return { ...s, workouts: arr };
    }),

  setGoals: (g: GoalDraft[]) => set(() => ({ goals: g })),
});

export const usePlanDraft = create<PlanDraftState>(creator);
