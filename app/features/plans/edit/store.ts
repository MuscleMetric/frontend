// app/features/plans/edit/store.ts
import { create } from "zustand";

export type ExerciseRow = {
  id: string;
  name: string;
  type?: string | null;
};

export type WorkoutExerciseDraft = {
  exercise: ExerciseRow;
  order_index: number;
  supersetGroup?: string | null;
  isDropset?: boolean;
};

export type WorkoutDraft = {
  title: string;
  exercises: WorkoutExerciseDraft[];
};

export type GoalDraft = {
  exercise: ExerciseRow;
  mode: "exercise_weight" | "exercise_reps" | "distance" | "time";
  unit: string | null;
  start: number | null;
  target: number;
};

type EditState = {
  mode: "edit";
  planId: string | null;

  title: string;
  startDate: string | null;
  endDate: string | null;
  workoutsPerWeek: number;
  workouts: WorkoutDraft[];
  goals: GoalDraft[];

  initFromLoaded: (payload: {
    planId: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    workouts: WorkoutDraft[];
    goals: GoalDraft[];
  }) => void;

  setMeta: (
    patch: Partial<Pick<EditState, "title" | "startDate" | "endDate">>
  ) => void;
  setWorkout: (index: number, w: WorkoutDraft) => void;
  setGoals: (goals: GoalDraft[]) => void;

  /** NEW: create a blank workout and return its index */
  addWorkout: () => number;

  /** NEW: remove workout at index and reindex order_index of remaining exercises */
  removeWorkout: (index: number) => void;
};

function reindexExercises(exs: WorkoutExerciseDraft[]) {
  return exs.map((e, i) => ({ ...e, order_index: i }));
}

export const useEditPlan = create<EditState>((set, get) => ({
  mode: "edit",
  planId: null,

  title: "",
  startDate: null,
  endDate: null,
  workoutsPerWeek: 0,
  workouts: [],
  goals: [],

  initFromLoaded: (p) =>
    set({
      mode: "edit",
      planId: p.planId,
      title: p.title,
      startDate: p.startDate,
      endDate: p.endDate,
      workouts: p.workouts,
      workoutsPerWeek: p.workouts.length,
      goals: p.goals,
    }),

  setMeta: (patch) => set((s) => ({ ...s, ...patch })),

  setWorkout: (index, w) =>
    set((s) => {
      const copy = [...s.workouts];
      copy[index] = { ...w, exercises: reindexExercises(w.exercises ?? []) };
      return { ...s, workouts: copy };
    }),

  setGoals: (goals) => set((s) => ({ ...s, goals })),

  addWorkout: () => {
    const state = get();
    const nextNumber = state.workouts.length + 1;
    const next: WorkoutDraft = {
      title: `Workout ${nextNumber}`,
      exercises: [],
    };
    const workouts = [...state.workouts, next];
    set({ workouts, workoutsPerWeek: workouts.length });
    return workouts.length - 1; // index of the new workout
  },

  removeWorkout: (index) =>
    set((s) => {
      const workouts = s.workouts
        .filter((_, i) => i !== index)
        .map((w) => ({ ...w, exercises: reindexExercises(w.exercises) }));
      return { ...s, workouts, workoutsPerWeek: workouts.length };
    }),
}));
