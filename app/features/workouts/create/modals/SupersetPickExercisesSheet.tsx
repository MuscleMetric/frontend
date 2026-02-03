// app/features/workouts/create/modals/SupersetPickExercisesSheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
} from "react-native";
import { ModalSheet, Icon } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";

type WorkoutExerciseLite = {
  key: string;
  name: string;
  supersetGroup: string | null;
};

type Props = {
  visible: boolean;
  anchorName: string;
  group: string; // "A", "B", ...
  // only current workout exercises
  items: WorkoutExerciseLite[];
  // anchor row key (exclude from list)
  anchorKey: string;
  // if true, user must choose at least 1 partner
  requireAtLeastOne?: boolean;

  onClose: () => void;
  onApply: (pickedKeys: string[]) => void;
};

export default function SupersetPickExercisesSheet({
  visible,
  anchorName,
  group,
  items,
  anchorKey,
  requireAtLeastOne = false,
  onClose,
  onApply,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const normalizedGroup = String(group ?? "").toUpperCase();

  // ✅ Seed picked with current members of this group (excluding anchor)
  useEffect(() => {
    if (!visible) return;

    setQuery("");

    const preselected = new Set<string>();
    (items ?? []).forEach((x) => {
      if (x.key === anchorKey) return;

      const g = x.supersetGroup ? String(x.supersetGroup).toUpperCase() : null;
      if (g && g === normalizedGroup) preselected.add(String(x.key));
    });

    setPicked(preselected);
  }, [visible, items, anchorKey, normalizedGroup]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter((x) => x.key !== anchorKey)
      .filter((x) => (q ? x.name.toLowerCase().includes(q) : true));
  }, [items, anchorKey, query]);

  const toggle = (k: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const count = picked.size;
  const canApply = requireAtLeastOne ? count > 0 : true;

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={`Superset ${normalizedGroup}`}
    >
      <View
        style={{
          paddingHorizontal: layout.space.md,
          paddingBottom: layout.space.md,
          gap: layout.space.md,
        }}
      >
        <Text style={styles.muted}>
          Add exercises to <Text style={styles.strong}>Superset {normalizedGroup}</Text>{" "}
          with <Text style={styles.strong}>{anchorName}</Text>.
        </Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises in this workout..."
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

        {/* List */}
        <ScrollView
          style={{ maxHeight: 420 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: layout.space.sm }}
        >
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: layout.space.lg }}>
              <Text style={styles.muted}>No matching exercises.</Text>
            </View>
          ) : (
            filtered.map((it) => {
              const checked = picked.has(it.key);

              const g = it.supersetGroup ? String(it.supersetGroup).toUpperCase() : null;
              const alreadyInThisGroup = g === normalizedGroup;

              return (
                <Pressable
                  key={it.key}
                  onPress={() => toggle(it.key)}
                  style={styles.row}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {alreadyInThisGroup
                        ? `In Superset ${normalizedGroup}`
                        : g
                        ? `Currently Superset ${g}`
                        : "Not in a superset"}
                    </Text>
                  </View>

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

        {requireAtLeastOne ? (
          <Text style={styles.hint}>
            Pick at least <Text style={styles.strong}>1</Text> exercise to create a superset.
          </Text>
        ) : null}

        {/* Footer */}
        <View style={{ flexDirection: "row", gap: layout.space.sm }}>
          <Pressable onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={() => onApply(Array.from(picked))}
            disabled={!canApply}
            style={[styles.primaryBtn, !canApply ? styles.primaryBtnDisabled : null]}
          >
            <Text style={styles.primaryText}>Save ({count})</Text>
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    muted: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    strong: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },
    hint: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
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

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
    meta: {
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

    secondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryText: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },

    primaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    primaryBtnDisabled: {
      opacity: 0.45,
    },
    primaryText: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
  });
