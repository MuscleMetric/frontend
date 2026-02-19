// app/features/social/feed/posts/PrPostCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { FeedRow } from "../types";
import { UserMetaRow } from "../components/UserMetaRow";
import { FeedActionsRow } from "../components/FeedActionsRow";
import { fmtInt, toNumber } from "../utils/format";

type Props = {
  item: FeedRow;
  onToggleLike: (postId: string) => void;
  onOpenComments: (post: FeedRow) => void;
};

type ParsedPr = {
  exerciseName: string | null;
  value: number | null;
  unit: string; // "kg" for now
  reps: number | null;
  delta: number | null;
  prevBest: number | null;
};

function parsePrFromSnapshot(item: FeedRow): ParsedPr {
  const s: any = item.pr_snapshot ?? {};

  // Prefer snapshot exercise_name, fallback to joined exercise_name
  const exerciseName =
    (s.exercise_name as string | undefined) ?? item.exercise_name ?? null;

  // Your real fields (from posts row example)
  const recentBestWeight = s.recent_best_weight ?? s.recentBestWeight ?? null;
  const prevBestWeight = s.prev_best_weight ?? s.prevBestWeight ?? null;
  const prDelta = s.pr_delta ?? s.delta ?? null;

  // Optional future fields (if you add reps later)
  const repsRaw = s.recent_best_reps ?? s.reps ?? null;

  const value = recentBestWeight == null ? null : toNumber(recentBestWeight);
  const prevBest = prevBestWeight == null ? null : toNumber(prevBestWeight);
  const delta = prDelta == null ? null : toNumber(prDelta);
  const reps = repsRaw == null ? null : Math.max(0, toNumber(repsRaw));

  // If you later store unit in snapshot, read it here
  const unit = (s.unit ?? "kg") as string;

  return { exerciseName, value, unit, reps, delta, prevBest };
}

export function PrPostCard({ item, onToggleLike, onOpenComments }: Props) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          padding: layout.space.lg,
          marginBottom: layout.space.md,
        },

        prWrap: {
          marginTop: layout.space.lg,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.surface,
          alignItems: "center",
          paddingVertical: layout.space.lg,
          paddingHorizontal: layout.space.md,
        },

        exercise: {
          color: colors.primary,
          fontFamily: typography.fontFamily.bold,
          fontSize: 14,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 10,
          textAlign: "center",
        },

        bigRow: {
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 10,
        },

        bigValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 64,
          lineHeight: 68,
          letterSpacing: -1,
          textAlign: "center",
        },

        // ✅ Make unit match exercise blue
        unit: {
          color: colors.primary,
          fontFamily: typography.fontFamily.bold,
          fontSize: 40,
          lineHeight: 68,
          marginBottom: 8,
        },

        reps: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: 16,
          lineHeight: 20,
          textAlign: "center",
        },

        deltaChip: {
          marginTop: layout.space.md,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "rgba(34,197,94,0.12)",
        },

        deltaText: {
          color: "rgb(22,163,74)",
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        // ✅ Caption moved below PR block
        caption: {
          marginTop: layout.space.md,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center", // ✅ centre it
          paddingHorizontal: layout.space.md, // ✅ prevent long captions touching edges
        },

        actions: { marginTop: layout.space.lg },
      }),
    [colors, typography, layout]
  );

  const pr = parsePrFromSnapshot(item);

  const exName = (pr.exerciseName ?? "Exercise").toUpperCase();

  // ✅ don’t use truthy check; allow 0 safely (even though weight won't be 0)
  const valueLabel = pr.value == null ? "—" : fmtInt(pr.value);
  const unitLabel = pr.unit ?? "kg";

  const repsLabel = pr.reps != null ? `x ${fmtInt(pr.reps)}` : null;

  // ✅ show delta based on pr_delta from snapshot
  const deltaLabel =
    pr.delta != null
      ? `${pr.delta > 0 ? "+" : ""}${fmtInt(pr.delta)} ${unitLabel} delta`
      : null;

  return (
    <View style={styles.card}>
      <UserMetaRow
        name={item.user_name ?? "User"}
        username={item.user_username}
        createdAt={item.created_at}
        subtitleLeft="New Personal Record"
      />

      <View style={styles.prWrap}>
        <Text style={styles.exercise} numberOfLines={2}>
          {exName}
        </Text>

        <View style={styles.bigRow}>
          <Text style={styles.bigValue}>{valueLabel}</Text>
          <Text style={styles.unit}>{unitLabel}</Text>
        </View>

        {!!repsLabel && <Text style={styles.reps}>{repsLabel}</Text>}

        {!!deltaLabel && (
          <View style={styles.deltaChip}>
            <Text style={styles.deltaText}>{deltaLabel}</Text>
          </View>
        )}
      </View>

      {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

      <View style={styles.actions}>
        <FeedActionsRow
          likeCount={item.like_count}
          commentCount={item.comment_count}
          viewerLiked={item.viewer_liked}
          onPressLike={() => onToggleLike(item.post_id)}
          onPressComments={() => onOpenComments(item)}
          onPressShare={() => {}}
        />
      </View>
    </View>
  );
}
