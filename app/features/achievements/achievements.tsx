// app/(tabs)/achievements.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
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
        if (mine) setUnlockedIds(new Set(mine.map((m: any) => m.achievement_id)));
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
    const base =
      mode === "unlocked"
        ? list.filter((a) => unlockedIds.has(a.id))
        : mode === "locked"
        ? list.filter((a) => !unlockedIds.has(a.id))
        : list.slice();

    // stable sort: by difficulty (easy→legendary), then category, then title
    const diffRank: Record<Achievement["difficulty"], number> = {
      easy: 1,
      medium: 2,
      hard: 3,
      elite: 4,
      legendary: 5,
    };
    return base.sort((a, b) => {
      const d = diffRank[a.difficulty] - diffRank[b.difficulty];
      if (d !== 0) return d;
      const c = a.category.localeCompare(b.category);
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    });
  }, [list, unlockedIds, mode]);

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
        style={{ paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.background }}
      >
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.link}>← Back</Text>
          </Pressable>
          <Text style={s.header}>Achievements</Text>
          <View style={{ width: 52 }} />
        </View>

        <Text style={s.subtle}>
          Unlocked {counts.unlocked} of {counts.total} ({counts.pct}%)
        </Text>

        {/* Filter pills */}
        <View style={s.filterRow}>
          <FilterPill
            label={`All (${counts.total})`}
            active={mode === "all"}
            onPress={() => setMode("all")}
            colors={colors}
          />
          <FilterPill
            label={`Unlocked (${counts.unlocked})`}
            active={mode === "unlocked"}
            onPress={() => setMode("unlocked")}
            colors={colors}
          />
          <FilterPill
            label={`Locked (${counts.locked})`}
            active={mode === "locked"}
            onPress={() => setMode("locked")}
            colors={colors}
          />
        </View>
      </SafeAreaView>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={filtered}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => {
          const unlocked = unlockedIds.has(item.id);
          return <AchievementCard a={item} unlocked={unlocked} />;
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          marginRight: 8,
          backgroundColor: active ? colors.primaryBg : "transparent",
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primaryText : colors.text,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AchievementCard({ a, unlocked }: { a: Achievement; unlocked: boolean }) {
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
        <Text style={[s.lock, { color: unlocked ? colors.successText : colors.muted }]}>
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
    },
    header: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtle: { color: colors.subtle, marginTop: 6 },
    link: { color: colors.primaryText, fontWeight: "700", width: 52 },

    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },

    card: {
      flex: 1,
      minHeight: 140,
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
    title: { fontWeight: "800", marginBottom: 4, color: colors.text },
    desc: { color: colors.text, opacity: 0.9, fontSize: 12 },
    lockRow: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
    lock: { fontWeight: "700" },
  });

function diffBadge(
  d: Achievement["difficulty"],
  colors: any
): { bg: string; fg: string; label: string } {
  switch (d) {
    case "easy":
      return { bg: colors.successBg, fg: colors.successText, label: "EASY" };
    case "medium":
      return { bg: colors.primaryBg, fg: colors.primaryText, label: "MEDIUM" };
    case "hard":
      return { bg: colors.warnBg, fg: colors.warnText, label: "HARD" };
    case "elite":
      return { bg: `${colors.danger}22`, fg: colors.danger, label: "ELITE" };
    case "legendary":
      return { bg: `${colors.notification}22`, fg: colors.notification, label: "LEGEND" };
    default:
      return { bg: colors.surface, fg: colors.text, label: "—" };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
