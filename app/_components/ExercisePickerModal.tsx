// app/_components/ExercisePickerModal.tsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import CreateExerciseModal, { CreatedExercise } from "./CreateExerciseModal";

const capFirst = (v: string) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : v;

const local = (colors: any) =>
  StyleSheet.create({
    filterWrap: {
      marginTop: 8,
      paddingHorizontal: 16,
    },

    // ✅ centered pills row
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      flexWrap: "wrap",
    },

    filterPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterPillLabel: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
    filterPillCount: {
      marginLeft: 6,
      fontSize: 12,
      color: colors.subtle,
    },

    // centered summary
    filterSummaryText: {
      marginTop: 6,
      fontSize: 12,
      color: colors.subtle,
      textAlign: "center",
    },

    chipSection: {
      marginTop: 10,
      paddingHorizontal: 16,
    },

    // ✅ center chips horizontally
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },

    chip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipLabel: {
      fontSize: 13,
      color: colors.text,
    },

    // ✅ CTA block below chips and before list
    ctaWrap: {
      marginTop: 10,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    ctaTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    ctaSub: {
      marginTop: 4,
      fontSize: 12,
      color: colors.subtle,
      textAlign: "center",
    },
    ctaBtn: {
      marginTop: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.primaryBg ?? colors.primary,
    },
    ctaBtnText: {
      color: colors.primaryText ?? "#fff",
      fontWeight: "900",
      fontSize: 13,
    },
  });

export type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

type MuscleGroup = { id: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  loading: boolean;

  // data
  exerciseOptions: ExerciseOption[];
  muscleGroups: MuscleGroup[];
  equipmentOptions: string[];

  // selection
  initialSelectedIds?: string[];
  multiSelect?: boolean;

  // callbacks
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;

  // controlled search + filters (comes from parent)
  search: string;
  onChangeSearch: (v: string) => void;

  selectedMuscleGroups: string[];
  toggleMuscleGroup: (id: string) => void;
  muscleFilterOpen: boolean;
  setMuscleFilterOpen: (v: boolean) => void;

  selectedEquipment: string[];
  toggleEquipment: (eq: string) => void;
  equipmentFilterOpen: boolean;
  setEquipmentFilterOpen: (v: boolean) => void;

  // ordering inputs
  alreadyInWorkoutIds: string[]; // exercise ids already in current workout
  usageByExerciseId?: Record<string, number>; // sessions_count map

  // replace-mode UI (optional)
  isReplaceMode?: boolean;
  replacingExerciseId?: string | null; // exercise_id currently being replaced

  // favourites
  userId: string | null;

  // theming/styles
  styles: any;
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    subtle: string;
    border: string;
    primary: string;
    primaryBg?: string;
    primaryText?: string;
    danger?: string;
  };
  safeAreaTop: number;
};

const FAV_TABLE = "exercise_favorites";

