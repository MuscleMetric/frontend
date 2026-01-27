import { supabase } from "../../../../../lib/supabase";

export type ExerciseListItem = {
  id: string;
  name: string;
  equipment?: string | null;

  muscleNames?: string[]; // from rpc
  isFavourite?: boolean; // from rpc (is_favorite)
  sessionsCount?: number; // from rpc
  setsCount?: number; // from rpc
  lastUsedAt?: string | null; // from rpc
};

export type ExerciseFilters = {
  query?: string;
  muscle?: string | null; // e.g. "Chest"
  equipment?: string | null; // e.g. "barbell"
  favouritesOnly?: boolean;
  limit?: number; // default 80
};

type FetchExercisesArgs = {
  userId: string; // kept for signature consistency, rpc uses auth.uid()
  filters?: ExerciseFilters;
};

function norm(s?: string | null) {
  return String(s ?? "").trim();
}

function includesCI(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function fetchExercises({
  userId: _userId,
  filters,
}: FetchExercisesArgs): Promise<ExerciseListItem[]> {
  const limit = Math.max(1, Math.min(200, filters?.limit ?? 80));
  const q = norm(filters?.query);
  const muscle = norm(filters?.muscle);
  const equipment = norm(filters?.equipment);
  const favouritesOnly = !!filters?.favouritesOnly;

  const { data, error } = await supabase.rpc("get_exercise_picker_data", {
    p_include_private: true,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  // map into UI shape
  let items: ExerciseListItem[] = rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? "Exercise"),
    equipment: r.equipment != null ? String(r.equipment) : null,

    muscleNames: Array.isArray(r.muscle_names) ? r.muscle_names.map(String) : [],
    isFavourite: !!r.is_favorite,
    sessionsCount: Number(r.sessions_count ?? 0) || 0,
    setsCount: Number(r.sets_count ?? 0) || 0,
    lastUsedAt: r.last_used_at != null ? String(r.last_used_at) : null,
  }));

  // filters (client-side)
  if (q) items = items.filter((x) => includesCI(x.name, q));
  if (equipment) items = items.filter((x) => includesCI(String(x.equipment ?? ""), equipment));
  if (muscle) items = items.filter((x) => (x.muscleNames ?? []).some((m) => includesCI(m, muscle)));
  if (favouritesOnly) items = items.filter((x) => !!x.isFavourite);

  // ordering: favourites first, then most-used, then alpha
  items.sort((a, b) => {
    const af = a.isFavourite ? 1 : 0;
    const bf = b.isFavourite ? 1 : 0;
    if (af !== bf) return bf - af;

    const au = a.sessionsCount ?? 0;
    const bu = b.sessionsCount ?? 0;
    if (au !== bu) return bu - au;

    return a.name.localeCompare(b.name);
  });

  return items.slice(0, limit);
}
