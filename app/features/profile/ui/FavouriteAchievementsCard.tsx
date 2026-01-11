import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function difficultyTone(diff?: string | null): "neutral" | "success" | "primary" | "warning" | "danger" {
  const d = (diff ?? "").toLowerCase();
  if (d === "easy") return "success";
  if (d === "medium") return "primary";
  if (d === "hard") return "warning";
  if (d === "elite" || d === "legendary") return "danger";
  return "neutral";
}

function prettyCategory(cat?: string | null) {
  if (!cat) return "";
  return String(cat).replace(/_/g, " ");
}

export default function FavouriteAchievementsCard({
  data,
}: {
  data: ProfileOverview;
}) {
  const { colors, typography, layout } = useAppTheme();
  const favs = (data.favourite_achievements ?? []).slice(0, 3);

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
        subtitle: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
          marginBottom: layout.space.md,
        },

        chipsWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: layout.space.sm,
        },

        grid: {
          gap: layout.space.sm,
        },

        rowCard: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.trackBg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: 6,
        },
        rowTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        rowTitle: {
          flex: 1,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        },
        rowMeta: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        footerRow: {
          marginTop: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        emptyWrap: { gap: layout.space.md },
        emptyText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
      }),
    [colors, typography, layout]
  );

  const goPick = () =>
    router.push("/features/achievements/achievements?fromProfile=1");

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Favourite achievements</Text>
        <Pill tone="neutral" label={`${favs.length}/3`} />
      </View>

      {favs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Pin up to 3 achievements to show what you’re proud of.
          </Text>
          <Button title="Pick favourites" onPress={goPick} />
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>
            These appear on your profile and help others understand your training style.
          </Text>

          {/* “pretty” list rows (more premium than just chips) */}
          <View style={styles.grid}>
            {favs.map((a) => {
              const tone = difficultyTone(a.difficulty);
              const cat = prettyCategory(a.category);

              return (
                <Pressable key={a.id} onPress={goPick} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Pill tone={tone} label={(a.difficulty ?? "—").toUpperCase()} />
                  </View>
                  {cat ? <Text style={styles.rowMeta}>{cat}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footerRow}>
            <Pill tone="neutral" label="Tap to edit" />
            <Button variant="secondary" title="Edit favourites" onPress={goPick} />
          </View>
        </>
      )}
    </Card>
  );
}
