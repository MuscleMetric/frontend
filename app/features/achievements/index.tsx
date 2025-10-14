// app/(tabs)/achievements.tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { router } from "expo-router";

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

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);

        const [{ data: all, error: e1 }, { data: mine, error: e2 }] =
          await Promise.all([
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

        if (!e1 && all) setList(all as Achievement[]);
        if (!e2 && mine)
          setUnlockedIds(new Set(mine.map((m: any) => m.achievement_id)));
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
      <View style={s.center}>
        <Text>Please sign in.</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <Text>Testing</Text>
    </View>
  );
}

function AchievementCard({
  a,
  unlocked,
}: {
  a: Achievement;
  unlocked: boolean;
}) {
  const badge = diffBadge(a.difficulty);
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
            unlocked ? { color: "#22c55e" } : { color: "#9ca3af" },
          ]}
        >
          {unlocked ? "Unlocked ✓" : "Locked"}
        </Text>
      </View>
    </View>
  );
}

/* ---------- styles & utils ---------- */
const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: { fontSize: 20, fontWeight: "800" },
  subtle: { color: "#6b7280", marginTop: 6 },
  link: { color: "#2563eb", fontWeight: "700", width: 52 },

  card: {
    flex: 1,
    minHeight: 140,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
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
  cat: { color: "#6b7280", fontSize: 12 },
  title: { fontWeight: "800", marginBottom: 4 },
  desc: { color: "#4b5563", fontSize: 12 },
  lockRow: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  lock: { fontWeight: "700" },
});

function diffBadge(d: Achievement["difficulty"]) {
  switch (d) {
    case "easy":
      return { bg: "#e6f6ea", fg: "#16a34a", label: "EASY" };
    case "medium":
      return { bg: "#e6f0ff", fg: "#2563eb", label: "MEDIUM" };
    case "hard":
      return { bg: "#fff4e6", fg: "#f59e0b", label: "HARD" };
    case "elite":
      return { bg: "#fee2e2", fg: "#ef4444", label: "ELITE" };
    case "legendary":
      return { bg: "#f3e8ff", fg: "#7c3aed", label: "LEGEND" };
    default:
      return { bg: "#e5e7eb", fg: "#111827", label: "—" };
  }
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
