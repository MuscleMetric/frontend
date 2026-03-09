import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type InboxRow = {
  notification_id: string;
  type: string;
  created_at: string;
  is_read: boolean;
  actor_id: string | null;
  actor_name: string | null;
  post_id: string | null;
  comment_id: string | null;
  follow_requester_id: string | null;
  message: string | null;
};

export default function InboxScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        listContent: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.xxl,
          flexGrow: 1, // ✅ allows empty state to center nicely
        },

        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          marginBottom: layout.space.md,
        },

        unread: {
          borderColor: colors.primary, // ✅ simple “unread” emphasis
        },

        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        meta: {
          marginTop: 4,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        badge: {
          marginTop: 10,
          alignSelf: "flex-start",
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

        emptyWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
        emptyTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          textAlign: "center",
        },
        emptySub: {
          marginTop: 8,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          textAlign: "center",
        },

        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },

        actor: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        typePill: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        typeText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        message: {
          marginTop: 10,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        kv: {
          marginTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 12,
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
      }),
    [colors, typography, layout]
  );

  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await supabase.rpc("get_notifications_inbox_v1", {
      p_limit: 50,
    });
    if (res.error) {
      console.log("inbox rpc error:", res.error);
      setRows([]);
    } else {
      setRows((res.data as InboxRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: InboxRow }) => {
    const label = item.is_read ? "Read" : "Unread";

    const actorLabel =
      item.actor_name ??
      (item.actor_id ? `User ${item.actor_id.slice(0, 6)}…` : "System");

    const title =
      item.message ??
      (item.type === "follow_request"
        ? "New follow request"
        : item.type === "followed_you"
        ? "New follower"
        : item.type === "post_like"
        ? "Someone liked your post"
        : item.type === "post_comment"
        ? "New comment"
        : "Notification");

    return (
      <View style={[styles.card, !item.is_read && styles.unread]}>
        <View style={styles.topRow}>
          <Text style={styles.actor} numberOfLines={1}>
            {actorLabel}
          </Text>

          <View style={styles.typePill}>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
        </View>

        <Text style={styles.message}>{title}</Text>

        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleString()}
        </Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>

        {/* ✅ Debug block (UX testing) */}
        <View style={styles.kv}>
          <View style={styles.kvRow}>
            <Text style={styles.k}>notification_id</Text>
            <Text style={styles.v} numberOfLines={1}>
              {item.notification_id}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.k}>actor_id</Text>
            <Text style={styles.v} numberOfLines={1}>
              {item.actor_id ?? "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.k}>post_id</Text>
            <Text style={styles.v} numberOfLines={1}>
              {item.post_id ?? "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.k}>comment_id</Text>
            <Text style={styles.v} numberOfLines={1}>
              {item.comment_id ?? "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.k}>follow_requester</Text>
            <Text style={styles.v} numberOfLines={1}>
              {item.follow_requester_id ?? "—"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={10}
          >
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Inbox</Text>
        </View>

        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(i) => i.notification_id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySub}>
                  Follow someone or post a workout — you’ll see activity here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
