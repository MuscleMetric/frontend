// app/features/social/feed/FeedList.tsx

import React, { useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  ActivityIndicator,
  View,
  StyleSheet,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { FeedRow } from "./types";
import { FeedItem } from "./FeedItem";

type Props = {
  rows: FeedRow[];
  refreshing: boolean;
  onRefresh: () => void;

  onEndReached: () => void;
  loadingMore: boolean;

  contentPaddingTop?: number;

  onToggleLike: (postId: string) => void;
};

export function FeedList(props: Props) {
  const { colors, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          paddingHorizontal: layout.space.lg,
          paddingTop: props.contentPaddingTop ?? layout.space.md,
          paddingBottom: layout.space.xxl,
        },
        footerLoading: { paddingVertical: layout.space.lg },
      }),
    [layout, props.contentPaddingTop]
  );

  return (
    <FlatList
      data={props.rows}
      keyExtractor={(item) => item.post_id}
      renderItem={({ item }) => (
        <FeedItem item={item} onToggleLike={props.onToggleLike} />
      )}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          tintColor={colors.text}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={props.onEndReached}
      ListFooterComponent={
        props.loadingMore ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator />
          </View>
        ) : null
      }
    />
  );
}
