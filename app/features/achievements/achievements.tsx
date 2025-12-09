// app/(tabs)/achievements.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { router } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: "strength" | "endurance" | "consistency" | "skill" | "general";
  difficulty: "easy" | "medium" | "hard" | "elite" | "legendary";
};

type FilterMode = "all" | "unlocked" | "locked";

export default function AchievementsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);

        const [{ data: all }, { data: mine }] = await Promise.all([
          supabase
            .from("achievements")
            .select("id, code, title, description, category, difficulty")
            .order("difficulty")
            .order("category"),
          supabase
            .from("user_achievements")
            .select("achievement_id")
            .eq("user_id", userId),
        ]);

        if (all) setList(all as Achievement[]);
        if (mine)
          setUnlockedIds(new Set(mine.map((m: any) => m.achievement_id)));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const counts = useMemo(() => {
    const total = list.length;
    const unlocked = list.filter((a) => unlockedIds.has(a.id)).length;
    const locked = total - unlocked;
    return {
      total,
      unlocked,
      locked,
      pct: total ? Math.round((unlocked / total) * 100) : 0,
    };
  }, [list, unlockedIds]);

  const filtered = useMemo(() => {
    // 1) base on filter mode
    const base =
      mode === "unlocked"
        ? list.filter((a) => unlockedIds.has(a.id))
        : mode === "locked"
        ? list.filter((a) => !unlockedIds.has(a.id))
        : list.slice();

    // 2) apply search filter (title + description + category)
    const q = search.trim().toLowerCase();
    const searched = q
      ? base.filter((a) => {
          return (
            a.title.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
          );
        })
      : base;

    // 3) stable sort: difficulty → category → title
    const diffRank: Record<Achievement["difficulty"], number> = {
      easy: 1,
      medium: 2,
      hard: 3,
      elite: 4,
      legendary: 5,
    };
    return searched.sort((a, b) => {
      const d = diffRank[a.difficulty] - diffRank[b.difficulty];
      if (d !== 0) return d;
      const c = a.category.localeCompare(b.category);
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    });
  }, [list, unlockedIds, mode, search]);

  if (!userId) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Please sign in.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          backgroundColor: colors.background,
        }}
      >
        {/* Header row – matches new screens style */}
        <View style={s.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [s.backButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.backIcon}>‹</Text>
            <Text style={s.backLabel}>Back</Text>
          </Pressable>

          <Text style={s.header}>Achievements</Text>
          {/* spacer to balance layout */}
          <View style={{ width: 68 }} />
        </View>

        {/* Summary line */}
        <Text style={s.subtle}>
          Unlocked {counts.unlocked} of {counts.total} ({counts.pct}%)
        </Text>

        {/* Search + filter row */}
        <View style={s.searchFilterRow}>
          <View style={s.filterRow}>
            <FilterPill
              label={`All`}
              count={counts.total}
              active={mode === "all"}
              onPress={() => setMode("all")}
              colors={colors}
            />
            <FilterPill
              label={`Unlocked`}
              count={counts.unlocked}
              active={mode === "unlocked"}
              onPress={() => setMode("unlocked")}
              colors={colors}
            />
            <FilterPill
              label={`Locked`}
              count={counts.locked}
              active={mode === "locked"}
              onPress={() => setMode("locked")}
              colors={colors}
            />
          </View>
        </View>
      </SafeAreaView>

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        data={filtered}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => {
          const unlocked = unlockedIds.has(item.id);
          return <AchievementCard a={item} unlocked={unlocked} />;
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No achievements found</Text>
            <Text style={s.emptyText}>
              Try changing your filters or search term.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function FilterPill({
  label,
  count,
  active,
  onPress,
  colors,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          marginRight: 8,
          backgroundColor: active ? colors.primaryBg : "transparent",
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primaryText ?? "#fff" : colors.text,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: active ? colors.primaryText ?? "#fff" : colors.subtle,
          fontSize: 11,
          fontWeight: "600",
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function AchievementCard({
  a,
  unlocked,
}: {
  a: Achievement;
  unlocked: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const badge = diffBadge(a.difficulty, colors);

  return (
    <View style={[s.card, !unlocked && { opacity: 0.55 }]}>
      <View style={s.badgeRow}>
        <Text style={[s.badge, { backgroundColor: badge.bg, color: badge.fg }]}>
          {badge.label}
        </Text>
        <Text style={s.cat}>{capitalize(a.category)}</Text>
      </View>

      <Text style={s.title}>{a.title}</Text>
      <Text style={s.desc}>{a.description}</Text>

      <View style={s.lockRow}>
        <Text
          style={[
            s.lock,
            {
              color: unlocked
                ? colors.successText ?? "#16a34a"
                : colors.subtle ?? "#9ca3af",
            },
          ]}
        >
          {unlocked ? "Unlocked ✓" : "Locked"}
        </Text>
      </View>
    </View>
  );
}

/* ---------- themed styles & utils ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    header: { fontSize: 20, fontWeight: "800", color: colors.text },

    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingRight: 6,
    },
    backIcon: {
      fontSize: 20,
      color: colors.text,
      marginBottom: -2,
    },
    backLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },

    subtle: { color: colors.subtle, marginTop: 2, fontSize: 12 },

    searchFilterRow: {
      marginTop: 10,
    },

    searchContainer: {
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },

    filterRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    card: {
      flex: 1,
      minHeight: 130,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      overflow: "hidden",
      fontWeight: "800",
      fontSize: 11,
    },
    cat: { color: colors.subtle, fontSize: 12 },
    title: {
      fontWeight: "800",
      marginBottom: 4,
      color: colors.text,
      fontSize: 14,
    },
    desc: {
      color: colors.text,
      opacity: 0.9,
      fontSize: 12,
      marginTop: 2,
    },
    lockRow: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    lock: { fontWeight: "700", fontSize: 12 },

    empty: {
      alignItems: "center",
      marginTop: 40,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 13,
      color: colors.subtle,
      textAlign: "center",
      paddingHorizontal: 16,
    },
  });

function diffBadge(
  d: Achievement["difficulty"],
  colors: any
): { bg: string; fg: string; label: string } {
  switch (d) {
    case "easy":
      return {
        bg: colors.successBg ?? "#22c55e22",
        fg: colors.successText ?? "#16a34a",
        label: "EASY",
      };
    case "medium":
      return {
        bg: colors.primaryBg ?? "#3b82f622",
        fg: colors.primaryText ?? colors.primary ?? "#3b82f6",
        label: "MEDIUM",
      };
    case "hard":
      return {
        bg: colors.warnBg ?? "#f59e0b22",
        fg: colors.warnText ?? "#f59e0b",
        label: "HARD",
      };
    case "elite":
      return {
        bg: (colors.danger ?? "#ef4444") + "22",
        fg: colors.danger ?? "#ef4444",
        label: "ELITE",
      };
    case "legendary":
      return {
        bg: (colors.notification ?? "#8b5cf6") + "22",
        fg: colors.notification ?? "#8b5cf6",
        label: "LEGEND",
      };
    default:
      return { bg: colors.surface ?? colors.card, fg: colors.text, label: "—" };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
