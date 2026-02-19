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
};

/**
 * We don’t want to assume your pr_snapshot shape,
 * but we still want a nice UI.
 *
 * Supported (optional) fields if present:
 * - pr_snapshot.value OR pr_snapshot.weight
 * - pr_snapshot.unit ("kg"/"lb"/"reps")
 * - pr_snapshot.reps
 * - pr_snapshot.delta_value OR pr_snapshot.delta
 * - pr_snapshot.delta_unit
 */
function parsePr(snapshot: any) {
  const valueRaw = snapshot?.value ?? snapshot?.weight ?? snapshot?.pr_value ?? null;
  const repsRaw = snapshot?.reps ?? snapshot?.rep_count ?? null;

  const unit = (snapshot?.unit ?? snapshot?.weight_unit ?? "kg") as string;

  const deltaRaw =
    snapshot?.delta_value ?? snapshot?.delta ?? snapshot?.delta_amount ?? null;
  const deltaUnit = (snapshot?.delta_unit ?? unit) as string;

  const value = toNumber(valueRaw);
  const reps = repsRaw == null ? null : Math.max(0, toNumber(repsRaw));
  const delta = deltaRaw == null ? null : toNumber(deltaRaw);

  return { value, unit, reps, delta, deltaUnit };
}

export function PrPostCard({ item }: Props) {
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

        caption: {
          marginTop: layout.space.sm,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
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

        unit: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.bold,
          fontSize: 18,
          lineHeight: 22,
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
          backgroundColor: "rgba(34,197,94,0.12)", // soft green tint (light mode)
        },

        deltaText: {
          color: "rgb(22,163,74)",
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        actions: { marginTop: layout.space.lg },
      }),
    [colors, typography, layout]
  );

  const exName = (item.exercise_name ?? "Exercise").toUpperCase();
  const pr = parsePr(item.pr_snapshot);

  const valueLabel = pr.value ? fmtInt(pr.value) : "—";
  const unitLabel = pr.unit ?? "kg";

  const repsLabel =
    pr.reps != null ? `x ${fmtInt(pr.reps)}` : null;

  const deltaLabel =
    pr.delta != null
      ? `${pr.delta > 0 ? "+" : ""}${fmtInt(pr.delta)} ${pr.deltaUnit} delta`
      : null;

  return (
    <View style={styles.card}>
      <UserMetaRow
        name={item.user_name ?? "User"}
        username={item.user_username}
        createdAt={item.created_at}
        subtitleLeft="New Personal Record"
      />

      {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

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

      <View style={styles.actions}>
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
  );
}