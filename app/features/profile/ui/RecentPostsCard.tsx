import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ListRow, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function fmtRelative(iso: string) {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const s = Math.max(0, Math.floor((now - d) / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const day = Math.floor(h / 24);
    if (day > 0) return `${day}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return "Just now";
  } catch {
    return "";
  }
}

function titleForPost(p: any) {
  if (p.post_type === "pr") return "New PR";
  if (p.post_type === "workout") return "Workout";
  return "Post";
}

export default function RecentPostsCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();
  const posts = data.recent_posts ?? [];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: layout.space.sm,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        listGap: { gap: layout.space.sm },
        emptyWrap: { gap: layout.space.md },
        emptyText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        footer: { marginTop: layout.space.md },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Recent Posts</Text>
        {posts.length > 0 ? <Pill tone="neutral" label="View all" /> : null}
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Share your first workout to see it in your feed.
          </Text>
          <Button title="Go to Social" onPress={() => router.push("/(tabs)/social")} />
        </View>
      ) : (
        <>
          <View style={styles.listGap}>
            {posts.slice(0, 3).map((p) => {
              const caption = (p.caption ?? "").trim();
              const subtitle = caption.length ? caption : "Tap to view";

              const right = fmtRelative(p.created_at);

              return (
                <ListRow
                  key={p.post_id}
                  title={titleForPost(p)}
                  subtitle={subtitle}
                  rightText={right}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/social",
                      params: { focusPostId: p.post_id },
                    })
                  }
                />
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button
              variant="secondary"
              title="View profile feed"
              onPress={() => router.push("/(tabs)/social")}
            />
          </View>
        </>
      )}
    </Card>
  );
}
