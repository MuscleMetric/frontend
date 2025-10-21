// app/features/plans/create/Workout.tsx
import { useLocalSearchParams, router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { useEffect } from "react";

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
  const { index: idxParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(idxParam ?? 0);

  const { workoutsPerWeek, workouts, setWorkout } = usePlanDraft();
  const draft = workouts?.[index];

  if (!Number.isFinite(index) || !draft) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // always-safe alias so we never deref draft.exercises before guarding
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    [exercises]
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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

  // Five rotating superset colors (repeat after 5)
  const SUPERSET_COLORS = [
    "#2563eb",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
  ];

  // Stable list of superset groups in the order they appear
  const supersetGroups = useMemo(
    () => [
      ...new Set(
        exercises.map((x) => x.supersetGroup).filter(Boolean) as string[]
      ),
    ],
    [exercises]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16 }}
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
      />

      <Text style={s.label}>Exercises</Text>

      {/* Superset toolbar when selecting */}
      {selecting && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Pressable style={[s.btn, s.primary]} onPress={makeSuperset}>
            <Text style={s.primaryText}>Create Superset</Text>
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

      {draft.exercises.map((e, i) => {
        const key = rowKey(i);
        const isSelected = selectedIds.includes(key);
        const group = e.supersetGroup ?? null;

        // Which group letter/color?
        const groupIndex = group ? supersetGroups.indexOf(group) : -1;
        const groupLabel =
          groupIndex >= 0 ? String.fromCharCode(65 + groupIndex) : null;
        const groupColor =
          groupIndex >= 0
            ? SUPERSET_COLORS[groupIndex % SUPERSET_COLORS.length]
            : null;

        return (
          <View
            key={key}
            style={[
              s.item,
              // show a colored border if in a superset
              groupColor && { borderColor: groupColor, borderWidth: 2 },
              // selection highlight on top if selecting
              isSelected && { borderColor: "#2563eb", borderWidth: 3 },
            ]}
          >
            <Pressable
              onLongPress={() => {
                setSelecting(true);
                toggleSelect(key);
              }}
              onPress={() => {
                if (selecting) toggleSelect(key);
              }}
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
                  <Text style={{ fontWeight: "700" }}>
                    {i + 1}. {e.exercise.name}
                    {groupLabel ? (
                      <Text
                        style={[
                          { fontWeight: "800" },
                          groupColor ? { color: groupColor } : undefined,
                        ]}
                      >
                        {`  •  Superset ${groupLabel}`}
                      </Text>
                    ) : null}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {!!e.exercise.type && (
                      <Text style={{ color: "#6b7280" }}>
                        {e.exercise.type}
                      </Text>
                    )}
                    {e.isDropset && (
                      <Text style={{ color: "#0b6aa9", fontWeight: "700" }}>
                        • Dropset
                      </Text>
                    )}
                  </View>

                  {/* Simple target summary (you aren't collecting sets/reps now, so keep minimal) */}
                  <Text style={{ color: "#6b7280", marginTop: 4 }}>
                    Exercise selected
                  </Text>
                </View>

                <View style={{ gap: 6, alignItems: "flex-end" }}>
                  <Pressable
                    onPress={() => {
                      const copy = [...draft.exercises];
                      copy[i] = { ...copy[i], isDropset: !copy[i].isDropset };
                      setWorkout(index, { ...draft, exercises: copy });
                    }}
                  >
                    <Text style={{ color: "#2563eb", fontWeight: "700" }}>
                      {e.isDropset ? "Remove Dropset" : "Mark as Dropset"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const copy = [...draft.exercises];
                      copy.splice(i, 1);
                      setWorkout(index, {
                        ...draft,
                        exercises: copy.map((x, j) => ({
                          ...x,
                          order_index: j,
                        })),
                      });
                    }}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}

      {/* Controls */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        {!showPicker && (
          <Pressable
            style={[s.btn, s.primary]}
            onPress={() => setShowPicker(true)}
          >
            <Text style={s.primaryText}>＋ Add Exercise</Text>
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
      {showPicker && (
        <View style={s.pickerCard}>
          <Text style={s.h3}>Add Exercise</Text>

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
                      color: active ? "#fff" : "#111",
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
              <Text style={{ fontWeight: "700" }}>All muscles</Text>
            </Pressable>
            {MUSCLE_CHIPS.map((m) => {
              const active = muscleFilter === m;
              return (
                <Pressable
                  key={m}
                  style={[s.chipOutline, active && s.chipOutlineActive]}
                  onPress={() => setMuscleFilter(m)}
                >
                  <Text style={{ fontWeight: "700" }}>{m}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Search */}
          <TextInput
            style={[s.input, { marginTop: 8 }]}
            placeholder="Search within filters…"
            value={search}
            onChangeText={setSearch}
          />

          {/* Cache state */}
          {all.length === 0 ? (
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ color: "#6b7280", marginTop: 6 }}>
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
                      picked && { borderColor: "#2563eb", borderWidth: 2 },
                    ]}
                    onPress={() => togglePick(r.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700" }}>{r.name}</Text>
                      <Text style={{ color: "#6b7280", marginTop: 2 }}>
                        {(r.type ?? "—") +
                          (r.primary_muscle ? ` • ${r.primary_muscle}` : "")}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: picked ? "#2563eb" : "#6b7280",
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
                  <Text style={{ color: "#6b7280" }}>
                    No matches. Try a different type or muscle.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
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
                    order_index: 0, // re-index below
                  }));

                const merged = [...draft.exercises, ...toAddFromCache].map(
                  (e, i) => ({ ...e, order_index: i })
                );
                setWorkout(index, { ...draft, exercises: merged });

                clearPickerSelections();
                setTypeFilter("all");
                setMuscleFilter(null);
                setSearch("");
                setShowPicker(false);
              }}
            >
              <Text style={s.primaryText}>
                Add {selectedToAdd.size || ""}{" "}
                {selectedToAdd.size === 1 ? "Exercise" : "Exercises"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        {index > 0 && (
          <Pressable style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>← Back</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.primary, { flex: 1 }]} onPress={next}>
          <Text style={s.primaryText}>
            {index < workoutsPerWeek - 1 ? "Next Workout →" : "Next → Goals"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  h3: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  label: { fontWeight: "700", marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  item: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#EEF2F6",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  btnText: { fontWeight: "700" },
  primary: { backgroundColor: "#2563eb" },
  primaryText: { color: "#fff", fontWeight: "800" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF2F6",
  },
  chipActive: { backgroundColor: "#2563eb" },
  chipOutline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  chipOutlineActive: { borderColor: "#2563eb" },
  pickerCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  empty: { padding: 16, alignItems: "center" },
});
