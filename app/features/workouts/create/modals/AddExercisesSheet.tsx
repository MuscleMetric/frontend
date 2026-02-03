// app/features/workouts/create/modals/AddExercisesSheet.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  SafeAreaView,
  Platform,
} from "react-native";
import { Pill, Icon } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";
import { fetchExercises, type ExerciseListItem } from "../data/exercises.query";

type Props = {
  visible: boolean;
  userId: string;

  /**
   * IMPORTANT: We now treat selectedIds as "already in the workout".
   * These will be shown at the top and disabled (cannot be toggled).
   */
  selectedIds: string[];

  onClose: () => void;

  /**
   * onDone returns ONLY newly picked exercises (excludes existing locked ones).
   */
  onDone: (picked: Array<{ exerciseId: string; name: string }>) => void;

  // default these ON so chips appear unless you explicitly disable
  enableMuscleFilter?: boolean;
  enableEquipmentFilter?: boolean;
};

type Chip = { key: string; label: string };

const FOOTER_H = 76;

const MUSCLE_OPTIONS: Chip[] = [
  { key: "Chest", label: "Chest" },
  { key: "Back", label: "Back" },
  { key: "Legs", label: "Legs" },
  { key: "Shoulders", label: "Shoulders" },
  { key: "Arms", label: "Arms" },
  { key: "Core", label: "Core" },
];

const EQUIP_OPTIONS: Chip[] = [
  { key: "barbell", label: "Barbell" },
  { key: "dumbbell", label: "Dumbbells" },
  { key: "machine", label: "Machine" },
  { key: "cable", label: "Cable" },
  { key: "bodyweight", label: "Bodyweight" },
];

type PickerMode = null | "muscle" | "equipment";

