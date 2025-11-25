import { create } from "zustand";

export type CachedExercise = {
  id: string;
  name: string;
  type: "strength" | "cardio" | "mobility" | null;
  primary_muscle: string | null;   
  popularity: number | null;
};

type State = {
  loadedAt: number | null;
  items: CachedExercise[];
  setItems: (arr: CachedExercise[]) => void;
  clear: () => void;
};

export const useExercisesCache = create<State>((set) => ({
  loadedAt: null,
  items: [],
  setItems: (arr) => set({ items: arr, loadedAt: Date.now() }),
  clear: () => set({ items: [], loadedAt: null }),
}));
