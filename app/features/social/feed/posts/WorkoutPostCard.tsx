// app/features/social/feed/posts/WorkoutPostCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { FeedRow } from "../types";
import { UserMetaRow } from "../components/UserMetaRow";
import { FeedActionsRow } from "../components/FeedActionsRow";
import { fmtVolume, toNumber } from "../utils/format";

type Props = {
  item: FeedRow;
};

function upperOrFallback(s?: string | null, fallback = "WORKOUT") {
  const v = (s ?? "").trim();
  return v.length ? v.toUpperCase() : fallback;
}

export function WorkoutPostCard({ item }: Props) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          overflow: "hidden",
          marginBottom: layout.space.md,
        },

        headerPad: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
        },

        caption: {
          marginTop: layout.space.sm,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        heroWrap: {
          marginTop: layout.space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },

        hero: {
          height: 210,
          width: "100%",
          backgroundColor: colors.bg, // fallback if no image
          justifyContent: "flex-end",
        },

        heroFallback: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.bg,
        },

        heroOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.18)",
        },

        heroBottom: {
          paddingHorizontal: layout.space.lg,
          paddingBottom: layout.space.lg,
        },

        heroTitle: {
          color: "#FFFFFF",
          fontFamily: typography.fontFamily.bold,
          fontSize: 28,
          lineHeight: 32,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        },

        statsPill: {
          marginTop: layout.space.md,
          marginHorizontal: layout.space.lg,
          marginBottom: layout.space.md,
          borderRadius: 999,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },

        statCol: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },

        divider: {
          width: 1,
          alignSelf: "stretch",
          backgroundColor: colors.border,
          opacity: 0.8,
        },

        statLabel: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 4,
        },

        statValueRow: {
          flexDirection: "row",
          alignItems: "baseline",
          gap: 6,
        },

        statValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 18,
          lineHeight: 22,
        },

        unit: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        actionsPad: {
          paddingHorizontal: layout.space.lg,
          paddingBottom: layout.space.lg,
        },
      }),
    [colors, typography, layout]
  );

  const ws = item.workout_snapshot;

  const volume = fmtVolume(ws?.total_volume ?? 0);
  const sets = String(Math.max(0, toNumber(ws?.sets_count ?? 0)));
  const exercises = String(Math.max(0, toNumber(ws?.exercises_count ?? 0)));

  // You don’t currently return an image key/url in get_feed.
  // This makes the card ready when you add one later.
  const key = ws?.workout_image_key ?? null;
  const imageUri = key;

  const workoutTitle = upperOrFallback(ws?.workout_title, "WORKOUT");

  return (
    <View style={styles.card}>
      <View style={styles.headerPad}>
        <UserMetaRow
          name={item.user_name ?? "User"}
          username={item.user_username}
          createdAt={item.created_at}
        />

        {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}
      </View>

      <View style={styles.heroWrap}>
        <ImageBackground
          source={imageUri ? { uri: imageUri } : undefined}
          resizeMode="cover"
          style={styles.hero}
        >
          {!imageUri && <View style={styles.heroFallback} />}
          <View style={styles.heroOverlay} />
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {workoutTitle}
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.statsPill}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>VOLUME</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{volume}</Text>
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>SETS</Text>
            <Text style={styles.statValue}>{sets}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>EXERCISES</Text>
            <Text style={styles.statValue}>{exercises}</Text>
          </View>
        </View>

        <View style={styles.actionsPad}>
          <FeedActionsRow
            likeCount={item.like_count}
            commentCount={item.comment_count}
            viewerLiked={item.viewer_liked}
            onPressLike={() => {}}
            onPressComments={() => {}}
            onPressShare={() => {}}
          />
        </View>
      </View>
    </View>
  );
}
