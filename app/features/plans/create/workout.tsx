// app/features/plans/create/Workout.tsx
import { useLocalSearchParams, router } from "expo-router";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { usePlanDraft, ExerciseRow } from "./store";
import { useExercisesCache } from "./exercisesStore";
import { nanoid } from "nanoid/non-secure";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { Modal } from "react-native";

import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";

const TYPE_CHIPS: Array<"all" | "strength" | "cardio" | "mobility"> = [
  "all",
  "strength",
  "cardio",
  "mobility",
];
const MUSCLE_CHIPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Rear Delts",
  "Traps",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Obliques",
  "Quadriceps",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Hip Flexors",
  "Adductors",
  "Abductors",
  "Upper Back",
  "Lower Back",
];

export default function WorkoutPage() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { index: idxParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(idxParam ?? 0);

  const { workoutsPerWeek, workouts, setWorkout } = usePlanDraft();
  const draft = workouts?.[index];

  if (!Number.isFinite(index) || !draft) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const exercises = draft?.exercises ?? [];

  const [showPicker, setShowPicker] = useState(false);
  const [typeFilter, setTypeFilter] = useState<
    "all" | "strength" | "cardio" | "mobility"
  >("all");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { items: all } = useExercisesCache();

  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  function togglePick(id: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function clearPickerSelections() {
    setSelectedToAdd(new Set());
  }

  // Superset selection
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rowKey = (i: number) => `${exercises[i]?.exercise.id ?? "NA"}-${i}`;
  function toggleSelect(key: string) {
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Prevent duplicates within THIS workout
  const hasExercise = useCallback(
    (exerciseId: string) =>
      draft.exercises.some((e) => e.exercise.id === exerciseId),
    [draft.exercises]
  );

  function makeSuperset() {
    if (selectedIds.length < 2) {
      Alert.alert("Pick at least 2 exercises to create a superset.");
      return;
    }
    const groupId = `ss-${nanoid(6)}`;
    const updated = draft.exercises.map((ex, i) =>
      selectedIds.includes(rowKey(i)) ? { ...ex, supersetGroup: groupId } : ex
    );
    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  function clearSupersetForSelected() {
    if (selectedIds.length === 0) return;
    const updated = draft.exercises.map((ex, i) =>
      selectedIds.includes(rowKey(i)) ? { ...ex, supersetGroup: null } : ex
    );
    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  useEffect(() => {
    if (!Number.isFinite(index) || !workouts?.[index]) {
      router.replace("/features/plans/create/planInfo");
    }
  }, [index, workouts]);

  if (!draft) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Filter from cache
  const results = useMemo(() => {
    let pool = all;

    if (typeFilter !== "all") pool = pool.filter((e) => e.type === typeFilter);

    if (muscleFilter) {
      const mf = muscleFilter.toLowerCase();
      pool = pool.filter((e) => {
        const pm = (e.primary_muscle ?? "").toLowerCase();
        if (muscleFilter === "Back") {
          return (
            pm.includes("lat") ||
            pm.includes("upper back") ||
            pm.includes("lower back") ||
            pm === "back"
          );
        }
        return pm.includes(mf);
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      pool = pool.filter((e) => e.name.toLowerCase().includes(q));
    }

    pool = pool.filter((e) => !hasExercise(e.id));

    return pool.slice(0, 10);
  }, [all, typeFilter, muscleFilter, search, hasExercise]);

  function next() {
    if (!draft.title.trim()) return Alert.alert("Add a workout title");
    if (draft.exercises.length === 0)
      return Alert.alert("Add at least one exercise");
    if (index < workoutsPerWeek - 1) {
      router.push({
        pathname: "/features/plans/create/workout",
        params: { index: index + 1 },
      });
    } else {
      router.push("/features/plans/create/goals");
    }
  }

  const SUPERSET_COLORS = [
    "#2563eb",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
  ];
  const supersetGroups = useMemo(
    () => [
      ...new Set(
        exercises.map((x) => x.supersetGroup).filter(Boolean) as string[]
      ),
    ],
    [exercises]
  );

  // ---- DRAGGABLE LIST HANDLERS ----

  const handleDragEnd = useCallback(
    ({ data }: { data: typeof draft.exercises }) => {
      // Reindex order_index after drag
      const reindexed = data.map((e, i) => ({
        ...e,
        order_index: i,
      }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, index, setWorkout]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h2}>
        Workout {index + 1} of {workoutsPerWeek}
      </Text>

      <Text style={s.label}>Title</Text>
      <TextInput
        style={s.input}
        value={draft.title}
        onChangeText={(t) => setWorkout(index, { ...draft, title: t })}
        placeholder="e.g. Push, Pull, Legs…"
        placeholderTextColor={colors.subtle}
      />

      <Text style={s.label}>Exercises</Text>

      {/* Superset toolbar when selecting */}
      {selecting && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Pressable style={[s.btn, s.primary]} onPress={makeSuperset}>
            <Text style={s.btnPrimaryText}>Create Superset</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={clearSupersetForSelected}>
            <Text style={s.btnText}>Ungroup</Text>
          </Pressable>
          <Pressable
            style={s.btn}
            onPress={() => {
              setSelecting(false);
              setSelectedIds([]);
            }}
          >
            <Text style={s.btnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* DRAGGABLE EXERCISE LIST */}
      {draft.exercises.length > 0 && (
        <View style={{ maxHeight: 420, marginBottom: 8 }}>
          <DraggableFlatList
            data={draft.exercises}
            keyExtractor={(_, i) => rowKey(i)}
            scrollEnabled={false}
            onDragEnd={({ data }) => {
              // keep order_index in sync after drag
              const reindexed = data.map((ex, i) => ({
                ...ex,
                order_index: i,
              }));
              setWorkout(index, { ...draft, exercises: reindexed });
            }}
            renderItem={({
              item,
              drag,
              isActive,
            }: RenderItemParams<(typeof draft.exercises)[number]>) => {
              // ✅ use order_index instead of index from params
              const displayIndex =
                typeof item.order_index === "number" ? item.order_index + 1 : 1;

              const group = item.supersetGroup ?? null;
              const groupIndex = group ? supersetGroups.indexOf(group) : -1;
              const groupLabel =
                groupIndex >= 0 ? String.fromCharCode(65 + groupIndex) : null;
              const groupColor =
                groupIndex >= 0
                  ? SUPERSET_COLORS[groupIndex % SUPERSET_COLORS.length]
                  : null;

              return (
                <View
                  style={[
                    s.item,
                    groupColor && { borderColor: groupColor, borderWidth: 2 },
                  ]}
                >
                  <Pressable
                    onLongPress={drag}
                    disabled={isActive}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: colors.text }}>
                          {displayIndex}. {item.exercise.name}
                          {groupLabel ? (
                            <Text
                              style={{
                                fontWeight: "800",
                                color: groupColor ?? colors.text,
                              }}
                            >
                              {`  •  Superset ${groupLabel}`}
                            </Text>
                          ) : null}
                        </Text>
                        {/* the rest of your dropset / tags / “Exercise selected” bits */}
                      </View>

                      {/* right-side actions stay the same */}
                    </View>
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Controls */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        {!showPicker && (
          <Pressable
            style={[s.btn, s.primary]}
            onPress={() => setShowPicker(true)}
          >
            <Text style={s.btnPrimaryText}>＋ Add Exercise</Text>
          </Pressable>
        )}
        {!selecting ? (
          <Pressable
            style={[s.btn, draft.exercises.length < 2 && { opacity: 0.5 }]}
            disabled={draft.exercises.length < 2}
            onPress={() => setSelecting(true)}
          >
            <Text style={s.btnText}>Select for Superset</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Picker */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View
          style={[s.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={s.modalHeader}>
            <Text style={s.h3}>Add Exercise</Text>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                Close ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
            >
              {TYPE_CHIPS.map((t) => {
                const active = typeFilter === t;
                return (
                  <Pressable
                    key={t}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setTypeFilter(t)}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: active ? colors.primary ?? "#fff" : colors.text,
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Muscle filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              <Pressable
                style={[s.chipOutline, !muscleFilter && s.chipOutlineActive]}
                onPress={() => setMuscleFilter(null)}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  All muscles
                </Text>
              </Pressable>
              {MUSCLE_CHIPS.map((m) => {
                const active = muscleFilter === m;
                return (
                  <Pressable
                    key={m}
                    style={[s.chipOutline, active && s.chipOutlineActive]}
                    onPress={() => setMuscleFilter(m)}
                  >
                    <Text style={{ fontWeight: "700", color: colors.text }}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Search */}
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Search within filters…"
              placeholderTextColor={colors.subtle}
              value={search}
              onChangeText={setSearch}
            />

            {/* Exercise list */}
            {all.length === 0 ? (
              <View style={{ marginTop: 20, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ color: colors.subtle, marginTop: 6 }}>
                  Loading exercises…
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 8 }}>
                {results.map((r) => {
                  const picked = selectedToAdd.has(r.id);
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        s.row,
                        picked && {
                          borderColor: colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => togglePick(r.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: colors.text }}>
                          {r.name}
                        </Text>
                        <Text style={{ color: colors.subtle, marginTop: 2 }}>
                          {(r.type ?? "—") +
                            (r.primary_muscle ? ` • ${r.primary_muscle}` : "")}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: picked ? colors.primary : colors.subtle,
                          fontWeight: "700",
                        }}
                      >
                        {picked ? "Selected" : "Select"}
                      </Text>
                    </Pressable>
                  );
                })}

                {results.length === 0 && (
                  <View style={s.empty}>
                    <Text style={{ color: colors.subtle }}>
                      No matches. Try a different type or muscle.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom actions */}
          <View style={s.modalActions}>
            <Pressable
              style={[s.btn, { flex: 1 }]}
              onPress={() => {
                setTypeFilter("all");
                setMuscleFilter(null);
                setSearch("");
                clearPickerSelections();
                setShowPicker(false);
              }}
            >
              <Text style={s.btnText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                s.btn,
                s.primary,
                { flex: 1, opacity: selectedToAdd.size ? 1 : 0.6 },
              ]}
              disabled={selectedToAdd.size === 0}
              onPress={() => {
                const idSet = selectedToAdd;
                const toAddFromCache = all
                  .filter((e) => idSet.has(e.id) && !hasExercise(e.id))
                  .map((r) => ({
                    exercise: {
                      id: r.id,
                      name: r.name,
                      type: r.type,
                    } as ExerciseRow,
                    order_index: 0,
                  }));

                const merged = [...draft.exercises, ...toAddFromCache].map(
                  (e, i) => ({
                    ...e,
                    order_index: i,
                  })
                );
                setWorkout(index, { ...draft, exercises: merged });

                clearPickerSelections();
                setTypeFilter("all");
                setMuscleFilter(null);
                setSearch("");
                setShowPicker(false);
              }}
            >
              <Text style={s.btnPrimaryText}>
                Add {selectedToAdd.size || ""}{" "}
                {selectedToAdd.size === 1 ? "Exercise" : "Exercises"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        {index > 0 && (
          <Pressable style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>← Back</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.primary, { flex: 1 }]} onPress={next}>
          <Text style={s.btnPrimaryText}>
            {index < workoutsPerWeek - 1 ? "Next Workout →" : "Next → Goals"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    h2: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 12,
      color: colors.text,
    },
    h3: {
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 8,
      color: colors.text,
    },
    label: {
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
      color: colors.text,
    },

    input: {
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
    },

    item: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    row: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "700", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },

    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    chipOutline: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipOutlineActive: { borderColor: colors.primary },

    pickerCard: {
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    empty: {
      padding: 16,
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
    },

    modalContainer: {
      flex: 1,
      paddingTop: 50,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modalActions: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
  });
