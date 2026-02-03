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
} from "react-native";
import { ModalSheet, Pill, Icon } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";
import { fetchExercises, type ExerciseListItem } from "../data/exercises.query";

type Props = {
  visible: boolean;
  userId: string;
  selectedIds: string[];
  onClose: () => void;
  onDone: (picked: Array<{ exerciseId: string; name: string }>) => void;
  // default these ON so chips appear unless you explicitly disable
  enableMuscleFilter?: boolean;
  enableEquipmentFilter?: boolean;
};

type Chip = { key: string; label: string };

const FOOTER_H = 72;

const MUSCLE_CHIPS: Chip[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "legs", label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
];

const EQUIP_CHIPS: Chip[] = [
  { key: "barbell", label: "Barbell" },
  { key: "dumbbell", label: "Dumbbells" },
  { key: "machine", label: "Machine" },
  { key: "cable", label: "Cable" },
  { key: "bw", label: "Bodyweight" },
];

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

  // give the sheet content a stable height so the footer can truly stick
  const windowH = Dimensions.get("window").height;
  const SHEET_H = Math.min(550, Math.round(windowH * 0.72));

  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setPicked(new Set(selectedIds));
  }, [visible, selectedIds]);

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

  const togglePicked = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const countAdded = picked.size;

  const onPressAdd = useCallback(() => {
    const pickedItems = items
      .filter((x) => picked.has(x.id))
      .map((x) => ({ exerciseId: x.id, name: x.name }));

    onDone(pickedItems);
    onClose();
  }, [picked, onDone, onClose]);

  const toggleFavourite = useCallback(
    async (exerciseId: string) => {
      // compute from current list
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

  const topChips: Chip[] = [
    { key: "favs", label: "Favourites" },
    ...(enableMuscleFilter ? MUSCLE_CHIPS : []),
    ...(enableEquipmentFilter ? EQUIP_CHIPS : []),
  ];

  const isChipActive = (key: string) => {
    if (key === "favs") return favouritesOnly;

    // muscle
    if (enableMuscleFilter) {
      const map: Record<string, string> = {
        chest: "Chest",
        back: "Back",
        legs: "Legs",
        shoulders: "Shoulders",
        arms: "Arms",
        core: "Core",
      };
      if (map[key]) return muscle === map[key];
    }

    // equipment
    if (enableEquipmentFilter) {
      const map: Record<string, string> = {
        barbell: "barbell",
        dumbbell: "dumbbell",
        machine: "machine",
        cable: "cable",
        bw: "bodyweight",
      };
      if (map[key]) return equipment === map[key];
    }

    return false;
  };

  const onChipPress = (key: string) => {
    if (key === "favs") {
      setFavouritesOnly((v) => !v);
      return;
    }

    if (enableMuscleFilter) {
      const map: Record<string, string> = {
        chest: "Chest",
        back: "Back",
        legs: "Legs",
        shoulders: "Shoulders",
        arms: "Arms",
        core: "Core",
      };
      if (map[key]) {
        setMuscle((m) => (m === map[key] ? null : map[key]));
        return;
      }
    }

    if (enableEquipmentFilter) {
      const map: Record<string, string> = {
        barbell: "barbell",
        dumbbell: "dumbbell",
        machine: "machine",
        cable: "cable",
        bw: "bodyweight",
      };
      if (map[key]) {
        setEquipment((e) => (e === map[key] ? null : map[key]));
        return;
      }
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Add Exercises">
      {/* Fixed height container = sticky footer actually sticks */}
      <View
        style={{
          height: SHEET_H,
          paddingHorizontal: layout.space.md,
          paddingTop: layout.space.md,
        }}
      >
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
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Chips */}
        <View style={[styles.chipsRow, { marginTop: layout.space.md }]}>
          {topChips.map((c) => {
            const active = isChipActive(c.key);
            return (
              <Pressable key={c.key} onPress={() => onChipPress(c.key)}>
                <Pill label={c.label} tone={active ? "primary" : "neutral"} />
              </Pressable>
            );
          })}
        </View>

        {/* List area (scrolls) */}
        <View style={{ flex: 1, marginTop: layout.space.md }}>
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: FOOTER_H + layout.space.md,
            }}
          >
            {loading ? (
              <View style={{ paddingVertical: layout.space.lg }}>
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={{ paddingVertical: layout.space.lg }}>
                <Text style={styles.muted}>No exercises found.</Text>
              </View>
            ) : (
              items.map((item) => {
                const checked = picked.has(item.id);
                const primaryMuscle =
                  (item.muscleNames && item.muscleNames[0]) || "—";
                const used = item.sessionsCount ?? 0;
                const fav = !!item.isFavourite;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => togglePicked(item.id)}
                    style={styles.itemRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {primaryMuscle}
                        {item.equipment ? ` • ${item.equipment}` : ""}
                        {` • Used ${used}`}
                      </Text>
                    </View>

                    {/* Star toggle (big hit target) */}
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

        {/* Sticky footer (always visible) */}
        <View style={[styles.stickyFooter, { height: FOOTER_H }]}>
          <Text style={styles.footerLeft}>
            Selected <Text style={styles.strong}>{countAdded}</Text>
          </Text>

          <View style={{ flexDirection: "row", gap: layout.space.sm }}>
            <Pressable onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={onPressAdd}
              style={[
                styles.primaryBtn,
                countAdded === 0 ? styles.primaryBtnDisabled : null,
              ]}
              disabled={countAdded === 0}
            >
              <Text style={styles.primaryText}>Add ({countAdded})</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
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
      paddingVertical: 10,
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
    },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      paddingVertical: 10,
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
