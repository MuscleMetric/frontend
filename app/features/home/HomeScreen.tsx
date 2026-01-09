// app/features/home/HomeScreen.tsx
import React, { useMemo, useCallback } from "react";
import { FlatList, View, StyleSheet, ListRenderItem } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";
import { QuoteHeader } from "./ui/QuoteHeader";
import { HomeCardRenderer } from "./HomeCardRenderer";
import { quoteOfTheDay } from "../../../lib/quotes";
import type { Quote } from "../../../lib/quotes";

type RowItem =
  | { kind: "single"; card: any }
  | { kind: "pair"; left: any; right: any };

function groupHomeCards(cards: any[]): RowItem[] {
  const out: RowItem[] = [];

  for (let i = 0; i < cards.length; i++) {
    const cur = cards[i];
    const next = cards[i + 1];

    // Pair rule(s): keep this area explicit + easy to extend
    if (cur?.type === "weekly_goal" && next?.type === "latest_pr") {
      out.push({ kind: "pair", left: cur, right: next });
      i++;
      continue;
    }

    out.push({ kind: "single", card: cur });
  }

  return out;
}

export function HomeScreen({
  summary,
  userId,
}: {
  summary: any;
  userId: string;
}) {
  const { layout } = useAppTheme();

  const cards = summary?.cards ?? [];
  const rows = useMemo(() => groupHomeCards(cards), [cards]);

  const dailyQuote: Quote = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return quoteOfTheDay(`${userId}|${todayKey}`);
  }, [userId]);

  const styles = useMemo(() => makeStyles(layout), [layout]);

  const renderItem = useCallback<ListRenderItem<RowItem>>(
    ({ item }) => {
      if (item.kind === "pair") {
        return (
          <View style={styles.rowPairWrap}>
            <View style={styles.flex1}>
              <HomeCardRenderer card={item.left} summary={summary} />
            </View>
            <View style={styles.flex1}>
              <HomeCardRenderer card={item.right} summary={summary} />
            </View>
          </View>
        );
      }

      return (
        <View style={styles.rowSingleWrap}>
          <HomeCardRenderer card={item.card} summary={summary} />
        </View>
      );
    },
    [styles, summary]
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(row, idx) =>
        row.kind === "pair"
          ? `pair:${row.left?.type}:${row.right?.type}:${idx}`
          : `single:${row.card?.type}:${idx}`
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <QuoteHeader quote={dailyQuote} />
        </View>
      }
      renderItem={renderItem}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={8}
    />
  );
}

const makeStyles = (layout: any) =>
  StyleSheet.create({
    listContent: {
      paddingTop: 0,
      paddingBottom: layout.space.xl,
    },
    headerWrap: {
      paddingHorizontal: layout.space.lg,
      marginBottom: layout.space.sm,
    },
    rowPairWrap: {
      flexDirection: "row",
      gap: layout.space.md,
      paddingHorizontal: layout.space.lg,
      marginBottom: layout.space.md,
    },
    rowSingleWrap: {
      paddingHorizontal: layout.space.lg,
      marginBottom: layout.space.md,
    },
    flex1: { flex: 1 },
  });
