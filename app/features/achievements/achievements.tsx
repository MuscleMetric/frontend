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

export default function AchievementsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

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
    return {
      total,
      unlocked,
      pct: total ? Math.round((unlocked / total) * 100) : 0,
    };
  }, [list, unlockedIds]);

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
      </SafeAreaView>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={list}
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
      // purple-ish using primary as base; tweak if you add a dedicated "purple" to theme
      return { bg: `${colors.notification}22`, fg: colors.notification, label: "LEGEND" };
    default:
      return { bg: colors.surface, fg: colors.text, label: "—" };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
