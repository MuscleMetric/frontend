// app/features/social/feed/components/FeedActionsRow.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ThumbsUp, MessageCircle, Share2 } from "lucide-react-native";

type Props = {
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;

  onPressLike?: () => void;
  onPressComments?: () => void;
  onPressShare?: () => void;
};

export function FeedActionsRow(props: Props) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          marginTop: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        left: {
          flexDirection: "row",
          alignItems: "center",
          gap: 22,
        },

        action: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
        },

        count: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        share: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 6,
        },
      }),
    [colors, typography, layout]
  );

  const likeColor = props.viewerLiked
    ? colors.primary
    : colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Pressable style={styles.action} onPress={props.onPressLike} hitSlop={12}>
          <ThumbsUp
            size={20}
            strokeWidth={1.8}
            color={likeColor}
            fill={props.viewerLiked ? likeColor : "none"}
          />
          <Text style={styles.count}>{props.likeCount}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={props.onPressComments} hitSlop={12}>
          <MessageCircle
            size={20}
            strokeWidth={1.8}
            color={colors.textMuted}
          />
          <Text style={styles.count}>{props.commentCount}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.share} onPress={props.onPressShare} hitSlop={12}>
        <Share2
          size={20}
          strokeWidth={1.8}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}