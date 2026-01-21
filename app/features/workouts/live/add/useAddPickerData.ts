// app/features/workouts/live/add/useAddPickerData.ts
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Chip = { id: string; label: string };

export type PickerOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
  instructions: string | null;
  level: string | null;
  muscleIds: string[];

  isFavorite: boolean;
  sessionsCount: number;
  setsCount: number;
  lastUsedAt: string | null;
};

export function useAddPickerData() {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<Chip[]>([]);

  // local-only favorites set (you can wire to DB later)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const usageByExerciseId = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const o of options) usage[o.id] = Number(o.sessionsCount ?? 0);
    return usage;
  }, [options]);

  const equipmentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const o of options) if (o.equipment) s.add(o.equipment);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [options]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        // 1) exercise picker RPC
        const { data, error } = await supabase.rpc("get_exercise_picker_data", {
          p_include_private: true,
        });
        if (error) throw error;
        if (!alive) return;

        const rows = (data ?? []) as any[];

        const nextOptions: PickerOption[] = rows.map((r) => ({
          id: String(r.id),
          name: r.name ?? null,
          type: r.type ?? null,
          equipment: r.equipment ?? null,
          instructions: r.instructions ?? null,
          level: r.level ?? null,
          muscleIds: Array.isArray(r.muscle_ids)
            ? r.muscle_ids.map((x: any) => String(x))
            : [],

          isFavorite: Boolean(r.is_favorite),
          sessionsCount: Number(r.sessions_count ?? 0),
          setsCount: Number(r.sets_count ?? 0),
          lastUsedAt: r.last_used_at ?? null,
        }));

        // initialize favorites from RPC result
        const fav = new Set<string>();
        for (const o of nextOptions) if (o.isFavorite) fav.add(o.id);

        // 2) muscles
        const { data: muscles, error: mErr } = await supabase
          .from("muscles")
          .select("id,name")
          .order("name", { ascending: true });

        const mg: Chip[] = mErr
          ? []
          : (muscles ?? []).map((m: any) => ({
              id: String(m.id),
              label: m.name,
            }));

        if (!alive) return;

        setOptions(nextOptions);
        setFavoriteIds(fav);
        setMuscleGroups(mg);
      } catch (e) {
        console.warn("add picker load failed", e);
        if (!alive) return;
        setOptions([]);
        setMuscleGroups([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  function toggleFavorite(exerciseId: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  return {
    loading,
    options,
    muscleGroups,
    favoriteIds,
    toggleFavorite,
    usageByExerciseId,
    equipmentOptions,
  };
}
