// app/features/social/profile/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type RecentPostPreview = {
  post_id: string;
  post_type: "workout" | "pr" | "text" | string;
  visibility: "public" | "followers" | "private" | string;
  caption: string | null;
  created_at: string;
};

type ProfileCardRow = {
  profile_id: string;
  name: string | null;
  is_private: boolean;
  can_view: boolean;
  follow_state: "self" | "following" | "requested" | "none" | string;
  workouts_completed: number | null;
  followers_count: number | null;
  following_count: number | null;
  recent_posts: RecentPostPreview[] | null; // RPC returns jsonb array
};

function initialsFromName(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (
    parts[0].slice(0, 1).toUpperCase() +
    parts[parts.length - 1].slice(0, 1).toUpperCase()
  );
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SocialProfileModal() {
  const { colors, typography, layout } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        screen: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        headerTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          flex: 1,
        },
        closeBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        closeText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        content: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.xxl,
          gap: layout.space.md,
        },

        topCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },

        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        identity: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
          flex: 1,
        },

        avatar: {
          width: 56,
          height: 56,
          borderRadius: 999,
          backgroundColor: colors.trackBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.trackBorder,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 20,
        },

        nameBlock: { flex: 1 },
        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
        },
        meta: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        followBtn: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        followBtnSecondary: {
          backgroundColor: colors.surface,
        },
        followBtnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
        },
        followBtnTextSecondary: {
          color: colors.text,
        },

        statsRow: {
          flexDirection: "row",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: layout.space.md,
        },
        stat: { flex: 1, alignItems: "center" },
        statValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
        },
        statLabel: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
        divider: {
          width: 1,
          marginVertical: 4,
          backgroundColor: colors.border,
          opacity: 0.9,
        },

        sectionTitle: {
          marginTop: layout.space.sm,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },

        postCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: 6,
          marginBottom: layout.space.md,
        },
        postMeta: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
        postCaption: {
          marginTop: 2,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
        error: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          textAlign: "center",
        },
        hint: {
          marginTop: 8,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          textAlign: "center",
        },
        privateBox: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
        },
        subtleText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
      }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<ProfileCardRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);

    const res = await supabase
      .rpc("get_profile_card_v1", { p_profile_id: String(id) })
      .single();

    if (res.error) {
      console.log("get_profile_card_v1 error:", res.error);
      setErr(res.error.message ?? "Failed to load profile");
      setCard(null);
      setLoading(false);
      return;
    }

    // Supabase sometimes returns jsonb as object; normalize recent_posts to array
    const row = res.data as unknown as ProfileCardRow;
    const normalized: ProfileCardRow = {
      ...row,
      recent_posts: Array.isArray(row?.recent_posts) ? row.recent_posts : [],
    };

    setCard(normalized);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const followActionLabel = useMemo(() => {
    if (!card) return "";
    if (card.follow_state === "self") return "";
    if (card.follow_state === "following") return "Following";
    if (card.follow_state === "requested") return "Requested";
    // none
    return card.is_private ? "Request" : "Follow";
  }, [card]);

  const followActionStyle = useMemo(() => {
    if (!card) return {};
    // secondary (outlined) for "Following" + "Requested"
    if (
      card.follow_state === "following" ||
      card.follow_state === "requested"
    ) {
      return [styles.followBtn, styles.followBtnSecondary];
    }
    return [styles.followBtn];
  }, [card, styles]);

  const followActionTextStyle = useMemo(() => {
    if (!card) return {};
    if (
      card.follow_state === "following" ||
      card.follow_state === "requested"
    ) {
      return [styles.followBtnText, styles.followBtnTextSecondary];
    }
    return [styles.followBtnText];
  }, [card, styles]);

  const onPressFollow = useCallback(async () => {
    if (!card || acting) return;
    if (card.follow_state === "self") return;

    setActing(true);
    setErr(null);

    try {
      if (card.follow_state === "following") {
        const r = await supabase.rpc("unfollow", { p_target: card.profile_id });
        if (r.error) throw r.error;
      } else if (card.follow_state === "requested") {
        const r = await supabase.rpc("cancel_follow_request", {
          p_target: card.profile_id,
        });
        if (r.error) throw r.error;
      } else {
        // none
        const r = await supabase.rpc("request_follow", {
          p_target: card.profile_id,
        });
        if (r.error) throw r.error;
      }

      await load();
    } catch (e: any) {
      console.log("follow action error:", e);
      setErr(e?.message ?? "Action failed");
    } finally {
      setActing(false);
    }
  }, [card, acting, load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (err || !card) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{err ?? "Profile not found"}</Text>
          <Text style={styles.hint}>Pull to refresh or close and retry.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = initialsFromName(card.name);
  const posts = (card.recent_posts ?? []) as RecentPostPreview[];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Profile
          </Text>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(p) => p.post_id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.topCard}>
                <View style={styles.topRow}>
                  <View style={styles.identity}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    <View style={styles.nameBlock}>
                      <Text style={styles.name} numberOfLines={1}>
                        {card.name ?? "User"}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {card.is_private ? "Private" : "Public"}
                        {card.follow_state && card.follow_state !== "self"
                          ? ` • ${card.follow_state}`
                          : ""}
                      </Text>
                    </View>
                  </View>

                  {card.follow_state !== "self" ? (
                    <Pressable
                      onPress={onPressFollow}
                      disabled={acting}
                      style={[
                        ...(followActionStyle as any),
                        { opacity: acting ? 0.7 : 1 },
                      ]}
                    >
                      {acting ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={followActionTextStyle as any}>
                          {followActionLabel}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>

                {card.can_view ? (
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>
                        {card.workouts_completed ?? 0}
                      </Text>
                      <Text style={styles.statLabel}>Workouts</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.stat}>
                      <Text style={styles.statValue}>
                        {card.followers_count ?? 0}
                      </Text>
                      <Text style={styles.statLabel}>Followers</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.stat}>
                      <Text style={styles.statValue}>
                        {card.following_count ?? 0}
                      </Text>
                      <Text style={styles.statLabel}>Following</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.privateBox}>
                    <Text style={styles.subtleText as any} />
                    <Text style={styles.meta}>
                      This profile is private. Follow to see stats and posts.
                    </Text>
                  </View>
                )}

                {err ? <Text style={styles.error}>{err}</Text> : null}
              </View>

              {card.can_view ? (
                <Text style={styles.sectionTitle}>Recent posts</Text>
              ) : null}

              {card.can_view && posts.length === 0 ? (
                <View style={styles.privateBox}>
                  <Text style={styles.meta}>No posts yet.</Text>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <Text style={styles.postMeta}>
                {item.post_type} • {item.visibility} • {fmtTs(item.created_at)}
              </Text>
              {!!item.caption && (
                <Text style={styles.postCaption}>{item.caption}</Text>
              )}
            </View>
          )}
          ListFooterComponent={<View style={{ height: layout.space.xxl }} />}
        />
      </View>
    </SafeAreaView>
  );
}
