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
  setWorkout: (index: number, w: WorkoutDraft) => void;
  setGoals: (g: GoalDraft[]) => void;
};

const creator: StateCreator<PlanDraftState> = (set) => ({
  title: "",
  endDate: null,
  workoutsPerWeek: 3,
  workouts: [],
  goals: [],

  reset: () =>
    set(() => ({
      title: "",
      endDate: null,
      workoutsPerWeek: 3,
      workouts: [],
      goals: [],
    })),

  setMeta: (p) =>
    set((s: PlanDraftState) => ({
      ...s,
      ...p,
    })),

  initWorkouts: (n: number) =>
    set(() => ({
      workoutsPerWeek: n,
      workouts: Array.from({ length: n }, (_, i) => ({
        title: `Workout ${i + 1}`,
        exercises: [],
      })),
    })),

  setWorkout: (index: number, w: WorkoutDraft) =>
    set((s: PlanDraftState) => {
      const arr = s.workouts.slice();
      arr[index] = w;
      return { ...s, workouts: arr };
    }),

  setGoals: (g: GoalDraft[]) => set(() => ({ goals: g })),
});

export const usePlanDraft = create<PlanDraftState>(creator);
