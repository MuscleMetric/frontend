import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type WorkoutPickRow = {
  id: string; // workout_history.id
  completed_at: string | null;
  duration_seconds: number | null;
  workout_id: string | null;

  // Supabase sometimes returns this as array, sometimes object depending on relationship typing
  workouts?: { id: string; title: string | null; workout_image_key: string | null } | Array<{
    id: string;
    title: string | null;
    workout_image_key: string | null;
  }> | null;
};

type PickItem = {
  workout_history_id: string;
  workout_id: string | null;
  title: string;
  completed_at: string | null;
  duration_seconds: number | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(seconds: number | null) {
  const s = Number(seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function normalizeWorkoutJoin(row: WorkoutPickRow) {
  const j = (row as any).workouts;
  if (!j) return null;
  return Array.isArray(j) ? j[0] : j;
}

export default function CreateWorkoutPostScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
          lineHeight: typography.lineHeight.h1,
        },
        sub: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        listContent: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.md,
          paddingBottom: layout.space.xxl,
        },

        row: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          marginBottom: layout.space.md,
        },
        rowPressed: { backgroundColor: colors.cardPressed, borderColor: colors.primary },

        rowTop: { flexDirection: "row", justifyContent: "space-between", gap: layout.space.md },
        rowTitle: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },
        rowMeta: {
          marginTop: 4,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        footer: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        },
        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.5 },
        btnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },

        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: layout.space.lg },
        error: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<PickItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("workout_history")
        .select(
          `
          id,
          completed_at,
          duration_seconds,
          workout_id,
          workouts:workouts (
            id,
            title,
            workout_image_key
          )
        `
        )
        .eq("user_id", uid)
        .not("workout_id", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const rows = (data ?? []) as unknown as WorkoutPickRow[];

      const normalized: PickItem[] = rows.map((r) => {
        const w = normalizeWorkoutJoin(r);
        return {
          workout_history_id: r.id,
          workout_id: r.workout_id ?? w?.id ?? null,
          title: w?.title ?? "Workout",
          completed_at: r.completed_at ?? null,
          duration_seconds: (r as any).duration_seconds ?? null,
        };
      });

      setItems(normalized);

      // keep selection if still present
      setSelectedId((prev) => (prev && normalized.some((x) => x.workout_history_id === prev) ? prev : null));
    } catch (e: any) {
      console.log("workout picker load error:", e);
      setErrorMsg(e?.message ?? "Failed to load workouts");
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selected = items.find((x) => x.workout_history_id === selectedId) ?? null;

  const continueToDetails = () => {
    if (!selected) return;
    router.push({
      pathname: "/features/social/create/screens/CreateWorkoutPostDetailsScreen",
      params: { workout_history_id: selected.workout_history_id },
    });
  };

  const renderItem = ({ item }: { item: PickItem }) => {
    const isOn = item.workout_history_id === selectedId;
    return (
      <Pressable
        onPress={() => setSelectedId(item.workout_history_id)}
        style={({ pressed }) => [
          styles.row,
          (isOn || pressed) && styles.rowPressed,
        ]}
      >
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={styles.rowMeta}>
          {fmtDate(item.completed_at)} • {fmtDuration(item.duration_seconds)}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          wh_id: {item.workout_history_id}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Share workout</Text>
          <Text style={styles.sub}>Pick one of your last 20 completed workouts.</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : errorMsg ? (
          <View style={styles.center}>
            <Text style={styles.error}>{errorMsg}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(x) => x.workout_history_id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.error}>No workouts found.</Text>
              </View>
            }
          />
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={continueToDetails}
            disabled={!selected}
            style={[styles.btn, !selected && styles.btnDisabled]}
          >
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}