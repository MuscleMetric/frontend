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
        subtitle: it?.subtitle != null ? String(it.subtitle) : null,
      } as UnlockItem;
    })
    .filter(Boolean) as UnlockItem[];
}

export function UnlockPreviewCard({ card }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const items = useMemo(() => normalizeUnlock(card), [card]);

  // If backend sends nothing, hide
  if (!items.length) return null;

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>What you’ll unlock</Text>
            <Text style={styles.sub} numberOfLines={2}>
              Once you’ve logged 5 workouts, Home upgrades with deeper progress tracking.
            </Text>
          </View>
          <Pill label="UP NEXT" tone="neutral" />
        </View>

        <View style={{ gap: layout.space.md }}>
          {items.slice(0, 6).map((it, idx) => (
            <View key={`${it.title}:${idx}`} style={styles.itemRow}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {it.title}
                </Text>
                {!!it.subtitle ? (
                  <Text style={styles.itemSub} numberOfLines={2}>
                    {it.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
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
      marginTop: 4,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },
    itemRow: {
      flexDirection: "row",
      gap: layout.space.md,
      alignItems: "flex-start",
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginTop: 6,
      backgroundColor: colors.primary,
      opacity: 0.9,
    },
    itemTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      color: colors.text,
    },
    itemSub: {
      marginTop: 2,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },
  });
