import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from "react-native";
import { ModalSheet, Pill, Icon } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { fetchExercises, type ExerciseListItem } from "../data/exercises.query";

type Props = {
  visible: boolean;
  userId: string;
  selectedIds: string[]; // current selection in parent
  onClose: () => void;
  onDone: (nextSelectedIds: string[]) => void;

  // optional: if you want to show extra filter chips in future
  enableMuscleFilter?: boolean;
  enableEquipmentFilter?: boolean;
};

type Chip = { key: string; label: string };

export default function AddExercisesSheet({
  visible,
  userId,
  selectedIds,
  onClose,
  onDone,
  enableMuscleFilter = false,
  enableEquipmentFilter = false,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  // optional filters (off by default)
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // open -> seed selection
  useEffect(() => {
    if (!visible) return;
    setPicked(new Set(selectedIds));
    // don’t wipe query each time unless you want to:
    // setQuery("");
    // setFavouritesOnly(false);
  }, [visible, selectedIds]);

  // load
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
            limit: 80,
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

    // tiny debounce
    const t = setTimeout(load, 160);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, userId, query, favouritesOnly, muscle, equipment]);

  const countAdded = picked.size;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onPressDone = () => {
    onDone(Array.from(picked));
    onClose();
  };

  const topChips: Chip[] = [
    { key: "favs", label: "Favourites" },
    ...(enableMuscleFilter
      ? [
          { key: "chest", label: "Chest" },
          { key: "back", label: "Back" },
          { key: "legs", label: "Legs" },
          { key: "shoulders", label: "Shoulders" },
          { key: "arms", label: "Arms" },
          { key: "core", label: "Core" },
        ]
      : []),
    ...(enableEquipmentFilter
      ? [
          { key: "barbell", label: "Barbell" },
          { key: "dumbbell", label: "Dumbbells" },
          { key: "machine", label: "Machine" },
          { key: "cable", label: "Cable" },
          { key: "bw", label: "Bodyweight" },
        ]
      : []),
  ];

  const isChipActive = (key: string) => {
    if (key === "favs") return favouritesOnly;

    // muscle chips (optional)
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

    // equipment chips (optional)
    if (enableEquipmentFilter) {
      const map: Record<string, string> = {
        barbell: "Barbell",
        dumbbell: "Dumbbells",
        machine: "Machine",
        cable: "Cable",
        bw: "Bodyweight",
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
        barbell: "Barbell",
        dumbbell: "Dumbbells",
        machine: "Machine",
        cable: "Cable",
        bw: "Bodyweight",
      };
      if (map[key]) {
        setEquipment((e) => (e === map[key] ? null : map[key]));
        return;
      }
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Add Exercises">
      <View style={{ paddingHorizontal: layout.space.md, paddingBottom: layout.space.md, gap: layout.space.md }}>
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
        <View style={styles.chipsRow}>
          {topChips.map((c) => {
            const active = isChipActive(c.key);
            return (
              <Pressable key={c.key} onPress={() => onChipPress(c.key)}>
                <Pill label={c.label} tone={active ? "primary" : "neutral"} />
              </Pressable>
            );
          })}
        </View>

        {/* List */}
        <View style={{ flex: 1, minHeight: 380 }}>
          <FlatList
            data={items}
            keyExtractor={(x) => x.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ paddingVertical: layout.space.lg }}>
                <Text style={styles.muted}>
                  {loading ? "Loading…" : "No exercises found."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const checked = picked.has(item.id);
              return (
                <Pressable onPress={() => toggle(item.id)} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {/* No images. Small metadata line */}
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {(item.primaryMuscle || "—")} {item.equipment ? `• ${item.equipment}` : ""}
                      {item.isFavourite ? "  ★" : ""}
                    </Text>
                  </View>

                  <View style={[styles.checkCircle, checked ? styles.checkOn : styles.checkOff]}>
                    {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
            Added <Text style={styles.strong}>{countAdded}</Text>
          </Text>

          <Pressable onPress={onPressDone} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done ✓</Text>
          </Pressable>
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

    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: layout.space.sm,
    },
    footerLeft: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
    },
    doneBtn: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.primary,
    },
    doneText: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
  });
