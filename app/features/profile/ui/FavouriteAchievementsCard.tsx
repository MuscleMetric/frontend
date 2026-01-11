import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill, Icon } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function iconForDifficulty(diff?: string | null) {
  const d = (diff ?? "").toLowerCase();
  if (d === "easy") return "trophy-outline";
  if (d === "medium") return "medal-outline";
  if (d === "hard") return "flame-outline";
  if (d === "elite" || d === "legendary") return "trophy";
  return "ribbon-outline";
}

function difficultyTone(
  diff?: string | null
): "neutral" | "success" | "primary" | "warning" | "danger" {
  const d = (diff ?? "").toLowerCase();
  if (d === "easy") return "success";
  if (d === "medium") return "primary";
  if (d === "hard") return "warning";
  if (d === "elite" || d === "legendary") return "danger";
  return "neutral";
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
          marginBottom: layout.space.md,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },

        stack: {
          gap: layout.space.sm,
        },

        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
          padding: layout.space.md,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.trackBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },

        rowTextWrap: {
          flex: 1,
          gap: 2,
        },

        rowTitle: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        },

        rowDesc: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        emptyText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
          textAlign: "center",
          marginVertical: layout.space.sm,
        },

        footer: {
          marginTop: layout.space.md,
          alignItems: "center",
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
        <>
          <Text style={styles.emptyText}>
            Pin up to 3 achievements to show what you’re proud of.
          </Text>
          <View style={styles.footer}>
            <Pressable onPress={goPick}>
              <Pill tone="primary" label="Pick favourites" />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.stack}>
            {favs.map((a) => (
              <Pressable key={a.id} onPress={goPick} style={styles.row}>
                <Icon
                  name={iconForDifficulty(a.difficulty)}
                  size={18}
                  color={colors.text}
                />

                <View style={styles.rowTextWrap}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {a.title}
                  </Text>

                  {a.description ? (
                    <Text numberOfLines={1} style={styles.rowDesc}>
                      {a.description}
                    </Text>
                  ) : null}
                </View>

                <Pill
                  tone={difficultyTone(a.difficulty)}
                  label={(a.difficulty ?? "—").toUpperCase()}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable onPress={goPick}>
              <Pill tone="neutral" label="Edit favourites" />
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}
