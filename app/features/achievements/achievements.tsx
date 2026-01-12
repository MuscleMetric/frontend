// app/features/achievements/achievements.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill, ScreenHeader } from "@/ui";

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
  const userId = session?.user?.id ?? null;

  const params = useLocalSearchParams();
  const fromProfile = params?.fromProfile === "1"

  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(() => makeStyles({ colors, typography, layout }), [colors, typography, layout]);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Achievement[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  // ✅ if arriving from profile, start on unlocked
  const [mode, setMode] = useState<FilterMode>(fromProfile ? "unlocked" : "all");
  const [search, setSearch] = useState("");

  const [profileSettings, setProfileSettings] = useState<any>({});
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [initialFavouriteIds, setInitialFavouriteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(
    () => favouriteIds.join(",") !== initialFavouriteIds.join(","),
    [favouriteIds, initialFavouriteIds]
  );

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);

        const [{ data: all, error: e1 }, { data: mine, error: e2 }, { data: profileRow, error: e3 }] =
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
            supabase
              .from("profiles")
              .select("settings")
              .eq("id", userId)
              .maybeSingle(),
          ]);

        if (e1) console.warn("Achievements load error (all)", e1);
        if (e2) console.warn("Achievements load error (mine)", e2);
        if (e3) console.warn("Achievements load error (profile)", e3);

        if (all) setList(all as Achievement[]);

        const unlockedSet = mine
          ? new Set(mine.map((m: any) => m.achievement_id as string))
          : new Set<string>();
        setUnlockedIds(unlockedSet);

        const settings = (profileRow?.settings ?? {}) as any;
        setProfileSettings(settings);

        const favRaw: string[] = Array.isArray(settings?.favourite_achievements)
          ? settings.favourite_achievements.filter((id: any) => typeof id === "string")
          : [];

        // Only keep favourites that are still unlocked, cap at 3
        const favUnlocked = favRaw.filter((id) => unlockedSet.has(id)).slice(0, 3);

        setFavouriteIds(favUnlocked);
        setInitialFavouriteIds(favUnlocked);
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

  async function handleSaveFavourites() {
    if (!userId) return;
    try {
      setSaving(true);

      const nextSettings = {
        ...(profileSettings || {}),
        favourite_achievements: favouriteIds,
      };

      const { error } = await supabase.from("profiles").update({ settings: nextSettings }).eq("id", userId);
      if (error) throw error;

      setProfileSettings(nextSettings);
      setInitialFavouriteIds(favouriteIds);

      if (fromProfile) router.back();
    } catch (e) {
      console.error("handleSaveFavourites error", e);
      Alert.alert("Couldn’t save favourites", "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.center}>
          <Text style={s.emptyText}>Please sign in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const headerRight = (
    <Pressable
      onPress={handleSaveFavourites}
      disabled={!hasChanges || saving}
      style={({ pressed }) => [
        s.headerAction,
        (!hasChanges || saving) && { opacity: 0.45 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={s.headerActionText}>{saving ? "Saving…" : fromProfile ? "Done" : "Save"}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Achievements" right={headerRight} />

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: layout.space.lg, paddingBottom: layout.space.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: layout.space.md }} />}
        ListHeaderComponent={
          <View style={{ gap: layout.space.md, marginBottom: layout.space.md }}>
            <Text style={s.subtle}>
              Unlocked {counts.unlocked} of {counts.total} ({counts.pct}%)
            </Text>

            <View style={s.searchRow}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search achievements…"
                placeholderTextColor={colors.textMuted}
                style={s.searchInput}
              />
            </View>

            <View style={s.filterRow}>
              <FilterPill
                label="All"
                count={counts.total}
                active={mode === "all"}
                onPress={() => setMode("all")}
              />
              <FilterPill
                label="Unlocked"
                count={counts.unlocked}
                active={mode === "unlocked"}
                onPress={() => setMode("unlocked")}
              />
              <FilterPill
                label="Locked"
                count={counts.locked}
                active={mode === "locked"}
                onPress={() => setMode("locked")}
              />
            </View>

            {fromProfile ? (
              <Text style={s.helper}>
                Pick up to 3 unlocked achievements. They’ll appear on your profile.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const unlocked = unlockedIds.has(item.id);
          const isFavourite = favouriteIds.includes(item.id);

          return (
            <AchievementCard
              a={item}
              unlocked={unlocked}
              favourite={isFavourite}
              onToggleFavourite={() => {
                if (!unlocked) return;

                setFavouriteIds((prev) => {
                  const already = prev.includes(item.id);
                  if (already) return prev.filter((id) => id !== item.id);

                  if (prev.length >= 3) {
                    Alert.alert(
                      "Max favourites reached",
                      "You can pin up to 3 favourite achievements. Remove one to add another."
                    );
                    return prev;
                  }

                  return [...prev, item.id];
                });
              }}
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.emptyTitle}>No achievements found</Text>
            <Text style={s.emptyText}>Try changing your filters or search term.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );

  function FilterPill({
    label,
    count,
    active,
    onPress,
  }: {
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.filterPill,
          active ? s.filterPillActive : s.filterPillIdle,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[s.filterPillText, active ? { color: colors.text } : { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text style={[s.filterPillCount, active ? { color: colors.text } : { color: colors.textMuted }]}>
          {count}
        </Text>
      </Pressable>
    );
  }

  function AchievementCard({
    a,
    unlocked,
    favourite,
    onToggleFavourite,
  }: {
    a: Achievement;
    unlocked: boolean;
    favourite: boolean;
    onToggleFavourite: () => void;
  }) {
    const badge = diffBadge(a.difficulty, colors);

    return (
      <Card>
        <View style={[s.achWrap, !unlocked && { opacity: 0.55 }]}>
          <View style={s.badgeRow}>
            <View style={s.badgeLeft}>
              <View style={[s.badge, { backgroundColor: badge.bg }]}>
                <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
              </View>
              <Text style={s.cat}>{capitalize(a.category)}</Text>
            </View>

            <Pressable
              disabled={!unlocked}
              onPress={onToggleFavourite}
              hitSlop={layout.hitSlop}
              style={({ pressed }) => [
                s.favButton,
                favourite && { borderColor: colors.primary, backgroundColor: colors.trackBg },
                !unlocked && { opacity: 0.3 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[s.favIcon, favourite && { color: colors.primary }]}>
                {favourite ? "★" : "☆"}
              </Text>
            </Pressable>
          </View>

          <Text style={s.achTitle}>{a.title}</Text>
          <Text style={s.achDesc}>{a.description}</Text>

          <View style={s.lockRow}>
            <Pill tone={unlocked ? "success" : "neutral"} label={unlocked ? "Unlocked" : "Locked"} />
          </View>
        </View>
      </Card>
    );
  }
}

/* ---------- styles + utils ---------- */
function makeStyles({
  colors,
  typography,
  layout,
}: {
  colors: any;
  typography: any;
  layout: any;
}) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", paddingTop: 40 },

    headerAction: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerActionText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.text,
    },

    subtle: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    helper: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    searchRow: {
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: layout.space.md,
      paddingVertical: 10,
    },
    searchInput: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.text,
    },

    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: layout.space.sm },

    filterPill: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    filterPillIdle: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.trackBg,
      borderColor: colors.trackBorder,
    },
    filterPillText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
    filterPillCount: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      opacity: 0.9,
    },

    achWrap: { gap: 6 },

    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    badgeLeft: { flexDirection: "row", alignItems: "center", gap: 8 },

    badge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    badgeText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      letterSpacing: 0.6,
    },

    cat: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    achTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.text,
      marginTop: 2,
    },
    achDesc: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    favButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    favIcon: {
      fontSize: 18,
      color: colors.textMuted,
    },

    lockRow: { marginTop: layout.space.sm, alignItems: "flex-end" },

    emptyTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      color: colors.text,
      marginBottom: 6,
    },
    emptyText: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
}

function diffBadge(d: Achievement["difficulty"], colors: any) {
  const mk = (bg: string, fg: string, label: string) => ({ bg, fg, label });
  const neutralBg = colors.trackBg ?? colors.surface ?? colors.card;
  const neutralFg = colors.text ?? "#111";

  switch (d) {
    case "easy":
      return mk("rgba(34,197,94,0.18)", colors.success ?? "#22C55E", "EASY");
    case "medium":
      return mk("rgba(37,99,235,0.18)", colors.primary ?? "#2563EB", "MEDIUM");
    case "hard":
      return mk("rgba(245,158,11,0.18)", colors.warning ?? "#F59E0B", "HARD");
    case "elite":
      return mk("rgba(239,68,68,0.18)", colors.danger ?? "#EF4444", "ELITE");
    case "legendary":
      return mk("rgba(139,92,246,0.18)", colors.primary ?? "#2563EB", "LEGEND");
    default:
      return mk(neutralBg, neutralFg, "—");
  }
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
