// app/features/workouts/live/add/index.tsx
import React, { useMemo, useState, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { ExercisePickerSheet } from "@/ui";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabase";

import { emitAddExercisesResult, setAddExercisesHandler } from "./addBus";
import { useAddPickerData } from "./useAddPickerData";

type Params = {
  alreadyInIds?: string; // JSON stringified string[]
};

function safeParseIds(v?: string): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

function muscleIdsToIntArray(ids: string[]): number[] {
  const out: number[] = [];
  for (const id of ids) {
    const n = parseInt(String(id), 10);
    if (!Number.isFinite(n)) {
      throw new Error("Invalid muscle id (expected numeric id).");
    }
    out.push(n);
  }
  return out;
}

type PickerOption = {
  id: string;
  name: string;
  type: string;
  equipment: string | null;
  muscleIds: string[];
};

export default function AddExercisesScreen() {
  const { colors } = useAppTheme();
  const { userId } = useAuth();
  const params = useLocalSearchParams<Params>();

  const alreadyInIds = useMemo(
    () =>
      safeParseIds(
        typeof params.alreadyInIds === "string" ? params.alreadyInIds : undefined
      ),
    [params.alreadyInIds]
  );

  const {
    loading,
    options,
    muscleGroups,
    favoriteIds,
    toggleFavorite,
    usageByExerciseId,
    equipmentOptions,
  } = useAddPickerData();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null
  );

  // ✅ NEW: locally keep created exercises so they appear immediately (no refresh needed)
  const [createdOptions, setCreatedOptions] = useState<PickerOption[]>([]);

  // ✅ combine backend options + locally created ones, dedup by id
  const sheetOptions: PickerOption[] = useMemo(() => {
    const base = options.map((o) => ({
      id: String(o.id),
      name: String(o.name ?? ""),
      type: String(o.type ?? "strength"),
      equipment: (o.equipment ?? null) as string | null,
      muscleIds: Array.isArray(o.muscleIds) ? o.muscleIds.map(String) : [],
    }));

    const merged = [...createdOptions, ...base];
    const seen = new Set<string>();
    const dedup: PickerOption[] = [];
    for (const opt of merged) {
      const id = String(opt.id);
      if (seen.has(id)) continue;
      seen.add(id);
      dedup.push(opt);
    }
    return dedup;
  }, [options, createdOptions]);

  const upsertCreatedOption = useCallback((opt: PickerOption) => {
    setCreatedOptions((prev) => {
      if (prev.some((x) => x.id === opt.id)) return prev;
      return [opt, ...prev];
    });
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ExercisePickerSheet
      title="Add exercises"
      options={sheetOptions}
      alreadyInIds={alreadyInIds}
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
      multiSelect={true}
      onCreateExercise={async ({ name, equipment, muscleIds, instructions }) => {
        if (!userId) throw new Error("Not signed in.");

        const muscleIntIds = muscleIdsToIntArray((muscleIds ?? []).slice(0, 3));

        const { data, error } = await supabase.rpc("create_private_exercise", {
          p_name: name,
          p_equipment: equipment,
          p_muscle_ids: muscleIntIds,
          p_instructions: instructions ?? null,
        });

        if (error) throw error;

        const newExerciseId = String(data);
        if (!newExerciseId) throw new Error("Create exercise failed.");

        // ✅ Build the option shape the picker uses and insert it locally
        const created: PickerOption = {
          id: newExerciseId,
          name,
          type: "strength",
          equipment: equipment ?? null,
          muscleIds: muscleIntIds.map(String),
        };

        upsertCreatedOption(created);

        // ✅ Ensure it is truly selected (so confirm includes it)
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(newExerciseId);
          return Array.from(next);
        });

        // Return what the picker expects so it can show + auto-select immediately
        return created;
      }}
      onClose={() => {
        setAddExercisesHandler(null);
        router.back();
      }}
      onConfirm={(ids) => {
        // ✅ Defensive: include locally selectedIds too (covers picker implementations that only return known option ids)
        const combined = Array.from(new Set([...(ids ?? []), ...selectedIds])).map(String);

        const uniqueNew = combined.filter((id) => !alreadyInIds.includes(id));

        emitAddExercisesResult({ selectedIds: uniqueNew });

        setAddExercisesHandler(null);
        router.back();
      }}
    />
  );
}