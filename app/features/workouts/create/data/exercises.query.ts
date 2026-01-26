import { supabase } from "../../../../../lib/supabase";

export type ExerciseListItem = {
  id: string;
  name: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  isFavourite?: boolean; // derived (if you have the join table)
};

export type ExerciseFilters = {
  query?: string; // search text
  muscle?: string | null; // e.g. "Chest"
  equipment?: string | null; // e.g. "Dumbbells"
  favouritesOnly?: boolean;
  limit?: number; // default 50
};

type FetchExercisesArgs = {
  userId: string;
  filters?: ExerciseFilters;
};

function norm(s?: string | null) {
  return String(s ?? "").trim();
}

/**
 * Fetch exercises for "Add Exercises" sheet.
 * - Search by name
 * - Filter by muscle/equipment (best-effort, depends on your schema)
 * - Optionally favourites-only
 * - Returns favourites first (if favourites table exists)
 */
export async function fetchExercises({
  userId,
  filters,
}: FetchExercisesArgs): Promise<ExerciseListItem[]> {
  const limit = Math.max(1, Math.min(200, filters?.limit ?? 60));
  const q = norm(filters?.query);
  const muscle = norm(filters?.muscle);
  const equipment = norm(filters?.equipment);
  const favouritesOnly = !!filters?.favouritesOnly;

  // ---- Base query (exercises table) ----
  // If you have different columns, tweak select below.
  // "primary_muscle" might be derived from exercise_muscles; we handle a fallback later.
  let base = supabase
    .from("exercises")
    .select("id, name, equipment, primary_muscle")
    .order("name", { ascending: true })
    .limit(limit);

  // Search
  if (q) {
    // ilike name search
    base = base.ilike("name", `%${q}%`);
  }

  // Equipment filter (if your exercises table has equipment)
  if (equipment) {
    base = base.ilike("equipment", `%${equipment}%`);
  }

  // Muscle filter:
  // If you have a join table (exercise_muscles -> muscles), you may want to replace this
  // with an RPC or a view that exposes primary_muscle.
  if (muscle) {
    base = base.ilike("primary_muscle", `%${muscle}%`);
  }

  const { data: exRows, error: exErr } = await base;
  if (exErr) throw exErr;

  const exercises = (exRows ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? "Exercise"),
    equipment: r.equipment != null ? String(r.equipment) : null,
    primaryMuscle: r.primary_muscle != null ? String(r.primary_muscle) : null,
  }));

  if (!exercises.length) return [];

  // ---- Favourite overlay (optional) ----
  // If you DON'T have this table, you can remove this whole block and the UI still works.
  const ids = exercises.map((e) => e.id);

  const { data: favRows, error: favErr } = await supabase
    .from("exercise_favourites")
    .select("exercise_id")
    .eq("user_id", userId)
    .in("exercise_id", ids);

  // If the table doesn't exist, supabase will return an error — we treat that as "no favourites".
  const favSet = new Set<string>();
  if (!favErr && Array.isArray(favRows)) {
    favRows.forEach((r: any) => favSet.add(String(r.exercise_id)));
  }

  let merged: ExerciseListItem[] = exercises.map((e) => ({
    ...e,
    isFavourite: favSet.has(e.id),
  }));

  if (favouritesOnly) {
    merged = merged.filter((e) => e.isFavourite);
  } else {
    // favourites-first ordering, then alpha
    merged.sort((a, b) => {
      const af = a.isFavourite ? 1 : 0;
      const bf = b.isFavourite ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
  }

  return merged;
}
