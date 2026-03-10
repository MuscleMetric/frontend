import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type NotificationType =
  | "followed_you"
  | "follow_request_received"
  | "follow_request_accepted"
  | "post_liked"
  | "post_commented"
  | "following_posted_pr"
  | "following_posted_workout";

type EntityType = "profile" | "follow_request" | "post" | "comment";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: EntityType;
  entity_id: string;
  image_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type ProfileLite = {
  id: string;
  name: string | null;
  username: string | null;
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

        headerTitleWrap: {
          flex: 1,
        },

        headerTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
        },

        headerSub: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
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

        markAllBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        markAllText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        listContent: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.xxl,
          flexGrow: 1,
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
          borderColor: colors.primary,
          backgroundColor: colors.surface,
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
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        body: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        meta: {
          marginTop: 12,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        footerRow: {
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },

        badge: {
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

        ctaText: {
          color: colors.primary,
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

        errorText: {
          marginTop: 8,
          color: colors.danger,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [actorMap, setActorMap] = useState<Record<string, ProfileLite>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    const res = await supabase.rpc("get_my_unread_notification_count");
    if (!res.error && typeof res.data === "number") {
      setUnreadCount(res.data);
    }
  }, []);

  const fetchActorProfiles = useCallback(async (items: NotificationRow[]) => {
    const actorIds = Array.from(
      new Set(items.map((item) => item.actor_id).filter(Boolean))
    ) as string[];

    if (actorIds.length === 0) {
      setActorMap({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, username")
      .in("id", actorIds);

    if (error) {
      console.log("profiles fetch error:", error);
      return;
    }

    const nextMap: Record<string, ProfileLite> = {};
    for (const profile of (data ?? []) as ProfileLite[]) {
      nextMap[profile.id] = profile;
    }
    setActorMap(nextMap);
  }, []);

  const load = useCallback(async () => {
    setErrorMsg(null);

    const notificationsRes = await supabase.rpc("get_my_notifications", {
      p_limit: 50,
      p_before: null,
    });

    if (notificationsRes.error) {
      console.log("get_my_notifications error:", notificationsRes.error);
      setRows([]);
      setActorMap({});
      setUnreadCount(0);
      setErrorMsg("Could not load notifications.");
      return;
    }

    const items = ((notificationsRes.data as NotificationRow[]) ?? []).map(
      (item) => ({
        ...item,
      })
    );

    setRows(items);

    await Promise.all([fetchActorProfiles(items), fetchUnreadCount()]);
  }, [fetchActorProfiles, fetchUnreadCount]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      await load();
      if (active) setLoading(false);
    };

    run();

    return () => {
      active = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const getActorLabel = useCallback(
    (item: NotificationRow) => {
      if (!item.actor_id) return "System";
      const actor = actorMap[item.actor_id];
      return actor?.username || actor?.name || `User ${item.actor_id.slice(0, 6)}…`;
    },
    [actorMap]
  );

  const getTypeLabel = useCallback((type: NotificationType) => {
    switch (type) {
      case "followed_you":
        return "Follow";
      case "follow_request_received":
        return "Request";
      case "follow_request_accepted":
        return "Accepted";
      case "post_liked":
        return "Like";
      case "post_commented":
        return "Comment";
      case "following_posted_pr":
        return "PR";
      case "following_posted_workout":
        return "Workout";
      default:
        return "Notification";
    }
  }, []);

  const navigateFromNotification = useCallback((item: NotificationRow) => {
    switch (item.type) {
      case "followed_you":
      case "follow_request_accepted": {
        if (item.actor_id) {
          router.push({
            pathname: "social/profile/[id]",
            params: { id: item.actor_id },
          });
        }
        return;
      }

      case "follow_request_received": {
        router.push("social/search/index");
        return;
      }

      case "post_liked":
      case "post_commented":
      case "following_posted_pr":
      case "following_posted_workout": {
        router.push({
          pathname: "social/feed/FeedList",
          params: { id: item.entity_id },
        });
        return;
      }

      default:
        return;
    }
  }, []);

  const handlePressNotification = useCallback(
    async (item: NotificationRow) => {
      if (!item.is_read) {
        const markRes = await supabase.rpc("mark_notification_read", {
          p_notification_id: item.id,
        });

        if (markRes.error) {
          console.log("mark_notification_read error:", markRes.error);
        } else {
          setRows((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    is_read: true,
                    read_at: new Date().toISOString(),
                  }
                : row
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }

      navigateFromNotification(item);
    },
    [navigateFromNotification]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (rows.length === 0 || unreadCount === 0 || markingAll) return;

    setMarkingAll(true);

    const res = await supabase.rpc("mark_all_notifications_read");

    if (res.error) {
      console.log("mark_all_notifications_read error:", res.error);
      Alert.alert("Could not update notifications", "Please try again.");
      setMarkingAll(false);
      return;
    }

    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        is_read: true,
        read_at: row.read_at ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    setMarkingAll(false);
  }, [markingAll, rows.length, unreadCount]);

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const actorLabel = getActorLabel(item);

    return (
      <Pressable
        onPress={() => handlePressNotification(item)}
        style={({ pressed }) => [
          styles.card,
          !item.is_read && styles.unread,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.actor} numberOfLines={1}>
            {actorLabel}
          </Text>

          <View style={styles.typePill}>
            <Text style={styles.typeText}>{getTypeLabel(item.type)}</Text>
          </View>
        </View>

        <Text style={styles.message}>{item.title}</Text>

        {!!item.body && <Text style={styles.body}>{item.body}</Text>}

        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleString()}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.is_read ? "Read" : "Unread"}
            </Text>
          </View>

          <Text style={styles.ctaText}>Open</Text>
        </View>
      </Pressable>
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

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Inbox</Text>
            <Text style={styles.headerSub}>
              {unreadCount === 0
                ? "All caught up"
                : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
            </Text>
          </View>

          <Pressable
            onPress={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
            style={({ pressed }) => [
              styles.markAllBtn,
              {
                opacity:
                  unreadCount === 0 || markingAll ? 0.45 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.markAllText}>
              {markingAll ? "Updating..." : "Read all"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
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
                  Follows, likes, comments, and post activity will appear here.
                </Text>
                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}