export function ExercisePickerModal({
  visible,
  title,
  loading,
  exerciseOptions,
  muscleGroups,
  equipmentOptions,
  initialSelectedIds = [],
  multiSelect = true,
  onClose,
  onConfirm,

  // controlled search + filters
  search,
  onChangeSearch,

  selectedMuscleGroups,
  toggleMuscleGroup,
  muscleFilterOpen,
  setMuscleFilterOpen,

  selectedEquipment,
  toggleEquipment,
  equipmentFilterOpen,
  setEquipmentFilterOpen,

  alreadyInWorkoutIds,
  usageByExerciseId,

  // replace-mode
  isReplaceMode = false,
  replacingExerciseId = null,

  // favourites
  userId,

  styles: s,
  colors,
  safeAreaTop,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  // favourites state
  const [favLoading, setFavLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);

  // so the new exercise appears immediately even before parent refetches
  const [createdOptions, setCreatedOptions] = useState<ExerciseOption[]>([]);

  useEffect(() => {
    if (!visible) setCreatedOptions([]);
  }, [visible]);

  const alreadyInSet = useMemo(
    () => new Set(alreadyInWorkoutIds),
    [alreadyInWorkoutIds]
  );

  // keep selection in sync when opening
  useEffect(() => {
    if (visible) setSelectedIds(initialSelectedIds);
  }, [visible, initialSelectedIds]);

  // reset fav filter when opening
  useEffect(() => {
    if (visible) setFavoritesOnly(false);
  }, [visible]);

  // fetch favourites on open
  useEffect(() => {
    let alive = true;

    if (!visible) return;
    if (!userId) {
      setFavoriteIds(new Set());
      return;
    }

    (async () => {
      setFavLoading(true);
      try {
        const { data, error } = await supabase
          .from(FAV_TABLE)
          .select("exercise_id")
          .eq("user_id", userId);

        if (error) {
          console.warn("exercise favorites load error", error);
          if (alive) setFavoriteIds(new Set());
          return;
        }

        const next = new Set(
          (data ?? []).map((x: any) => x.exercise_id as string)
        );
        if (alive) setFavoriteIds(next);
      } finally {
        if (alive) setFavLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, userId]);

  const L = useMemo(() => local(colors), [colors]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      if (!multiSelect) return exists ? [] : [id];
      return exists ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  // optimistic toggle favourite
  const toggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!userId) return;

      const isFav = favoriteIds.has(exerciseId);

      // optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(exerciseId);
        else next.add(exerciseId);
        return next;
      });

      try {
        if (isFav) {
          const { error } = await supabase
            .from(FAV_TABLE)
            .delete()
            .eq("user_id", userId)
            .eq("exercise_id", exerciseId);

          if (error) throw error;
        } else {
          const { error } = await supabase.from(FAV_TABLE).insert({
            user_id: userId,
            exercise_id: exerciseId,
          });

          if (error) throw error;
        }
      } catch (e) {
        console.warn("toggle favorite failed", e);

        // rollback
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(exerciseId);
          else next.delete(exerciseId);
          return next;
        });
      }
    },
    [userId, favoriteIds]
  );

  const mergedExerciseOptions = useMemo(() => {
    // de-dupe by id (created options win)
    const map = new Map<string, ExerciseOption>();
    for (const ex of exerciseOptions) map.set(ex.id, ex);
    for (const ex of createdOptions) map.set(ex.id, ex);
    return Array.from(map.values());
  }, [exerciseOptions, createdOptions]);

  // Local filtering: search + equipment + favourites-only
  // (muscle filter assumed to be handled upstream in the parent query)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const out = mergedExerciseOptions.filter((ex) => {
      if (favoritesOnly && !favoriteIds.has(ex.id)) return false;

      const matchesSearch =
        !q ||
        (ex.name ?? "").toLowerCase().includes(q) ||
        (ex.type || "").toLowerCase().includes(q) ||
        (ex.equipment || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedEquipment.length) {
        const eq = (ex.equipment || "").toLowerCase();
        const ok = selectedEquipment.some((x) => x.toLowerCase() === eq);
        if (!ok) return false;
      }

      return true;
    });

    out.sort((a, b) => {
      const aId = a.id;
      const bId = b.id;

      // 0) replace target at very top (replace mode only)
      const aRep = isReplaceMode && replacingExerciseId === aId ? 1 : 0;
      const bRep = isReplaceMode && replacingExerciseId === bId ? 1 : 0;
      if (aRep !== bRep) return bRep - aRep;

      // 1) already in workout
      const aIn = alreadyInSet.has(aId) ? 1 : 0;
      const bIn = alreadyInSet.has(bId) ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;

      // 2) favourites
      const aFav = favoriteIds.has(aId) ? 1 : 0;
      const bFav = favoriteIds.has(bId) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const q2 = search.trim().toLowerCase();
      const an = (a.name ?? "").toLowerCase();
      const bn = (b.name ?? "").toLowerCase();

      // 4) searching relevance (only when searching)
      if (q2) {
        const aStarts = an.startsWith(q2) ? 1 : 0;
        const bStarts = bn.startsWith(q2) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aIdx = an.indexOf(q2);
        const bIdx = bn.indexOf(q2);
        const aHas = aIdx >= 0 ? 1 : 0;
        const bHas = bIdx >= 0 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        if (aHas && bHas && aIdx !== bIdx) return aIdx - bIdx;
        // if search ties, fall through to usage + alpha
      }

      // 3) used before (sessions_count desc)
      const usage = usageByExerciseId ?? {};
      const aUse = usage[aId] ?? 0;
      const bUse = usage[bId] ?? 0;
      if (aUse !== bUse) return bUse - aUse;

      // 5) alphabetical
      return an.localeCompare(bn);
    });

    return out;
  }, [
    exerciseOptions,
    search,
    selectedEquipment,
    favoritesOnly,
    favoriteIds,
    alreadyInSet,
    usageByExerciseId,
    isReplaceMode,
    replacingExerciseId,
  ]);

  const canConfirm = selectedIds.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          s.modalSafeArea,
          { paddingTop: safeAreaTop, backgroundColor: colors.background },
        ]}
      >
        {/* Header */}
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[s.modalClose, { color: colors.primary }]}>Close</Text>
          </Pressable>
        </View>

        {/* Search */}
        <TextInput
          value={search}
          onChangeText={onChangeSearch}
          placeholder="Search exercises…"
          placeholderTextColor={colors.subtle}
          style={[
            s.modalSearchInput,
            { color: colors.text, backgroundColor: colors.surface },
          ]}
        />

        {/* Filter bar */}
        <View style={L.filterWrap}>
          <View style={L.filterBar}>
            <Pressable
              onPress={() => setMuscleFilterOpen(!muscleFilterOpen)}
              style={[
                L.filterPill,
                muscleFilterOpen && {
                  backgroundColor: colors.primaryBg ?? colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              hitSlop={8}
            >
              <Text
                style={[
                  L.filterPillLabel,
                  muscleFilterOpen && { color: colors.primaryText ?? "#fff" },
                ]}
              >
                Muscles
              </Text>

              {!!selectedMuscleGroups.length && (
                <Text
                  style={[
                    L.filterPillCount,
                    muscleFilterOpen && { color: colors.primaryText ?? "#fff" },
                  ]}
                >
                  {selectedMuscleGroups.length}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setEquipmentFilterOpen(!equipmentFilterOpen)}
              style={[
                L.filterPill,
                equipmentFilterOpen && {
                  backgroundColor: colors.primaryBg ?? colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              hitSlop={8}
            >
              <Text
                style={[
                  L.filterPillLabel,
                  equipmentFilterOpen && {
                    color: colors.primaryText ?? "#fff",
                  },
                ]}
              >
                Equipment
              </Text>

              {!!selectedEquipment.length && (
                <Text
                  style={[
                    L.filterPillCount,
                    equipmentFilterOpen && {
                      color: colors.primaryText ?? "#fff",
                    },
                  ]}
                >
                  {selectedEquipment.length}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                if (!userId) return;
                setFavoritesOnly((v) => !v);
              }}
              style={[
                L.filterPill,
                favoritesOnly && {
                  backgroundColor: colors.primaryBg ?? colors.primary,
                  borderColor: colors.primary,
                },
                !userId && { opacity: 0.5 },
              ]}
              hitSlop={8}
            >
              <Text
                style={[
                  L.filterPillLabel,
                  favoritesOnly && { color: colors.primaryText ?? "#fff" },
                ]}
              >
                Favourites
              </Text>

              {favLoading ? (
                <Text
                  style={[
                    L.filterPillCount,
                    favoritesOnly && { color: colors.primaryText ?? "#fff" },
                  ]}
                >
                  …
                </Text>
              ) : null}
            </Pressable>
          </View>

          <Text style={L.filterSummaryText}>
            {selectedMuscleGroups.length
              ? `${selectedMuscleGroups.length} muscle group${
                  selectedMuscleGroups.length === 1 ? "" : "s"
                }`
              : "No Muscles"}
            {" · "}
            {selectedEquipment.length
              ? `${selectedEquipment.length} equipment option${
                  selectedEquipment.length === 1 ? "" : "s"
                }`
              : "No Equipment"}
            {" · "}
            {favoritesOnly ? "Favourites only" : "All exercises"}
          </Text>
        </View>

        {muscleFilterOpen && (
          <View style={L.chipSection}>
            <View style={L.chipGrid}>
              {muscleGroups.map((g) => {
                const active = selectedMuscleGroups.includes(g.id);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => toggleMuscleGroup(g.id)}
                    style={[
                      L.chip,
                      active && {
                        backgroundColor: colors.primaryBg ?? colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        L.chipLabel,
                        active && {
                          color: colors.primaryText ?? "#fff",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {equipmentFilterOpen && (
          <View style={L.chipSection}>
            <View style={L.chipGrid}>
              {equipmentOptions.map((eq) => {
                const active = selectedEquipment.includes(eq);
                return (
                  <Pressable
                    key={eq}
                    onPress={() => toggleEquipment(eq)}
                    style={[
                      L.chip,
                      active && {
                        backgroundColor: colors.primaryBg ?? colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        L.chipLabel,
                        active && {
                          color: colors.primaryText ?? "#fff",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {capFirst(eq)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ✅ CTA below chips & above list */}
        <View style={L.ctaWrap}>
          <Text style={L.ctaTitle}>Can’t find what you need?</Text>
          <Text style={L.ctaSub}>
            Create a custom exercise and it’ll show up in your list.
          </Text>

          <Pressable
            onPress={() => {
              if (!userId)
                return Alert.alert(
                  "Please log in",
                  "You need to be logged in to create exercises."
                );
              setCreateVisible(true);
            }}
            style={L.ctaBtn}
            hitSlop={10}
          >
            <Text style={L.ctaBtnText}>＋ Create exercise</Text>
          </Pressable>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              const isFav = favoriteIds.has(item.id);

              const isInWorkout = alreadyInSet.has(item.id);
              const isReplacing =
                isReplaceMode && replacingExerciseId === item.id;

              // Always disable selecting duplicates
              const isDisabledPick = isInWorkout;

              const usage = usageByExerciseId ?? {};
              const used = usage[item.id] ?? 0;

              return (
                <Pressable
                  onPress={() => {
                    if (isDisabledPick) return;
                    toggleId(item.id);
                  }}
                  disabled={isDisabledPick}
                  style={[
                    s.modalRow,

                    isSelected && {
                      borderColor: colors.primary,
                      backgroundColor: colors.card,
                    },

                    // already in workout style
                    isInWorkout && {
                      opacity: 0.55,
                      borderStyle: "dashed",
                    },

                    // replace target style (dim red)
                    isReplacing && {
                      opacity: 0.7,
                      borderColor: colors.danger ?? "#ef4444",
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.modalExerciseName,
                        isSelected && { color: colors.primary },
                        isReplacing && { color: colors.danger ?? "#ef4444" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name ?? "Exercise"}
                    </Text>
                    <Text style={s.modalExerciseMeta}>
                      {item.type || ""}
                      {item.equipment ? ` • ${capFirst(item.equipment)}` : ""}
                      {` • used ${used}x`}
                    </Text>

                    {isReplacing || isInWorkout ? (
                      <View
                        style={{ flexDirection: "row", gap: 8, marginTop: 6 }}
                      >
                        {isReplacing ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: colors.danger ?? "#ef4444",
                              opacity: 0.25,
                              borderWidth: 1,
                              borderColor: colors.danger ?? "#ef4444",
                            }}
                          >
                            <Text
                              style={{
                                color: colors.danger ?? "#ef4444",
                                fontSize: 11,
                                fontWeight: "900",
                              }}
                            >
                              Replacing
                            </Text>
                          </View>
                        ) : null}

                        {isInWorkout ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.subtle,
                                fontSize: 11,
                                fontWeight: "800",
                              }}
                            >
                              In workout
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* ⭐ favourite */}
                  <Pressable
                    onPress={() => toggleFavorite(item.id)}
                    hitSlop={10}
                    disabled={!userId}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      opacity: !userId ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: isFav ? colors.primary : colors.subtle,
                      }}
                    >
                      {isFav ? "★" : "☆"}
                    </Text>
                  </Pressable>

                  {/* checkbox */}
                  <View
                    style={[
                      s.checkbox,
                      {
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: isSelected
                          ? colors.primary
                          : "transparent",
                        opacity: isDisabledPick ? 0.4 : 1,
                      },
                    ]}
                  >
                    {isSelected && (
                      <Text
                        style={{
                          color: colors.subtle,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Confirm */}
        <Pressable
          style={[
            s.modalDoneBtn,
            {
              backgroundColor: canConfirm ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
          disabled={!canConfirm}
          onPress={() => onConfirm(selectedIds)}
        >
          <Text
            style={{
              color: canConfirm ? colors.subtle ?? "#fff" : colors.subtle,
              fontWeight: "700",
            }}
          >
            {multiSelect
              ? `Add ${selectedIds.length} exercise${
                  selectedIds.length === 1 ? "" : "s"
                }`
              : "Select exercise"}
          </Text>
        </Pressable>
        <CreateExerciseModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          userId={userId ?? ""}
          colors={colors}
          safeAreaTop={safeAreaTop}
          equipmentOptions={equipmentOptions}
          onCreated={(ex: CreatedExercise) => {
            // 1) close create modal
            setCreateVisible(false);

            // 2) inject into list instantly
            const opt: ExerciseOption = {
              id: ex.id,
              name: ex.name,
              type: ex.type,
              equipment: ex.equipment,
            };
            setCreatedOptions((prev) => [opt, ...prev]);

            // 3) auto-select it
            setSelectedIds((prev) => {
              if (prev.includes(ex.id)) return prev;
              if (!multiSelect) return [ex.id];
              return [...prev, ex.id];
            });

            // 4) make it easy to see (optional)
            onChangeSearch(ex.name ?? "");
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
