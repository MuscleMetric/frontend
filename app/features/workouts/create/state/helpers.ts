import type { WorkoutDraft } from "./types";

export function moveArrayItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const item = next.splice(from, 1)[0];
  next.splice(to, 0, item);
  return next;
}

// If you want favourites to "bubble up" but still allow manual order:
// - we DO NOT auto-sort; user controls order.
// - This helper is only for "pin to top" behaviour (optional)
export function moveToTop<T>(arr: T[], index: number): T[] {
  return moveArrayItem(arr, index, 0);
}

// cheap hash for dirty check (good enough for local UI)
export function snapshotHash(d: WorkoutDraft): string {
  const core = {
    title: d.title,
    note: d.note ?? "",
    exercises: d.exercises.map((e) => ({
      id: e.exerciseId,
      name: e.name,
      fav: e.isFavourite ? 1 : 0,
      note: e.note ?? "",
    })),
  };
  return JSON.stringify(core);
}

export function nowIso() {
  return new Date().toISOString();
}
