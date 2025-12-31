// app/features/history/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  RefreshControl,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

type PreviewItem = {
  name: string;
  sets: number;
  reps?: number | null;
};

type HistoryListRow = {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workout_title: string | null;
  preview_items: PreviewItem[] | null;
};

const PAGE_SIZE = 10;

export default function WorkoutHistoryList() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [rows, setRows] = useState<HistoryListRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fmtDuration = (sec?: number | null) => {
    if (!sec) return null;
    const m = Math.round(sec / 60);
    return `${m}min`;
  };

  const fetchPage = useCallback(
    async (pageNum: number, replace = false) => {
      if (!userId) return;

      if (pageNum > 0) setLoadingMore(true);
      else setLoading(true);

      try {
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("v_user_workout_history_list")
          .select(
            "id, completed_at, duration_seconds, notes, workout_title, preview_items"
          )
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .range(from, to)
          .returns<HistoryListRow[]>();

        if (error) throw error;

        const batch = data ?? [];

        // ✅ Pagination fix: if we got fewer than PAGE_SIZE, we're done.
        setHasMore(batch.length === PAGE_SIZE);

        setRows((prev) => (replace ? batch : [...prev, ...batch]));
      } catch (e) {
        console.error("fetch history list error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    setPage(0);
    setHasMore(true);
    fetchPage(0, true);
  }, [userId, fetchPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(true);
    setPage(0);
    await fetchPage(0, true);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    await fetchPage(next);
  };

  if (!userId) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Sign in to view workout history.</Text>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const renderItem = ({ item }: { item: HistoryListRow }) => {
    const items = item.preview_items ?? [];

    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/features/history/detail",
            params: { id: item.id },
          })
        }
        style={s.card}
      >
        <View style={[s.rowBetween, { marginBottom: 6 }]}>
          <Text style={s.muted}>
            {new Date(item.completed_at).toLocaleDateString("en-GB")}
          </Text>
          {item.duration_seconds ? (
            <Text style={s.muted}>{fmtDuration(item.duration_seconds)}</Text>
          ) : null}
        </View>

        <Text style={s.title}>{item.workout_title ?? "Workout"}</Text>
        <View style={{ height: 8 }} />

        {items.slice(0, 5).map((it, idx) => (
          <View
            key={`${item.id}-${idx}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <View style={s.dot} />
            <Text style={s.itemText}>
              {it.name} – {it.sets}x{it.reps ?? "?"}
            </Text>
          </View>
        ))}

        {item.notes ? (
          <>
            <View style={s.hr} />
            <Text style={s.subhead}>Notes</Text>
            <Text style={s.notes} numberOfLines={3}>
              “{item.notes}”
            </Text>
          </>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasMore) loadMore();
        }}
        ListHeaderComponent={
          <View style={s.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={s.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="chevron-left" size={20} color={colors.primary} />
              <Text style={s.backText}>Back</Text>
            </Pressable>

            <Text style={s.headerTitle} numberOfLines={1}>
              Workout History
            </Text>

            <View style={{ width: 64 }} />
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 20 }} />
          ) : !hasMore ? (
            <Text style={[s.muted, { textAlign: "center", marginVertical: 12 }]}>
              All workouts loaded.
            </Text>
          ) : (
            <View style={{ height: 12 }} />
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    muted: { color: colors.subtle },
    subhead: { color: colors.text, fontWeight: "700", marginTop: 6 },
    notes: { color: colors.subtle, fontStyle: "italic" },
    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 8,
    },
    itemText: { color: colors.text },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
      marginBottom: 8,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: "transparent",
    },
    backText: { color: colors.primary, fontWeight: "700" },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
  });