export default function AddExercisesSheet({
  visible,
  userId,
  selectedIds,
  onClose,
  onDone,
  enableMuscleFilter = true,
  enableEquipmentFilter = true,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const windowH = Dimensions.get("window").height;

  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExerciseListItem[]>([]);

  // locked = already in workout (disabled)
  const locked = useMemo(() => new Set(selectedIds), [selectedIds]);

  // picked = newly selected in this modal session (NOT including locked)
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;

    // reset modal state each open
    setQuery("");
    setFavouritesOnly(false);
    setMuscle(null);
    setEquipment(null);
    setPickerMode(null);
    setPicked(new Set());
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchExercises({
          userId,
          filters: {
            query,
            favouritesOnly,
            muscle,
            equipment,
            limit: 160,
          },
        });

        if (!cancelled) setItems(res);
      } catch (e) {
        console.warn("fetchExercises error:", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const t = setTimeout(load, 160);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, userId, query, favouritesOnly, muscle, equipment]);

  const togglePicked = useCallback(
    (id: string) => {
      // locked ones cannot be toggled
      if (locked.has(id)) return;

      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [locked]
  );

  const countNew = picked.size;

  const onPressAdd = useCallback(() => {
    const pickedItems = items
      .filter((x) => picked.has(x.id) && !locked.has(x.id))
      .map((x) => ({ exerciseId: x.id, name: x.name }));

    onDone(pickedItems);
    onClose();
  }, [items, picked, locked, onDone, onClose]);

  const toggleFavourite = useCallback(
    async (exerciseId: string) => {
      const current = items.find((x) => x.id === exerciseId);
      const nowFav = !(current?.isFavourite ?? false);

      // optimistic
      setItems((prev) =>
        prev.map((x) =>
          x.id === exerciseId ? { ...x, isFavourite: nowFav } : x
        )
      );

      try {
        if (nowFav) {
          const { error } = await supabase
            .from("exercise_favorites")
            .insert({ user_id: userId, exercise_id: exerciseId });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("exercise_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("exercise_id", exerciseId);
          if (error) throw error;
        }
      } catch (e) {
        // rollback
        setItems((prev) =>
          prev.map((x) =>
            x.id === exerciseId ? { ...x, isFavourite: !nowFav } : x
          )
        );
        console.warn("toggleFavourite failed:", e);
      }
    },
    [items, userId]
  );

  // sort: locked first, then picked, then rest
  const sortedItems = useMemo(() => {
    const score = (id: string) => {
      if (locked.has(id)) return 0;
      if (picked.has(id)) return 1;
      return 2;
    };

    return [...items].sort((a, b) => {
      const sa = score(a.id);
      const sb = score(b.id);
      if (sa !== sb) return sa - sb;

      // secondary: most used first (nice feel)
      const ua = a.sessionsCount ?? 0;
      const ub = b.sessionsCount ?? 0;
      if (ua !== ub) return ub - ua;

      return a.name.localeCompare(b.name);
    });
  }, [items, locked, picked]);

  const setPicker = (mode: PickerMode) => {
    setPickerMode((prev) => (prev === mode ? null : mode));
  };

  const closeModal = () => {
    // mimic sheet close behavior
    onClose();
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={closeModal} hitSlop={12} style={styles.headerIconBtn}>
        <Icon name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <Text style={styles.headerTitle}>Add Exercises</Text>

      <Pressable onPress={closeModal} hitSlop={12} style={styles.headerIconBtn}>
        <Text style={styles.headerClose}>✕</Text>
      </Pressable>
    </View>
  );

  const chips = (
    <View style={[styles.chipsRow, { marginTop: layout.space.md }]}>
      {/* Favourites */}
      <Pressable onPress={() => setFavouritesOnly((v) => !v)}>
        <Pill
          label="Favourites"
          tone={favouritesOnly ? "primary" : "neutral"}
        />
      </Pressable>

      {/* Muscle */}
      {enableMuscleFilter ? (
        <Pressable onPress={() => setPicker("muscle")}>
          <View style={styles.filterChipWrap}>
            <Pill
              label={muscle ? `Muscle: ${muscle}` : "Muscle"}
              tone={pickerMode === "muscle" || !!muscle ? "primary" : "neutral"}
            />
            {muscle ? (
              <Pressable
                onPress={(e) => {
                  (e as any)?.stopPropagation?.();
                  setMuscle(null);
                }}
                hitSlop={10}
                style={styles.clearMini}
              >
                <Text style={styles.clearMiniText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {/* Equipment */}
      {enableEquipmentFilter ? (
        <Pressable onPress={() => setPicker("equipment")}>
          <View style={styles.filterChipWrap}>
            <Pill
              label={equipment ? `Equipment: ${equipment}` : "Equipment"}
              tone={
                pickerMode === "equipment" || !!equipment
                  ? "primary"
                  : "neutral"
              }
            />
            {equipment ? (
              <Pressable
                onPress={(e) => {
                  (e as any)?.stopPropagation?.();
                  setEquipment(null);
                }}
                hitSlop={10}
                style={styles.clearMini}
              >
                <Text style={styles.clearMiniText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  const pickerPanel = (
    <View style={styles.pickerPanel}>
      {pickerMode === "muscle" ? (
        <>
          <Text style={styles.pickerTitle}>Select a muscle</Text>
          <View style={styles.pickerGrid}>
            {MUSCLE_OPTIONS.map((opt) => {
              const active = muscle === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setMuscle((m) => (m === opt.key ? null : opt.key));
                  }}
                >
                  <Pill label={opt.label} tone={active ? "primary" : "neutral"} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {pickerMode === "equipment" ? (
        <>
          <Text style={styles.pickerTitle}>Select equipment</Text>
          <View style={styles.pickerGrid}>
            {EQUIP_OPTIONS.map((opt) => {
              const active = equipment === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setEquipment((e) => (e === opt.key ? null : opt.key));
                  }}
                >
                  <Pill label={opt.label} tone={active ? "primary" : "neutral"} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeModal}
    >
      <SafeAreaView style={[styles.screen, { minHeight: windowH }]}>
        {header}

        <View style={styles.body}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Text style={styles.clear}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Chips */}
          {chips}

          {/* Picker (inline expand) */}
          {pickerMode ? (
            <View style={{ marginTop: layout.space.md }}>{pickerPanel}</View>
          ) : null}

          {/* List */}
          <View style={{ flex: 1, marginTop: layout.space.md }}>
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingBottom: FOOTER_H + layout.space.lg,
              }}
            >
              {loading ? (
                <View style={{ paddingVertical: layout.space.lg }}>
                  <Text style={styles.muted}>Loading…</Text>
                </View>
              ) : sortedItems.length === 0 ? (
                <View style={{ paddingVertical: layout.space.lg }}>
                  <Text style={styles.muted}>No exercises found.</Text>
                </View>
              ) : (
                sortedItems.map((item) => {
                  const isLocked = locked.has(item.id);
                  const isPicked = picked.has(item.id);
                  const checked = isLocked || isPicked;

                  const primaryMuscle =
                    (item.muscleNames && item.muscleNames[0]) || "—";
                  const used = item.sessionsCount ?? 0;
                  const fav = !!item.isFavourite;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => togglePicked(item.id)}
                      style={[
                        styles.itemRow,
                        isLocked ? styles.itemRowLocked : null,
                      ]}
                      disabled={isLocked}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.name}
                        </Text>

                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {primaryMuscle}
                          {item.equipment ? ` • ${item.equipment}` : ""}
                          {` • Used ${used}`}
                          {isLocked ? ` • In workout` : ""}
                        </Text>
                      </View>

                      {/* Star toggle */}
                      <Pressable
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          toggleFavourite(item.id);
                        }}
                        hitSlop={12}
                        style={styles.starBtn}
                      >
                        <Text
                          style={[
                            styles.star,
                            fav ? styles.starOn : styles.starOff,
                          ]}
                        >
                          ★
                        </Text>
                      </Pressable>

                      {/* selection */}
                      <View
                        style={[
                          styles.checkCircle,
                          checked ? styles.checkOn : styles.checkOff,
                        ]}
                      >
                        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>

        {/* Sticky footer */}
        <View style={[styles.stickyFooter, { height: FOOTER_H }]}>
          <Text style={styles.footerLeft}>
            Selected <Text style={styles.strong}>{countNew}</Text>
          </Text>

          <View style={{ flexDirection: "row", gap: layout.space.sm }}>
            <Pressable onPress={closeModal} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={onPressAdd}
              style={[
                styles.primaryBtn,
                countNew === 0 ? styles.primaryBtnDisabled : null,
              ]}
              disabled={countNew === 0}
            >
              <Text style={styles.primaryText}>Add ({countNew})</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },

    header: {
      height: 54,
      paddingHorizontal: layout.space.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
    },
    headerTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2 ?? 18,
      lineHeight: (typography.lineHeight.h2 ?? 22) as number,
      color: colors.text,
      letterSpacing: -0.2,
    },
    headerClose: {
      color: colors.textMuted,
      fontSize: 18,
      fontFamily: typography.fontFamily.bold,
    },

    body: {
      flex: 1,
      paddingHorizontal: layout.space.md,
      paddingTop: layout.space.md,
    },

    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
    strong: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.xl,
      paddingHorizontal: layout.space.md,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    clear: {
      color: colors.textMuted,
      fontSize: 16,
      fontFamily: typography.fontFamily.bold,
    },

    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: layout.space.sm,
      alignItems: "center",
    },
    filterChipWrap: {
      flexDirection: "row",
      alignItems: "center",
    },
    clearMini: {
      marginLeft: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    clearMiniText: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      lineHeight: 12,
    },

    pickerPanel: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
    },
    pickerTitle: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.6,
      marginBottom: layout.space.sm,
    },
    pickerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: layout.space.sm,
    },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemRowLocked: {
      opacity: 0.65,
    },
    itemTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
    itemMeta: {
      marginTop: 2,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    starBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
    },
    star: {
      fontSize: 20,
      lineHeight: 20,
      fontFamily: typography.fontFamily.bold,
    },
    starOn: { color: colors.primary },
    starOff: { color: colors.textMuted },

    checkCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    checkOff: {
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    checkOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkMark: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: 14,
    },

    stickyFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerLeft: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },

    secondaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryText: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },

    primaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.primary,
    },
    primaryBtnDisabled: {
      opacity: 0.45,
    },
    primaryText: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },
  });
