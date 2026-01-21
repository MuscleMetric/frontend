// app/features/workouts/live/add/index.tsx
import React, { useMemo, useState } from "react";
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

  const sheetOptions = useMemo(
    () =>
      options.map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        equipment: o.equipment,
        muscleIds: o.muscleIds,
      })),
    [options]
  );

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

        // RPC does BOTH:
        // 1) insert into exercises (type=strength, level=beginner, is_public=false, user_id=auth.uid())
        // 2) insert into exercise_muscles (contribution int)
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

        // Return what the picker expects so it can show + auto-select immediately
        return {
          id: newExerciseId,
          name,
          type: "strength",
          equipment,
          muscleIds: muscleIntIds.map(String),
        };
      }}
      onClose={() => {
        setAddExercisesHandler(null);
        router.back();
      }}
      onConfirm={(ids) => {
        const uniqueNew = (ids ?? []).filter(
          (id) => !alreadyInIds.includes(id)
        );

        emitAddExercisesResult({ selectedIds: uniqueNew });

        setAddExercisesHandler(null);
        router.back();
      }}
    />
  );
}
