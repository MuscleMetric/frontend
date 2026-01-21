// app/features/workouts/live/swap/swapPickerCache.ts
export type SwapPickerOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
  level: string | null;
  instructions: string | null;

  muscleIds: string[]; // stringified muscle ids
  isFavorite: boolean;
  sessionsCount: number;
  setsCount: number;
  lastUsedAt: string | null;
};

export type Chip = { id: string; label: string };

type SwapPickerCache = {
  options: SwapPickerOption[];
  favoriteIds: Set<string>;
  usageByExerciseId: Record<string, number>;
  equipmentOptions: string[];
  muscleGroups: Chip[];
  loadedAt: number;
};

let CACHE: SwapPickerCache | null = null;

export function setSwapPickerCache(next: SwapPickerCache) {
  CACHE = next;
}

export function getSwapPickerCache() {
  return CACHE;
}

export function clearSwapPickerCache() {
  CACHE = null;
}
