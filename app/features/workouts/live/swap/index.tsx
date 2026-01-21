import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Keyboard, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { emitSwapPicked } from "./swapBus";
import { ExercisePickerSheet, ExerciseOption } from "@/ui/modals/ExercisePickerSheet";
import { getSwapPickerCache, setSwapPickerCache, type SwapPickerOption, type Chip } from "../swap/swapPickerCache";

type Params = {
  replacingExerciseId?: string;
};

export default function SwapExercisePage() {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();

  const replacingExerciseId =
    typeof params.replacingExerciseId === "string"
      ? params.replacingExerciseId
      : null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [options, setOptions] = useState<SwapPickerOption[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<Chip[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [usageByExerciseId, setUsageByExerciseId] = useState<Record<string, number>>({});

  // UX state owned here
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // If you want true disable-ordering, pass alreadyInIds via params later.
  const alreadyInIds: string[] = [];

  // 1) hydrate from cache immediately
  useEffect(() => {
    const cache = getSwapPickerCache();
    if (cache) {
      setOptions(cache.options);
      setFavoriteIds(cache.favoriteIds);
      setUsageByExerciseId(cache.usageByExerciseId);
      setEquipmentOptions(cache.equipmentOptions);
      setMuscleGroups(cache.muscleGroups);
      setLoading(false);
      return;
    }

    // 2) fallback: fetch only if cache missing (deep link / refresh)
    let alive = true;

    async function fallbackFetch() {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase.rpc("get_exercise_picker_data", {
          p_include_private: false,
        });
        if (error) throw error;
        if (!alive) return;

        const rows = (data ?? []) as any[];

        const nextOptions: SwapPickerOption[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type ?? null,
          equipment: r.equipment ?? null,
          level: r.level ?? null,
          instructions: r.instructions ?? null,
          muscleIds: Array.isArray(r.muscle_ids) ? r.muscle_ids.map((x: any) => String(x)) : [],
          isFavorite: Boolean(r.is_favorite),
          sessionsCount: Number(r.sessions_count ?? 0),
          setsCount: Number(r.sets_count ?? 0),
          lastUsedAt: r.last_used_at ?? null,
        }));

        const fav = new Set<string>();
        const usage: Record<string, number> = {};
        const equipSet = new Set<string>();

        for (const o of nextOptions) {
          if (o.isFavorite) fav.add(o.id);
          usage[o.id] = o.sessionsCount ?? 0;
          if (o.equipment) equipSet.add(o.equipment);
        }

        const { data: muscles, error: mErr } = await supabase
          .from("muscles")
          .select("id,name")
          .order("name", { ascending: true });

        const mg: Chip[] = mErr
          ? []
          : (muscles ?? []).map((m: any) => ({ id: String(m.id), label: m.name }));

        if (!alive) return;

        setOptions(nextOptions);
        setFavoriteIds(fav);
        setUsageByExerciseId(usage);
        setEquipmentOptions(Array.from(equipSet).sort((a, b) => a.localeCompare(b)));
        setMuscleGroups(mg);

        // write cache so next time is instant
        setSwapPickerCache({
          options: nextOptions,
          favoriteIds: fav,
          usageByExerciseId: usage,
          equipmentOptions: Array.from(equipSet).sort((a, b) => a.localeCompare(b)),
          muscleGroups: mg,
          loadedAt: Date.now(),
        });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load exercises");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fallbackFetch();
    return () => {
      alive = false;
    };
  }, []);

  // map to picker UI options
  const pickerOptions: ExerciseOption[] = useMemo(() => {
    return options.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      equipment: o.equipment,
      muscleIds: o.muscleIds,
    }));
  }, [options]);

  // toggle favourite (UI + optional DB write later)
  function toggleFavorite(exerciseId: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: colors.textMuted }}>
          Loading exercises…
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, padding: 16 }}>
        <Text style={{ color: colors.danger ?? "#ef4444", marginBottom: 10, fontFamily: typography.fontFamily.semibold }}>
          {err}
        </Text>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setErr(null);
            setLoading(true);
            router.replace({
              pathname: "/features/workouts/live/swap",
              params: replacingExerciseId ? { replacingExerciseId } : {},
            } as any);
          }}
          style={{
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontFamily: typography.fontFamily.bold }}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ExercisePickerSheet
      title="Select Exercises"
      options={pickerOptions}
      alreadyInIds={alreadyInIds}
      isReplaceMode
      replacingExerciseId={replacingExerciseId}
      usageByExerciseId={usageByExerciseId}
      favoriteIds={favoriteIds}
      favoritesOnly={favoritesOnly}
      onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
      onToggleFavorite={toggleFavorite}
      muscleGroups={muscleGroups}
      selectedMuscleId={selectedMuscleId}
      onChangeSelectedMuscleId={setSelectedMuscleId}
      equipmentOptions={equipmentOptions}
      selectedEquipment={selectedEquipment}
      onChangeSelectedEquipment={setSelectedEquipment}
      search={search}
      onChangeSearch={setSearch}
      selectedIds={selectedIds}
      onChangeSelectedIds={setSelectedIds}
      multiSelect={false}
      onClose={() => {
        Keyboard.dismiss();
        router.back();
      }}
      onConfirm={(ids) => {
        const pickedId = ids[0];
        if (!pickedId) return;

        const picked = options.find((x) => x.id === pickedId);
        if (!picked) return;

        emitSwapPicked({
          id: picked.id,
          name: picked.name,
          type: picked.type,
          equipment: picked.equipment,
          level: picked.level,
          instructions: picked.instructions,
        });

        router.back();
      }}
    />
  );
}
