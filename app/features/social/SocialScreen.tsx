// app/features/social/SocialScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
// ✅ match your existing imports elsewhere
import { supabase } from "../../../lib/supabase";

type FeedRow = {
  post_id: string;
  user_id: string;
  user_name: string | null;
  post_type: "workout" | "pr" | "text" | string;
  visibility: "public" | "followers" | "private" | string;
  caption: string | null;
  created_at: string;
  workout_history_id: string | null;
  exercise_id: string | null;
  pr_snapshot: any | null;
  like_count: number;
  comment_count: number;
  viewer_liked: boolean;
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export default function SocialScreen() {
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
          backgroundColor: colors.bg,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
          lineHeight: typography.lineHeight.h1,
        },
        subtitle: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        listContent: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.xxl,
        },

        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          marginBottom: layout.space.md,
        },

        rowTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        metaLeft: { flex: 1 },
        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },
        meta: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        badge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        badgeText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        caption: {
          marginTop: layout.space.md,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        kv: {
          marginTop: layout.space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: layout.space.md,
          gap: 6,
        },
        kvRow: { flexDirection: "row", gap: 10 },
        k: {
          width: 120,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
        v: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        jsonBlock: {
          marginTop: layout.space.sm,
          padding: layout.space.sm,
          borderRadius: layout.radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        jsonText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: 11,
          lineHeight: 15,
        },

        footerLoading: { paddingVertical: layout.space.lg },

        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
        errorText: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          textAlign: "center",
        },
        hintText: {
          marginTop: 10,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  const PAGE_SIZE = 20;

  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // cursor state (stable)
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  // prevent double fetch on mount (React StrictMode can run effects twice in dev)
  const didInitialFetch = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await supabase.rpc("get_feed", { p_limit: PAGE_SIZE });

      if (res.error) {
        console.log("get_feed error:", res.error);
        setErrorMsg(res.error.message ?? "Failed to load feed");
        setRows([]);
        return;
      }

      const data = (res.data ?? []) as FeedRow[];
      setRows(data);

      const last = data[data.length - 1];
      setCursorCreatedAt(last?.created_at ?? null);
      setCursorId(last?.post_id ?? null);
    } catch (e: any) {
      console.log("get_feed exception:", e);
      setErrorMsg(e?.message ?? "Failed to load feed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (!cursorCreatedAt || !cursorId) return;

    setLoadingMore(true);
    setErrorMsg(null);

    try {
      const res = await supabase.rpc("get_feed", {
        p_limit: PAGE_SIZE,
        p_cursor_created_at: cursorCreatedAt,
        p_cursor_id: cursorId,
      });

      if (res.error) {
        console.log("get_feed more error:", res.error);
        setErrorMsg(res.error.message ?? "Failed to load more");
        return;
      }

      const data = (res.data ?? []) as FeedRow[];
      if (!data.length) return;

      setRows((prev) => {
        const existing = new Set(prev.map((r) => r.post_id));
        const next = data.filter((r) => !existing.has(r.post_id));
        return [...prev, ...next];
      });

      const last = data[data.length - 1];
      setCursorCreatedAt(last?.created_at ?? cursorCreatedAt);
      setCursorId(last?.post_id ?? cursorId);
    } catch (e: any) {
      console.log("get_feed more exception:", e);
      setErrorMsg(e?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [cursorCreatedAt, cursorId, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    loadInitial();
  }, [loadInitial]);

  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) => {
      const badge = `${item.post_type} • ${item.visibility}`;

      return (
        <View style={styles.card}>
          <View style={styles.rowTop}>
            <View style={styles.metaLeft}>
              <Text style={styles.name} numberOfLines={1}>
                {item.user_name ?? "User"}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {fmtTs(item.created_at)}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>

          {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

          <View style={styles.kv}>
            <View style={styles.kvRow}>
              <Text style={styles.k}>post_id</Text>
              <Text style={styles.v} numberOfLines={1}>
                {item.post_id}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.k}>workout_history_id</Text>
              <Text style={styles.v} numberOfLines={1}>
                {item.workout_history_id ?? "—"}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.k}>exercise_id</Text>
              <Text style={styles.v} numberOfLines={1}>
                {item.exercise_id ?? "—"}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.k}>likes / comments</Text>
              <Text style={styles.v} numberOfLines={1}>
                {item.like_count} / {item.comment_count}{" "}
                {item.viewer_liked ? "(you liked)" : ""}
              </Text>
            </View>

            <View style={styles.jsonBlock}>
              <Text style={styles.jsonText}>
                pr_snapshot:{" "}
                {item.pr_snapshot ? JSON.stringify(item.pr_snapshot, null, 2) : "null"}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [styles]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Social</Text>
          <Text style={styles.subtitle}>Loading feed…</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Social</Text>
          <Text style={styles.subtitle}>Feed (debug)</Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Text style={styles.hintText}>Pull to refresh.</Text>
        </View>

        <FlatList
          data={[]}
          renderItem={() => null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.post_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          // only load more if we got at least a full page
          if (rows.length >= PAGE_SIZE) loadMore();
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </View>
  );
}