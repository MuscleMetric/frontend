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
  notes: string | null;
  exercises: WorkoutExercise[];
};

export type GoalMetric = "weight" | "reps" | "distance" | "time";

export type GoalDraft = {
  exercise: ExerciseRow;
  metrics: GoalMetric[];

  start_weight: number | null;
  start_reps: number | null;
  start_distance: number | null;
  start_time_seconds: number | null;

  target_weight: number | null;
  target_reps: number | null;
  target_distance: number | null;
  target_time_seconds: number | null;
};

type PlanDraftState = {
  title: string;
  endDate: string | null;
  workoutsPerWeek: number;
  workouts: WorkoutDraft[];
  goals: GoalDraft[];

  reset: () => void;

  setMeta: (
    p: Partial<Pick<PlanDraftState, "title" | "endDate" | "workoutsPerWeek">>,
  ) => void;

  initWorkouts: (n: number) => void;
  ensureWorkouts: (n: number) => void;
  setWorkout: (index: number, w: WorkoutDraft) => void;

  setGoals: (g: GoalDraft[]) => void;
  upsertGoal: (goal: GoalDraft) => void;
  updateGoal: (exerciseId: string, patch: Partial<GoalDraft>) => void;
  removeGoal: (exerciseId: string) => void;
  clearGoalsForRemovedExercises: () => void;
};

export function defaultMetricsForExercise(ex: ExerciseRow): GoalMetric[] {
  if (ex.type === "cardio") return ["distance", "time"];
  if (ex.type === "mobility") return ["time"];
  return ["weight", "reps"];
}

export function createEmptyGoal(ex: ExerciseRow): GoalDraft {
  return {
    exercise: ex,
    metrics: defaultMetricsForExercise(ex),

    start_weight: null,
    start_reps: null,
    start_distance: null,
    start_time_seconds: null,

    target_weight: null,
    target_reps: null,
    target_distance: null,
    target_time_seconds: null,
  };
}

const emptyWorkoutDraft = (i: number): WorkoutDraft => ({
  title: `Workout ${i + 1}`,
  notes: null,
  exercises: [],
});

function normalizeWorkouts(n: number, current: WorkoutDraft[]) {
  const count = Math.max(0, Number(n || 0));
  const cur = Array.isArray(current) ? current : [];

  const trimmed = cur.slice(0, count);
  const padded = trimmed.slice();

  while (padded.length < count) {
    padded.push(emptyWorkoutDraft(padded.length));
  }

  return padded.map((w, idx) => ({
    ...w,
    title: String(w?.title ?? "").trim().length
      ? w.title
      : `Workout ${idx + 1}`,
    notes: w?.notes ?? null,
    exercises: Array.isArray(w?.exercises) ? w.exercises : [],
  }));
}

function goalExerciseExistsInWorkouts(goal: GoalDraft, workouts: WorkoutDraft[]) {
  return workouts.some((w) =>
    w.exercises.some((e) => e.exercise.id === goal.exercise.id),
  );
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

      if (typeof p.workoutsPerWeek === "number") {
        next.workouts = normalizeWorkouts(p.workoutsPerWeek, next.workouts);
        next.goals = next.goals.filter((g) =>
          goalExerciseExistsInWorkouts(g, next.workouts),
        );
      }

      return next;
    }),

  initWorkouts: (n: number) =>
    set((s) => ({
      ...s,
      workoutsPerWeek: n,
      workouts: normalizeWorkouts(n, []),
      goals: [],
    })),

  ensureWorkouts: (n: number) =>
    set((s) => {
      const nextWorkouts = normalizeWorkouts(n, s.workouts);

      return {
        ...s,
        workoutsPerWeek: n,
        workouts: nextWorkouts,
        goals: s.goals.filter((g) =>
          goalExerciseExistsInWorkouts(g, nextWorkouts),
        ),
      };
    }),

  setWorkout: (index: number, w: WorkoutDraft) =>
    set((s) => {
      const arr = s.workouts.slice();

      while (arr.length <= index) arr.push(emptyWorkoutDraft(arr.length));

      arr[index] = {
        title: String(w?.title ?? "").trim() ? w.title : `Workout ${index + 1}`,
        notes: w?.notes ?? null,
        exercises: Array.isArray(w?.exercises) ? w.exercises : [],
      };

      return {
        ...s,
        workouts: arr,
        goals: s.goals.filter((g) => goalExerciseExistsInWorkouts(g, arr)),
      };
    }),

  setGoals: (g: GoalDraft[]) => set(() => ({ goals: g })),

  upsertGoal: (goal: GoalDraft) =>
    set((s) => {
      const exists = s.goals.some((g) => g.exercise.id === goal.exercise.id);

      return {
        ...s,
        goals: exists
          ? s.goals.map((g) =>
              g.exercise.id === goal.exercise.id ? goal : g,
            )
          : [...s.goals, goal],
      };
    }),

  updateGoal: (exerciseId: string, patch: Partial<GoalDraft>) =>
    set((s) => ({
      ...s,
      goals: s.goals.map((g) =>
        g.exercise.id === exerciseId ? { ...g, ...patch } : g,
      ),
    })),

  removeGoal: (exerciseId: string) =>
    set((s) => ({
      ...s,
      goals: s.goals.filter((g) => g.exercise.id !== exerciseId),
    })),

  clearGoalsForRemovedExercises: () =>
    set((s) => ({
      ...s,
      goals: s.goals.filter((g) => goalExerciseExistsInWorkouts(g, s.workouts)),
    })),
});

export const usePlanDraft = create<PlanDraftState>(creator);