// app/features/home/ui/cards/UnlockPreviewCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";

type UnlockItem = { title: string; subtitle?: string | null };

function normalizeUnlock(card: any): UnlockItem[] {
  const raw = Array.isArray(card?.items) ? card.items : [];
  return raw
    .map((it: any) => {
      const t = it?.title ?? it?.name ?? null;
      if (!t) return null;
      return {
        title: String(t),
        // support either `subtitle` or `desc` from backend payloads
        subtitle:
          it?.subtitle != null
            ? String(it.subtitle)
            : it?.desc != null
            ? String(it.desc)
            : null,
      } as UnlockItem;
    })
    .filter(Boolean) as UnlockItem[];
}

function niceDesc(title: string) {
  const t = title.toLowerCase();

  if (t.includes("weekly")) return "Stay on track each week with a clear goal bar.";
  if (t.includes("pr")) return "Spot new personal bests and celebrate progress.";
  if (t.includes("consistency") || t.includes("calendar"))
    return "Build momentum with streaks and training history.";
  if (t.includes("volume")) return "See your training load trend over time.";
  if (t.includes("goal")) return "Set targets and track them automatically.";
  return "More insights to keep you progressing.";
}

export function UnlockPreviewCard({ card }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const items = useMemo(() => normalizeUnlock(card), [card]);

  if (!items.length) return null;

  // Keep this very “not paywall” + motivational.
  const title = String(card?.title ?? "What’s coming next");
  const subtitle = String(
    card?.subtitle ??
      "After your first 5 workouts, Home adds deeper progress tracking — automatically."
  );

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          {/* Calm label (not salesy) */}
          <Pill label="UP NEXT" tone="neutral" />
        </View>

        {/* Rows as mini-tiles (premium + readable) */}
        <View style={{ gap: layout.space.sm }}>
          {items.slice(0, 6).map((it, idx) => {
            const desc = it.subtitle ?? niceDesc(it.title);

            return (
              <View key={`${it.title}:${idx}`} style={styles.rowTile}>
                <View style={styles.leftIconWrap}>
                  <View style={styles.dotOuter}>
                    <View style={styles.dotInner} />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {it.title}
                  </Text>
                  <Text style={styles.itemSub} numberOfLines={2}>
                    {desc}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Bottom nudge (motivational, not pressure) */}
        <View style={styles.footerNudge}>
          <Text style={styles.footerText} numberOfLines={2}>
            You’re close — log a few sessions and your Home screen levels up with insights.
          </Text>
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      color: colors.text,
      letterSpacing: -0.3,
    },

    sub: {
      marginTop: 6,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.body,
    },

    // Premium “mini tiles”
    rowTile: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },

    leftIconWrap: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },

    dotOuter: {
      width: 16,
      height: 16,
      borderRadius: 999,
      backgroundColor: "rgba(37,99,235,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },

    dotInner: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
      opacity: 0.95,
    },

    itemTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      color: colors.text,
      letterSpacing: -0.2,
    },

    itemSub: {
      marginTop: 3,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.body,
    },

    footerNudge: {
      marginTop: 2,
      paddingTop: 6,
    },

    footerText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
  });
