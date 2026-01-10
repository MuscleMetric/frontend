import React, { useMemo, useCallback } from "react";
import { FlatList, View, StyleSheet, ListRenderItem } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { QuoteHeader } from "../ui/QuoteHeader";
import { HomeCardRenderer } from "../ui/HomeCardRenderer";
import { quoteOfTheDay } from "../../../../lib/quotes";
import type { Quote } from "../../../../lib/quotes";
import { pickCard, excludeTypes } from "./homeLayoutHelpers";

type RowItem =
  | { kind: "pair"; left: any; right: any }
  | { kind: "single"; card: any };

function toRows(cards: any[]): RowItem[] {
  const out: RowItem[] = [];
  for (let i = 0; i < cards.length; i++) {
    const cur = cards[i];
    const next = cards[i + 1];

    if (cur?.type === "weekly_goal" && next?.type === "latest_pr") {
      out.push({ kind: "pair", left: cur, right: next });
      i++;
      continue;
    }
    out.push({ kind: "single", card: cur });
  }
  return out;
}

export function HomeExperiencedNoPlan({
  summary,
  userId,
}: {
  summary: any;
  userId: string;
}) {
  const { layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(layout), [layout]);

  const cards = summary?.cards ?? [];
  const hero = useMemo(() => pickCard(cards, "hero"), [cards]);

  const dailyQuote: Quote = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return quoteOfTheDay(`${userId}|${todayKey}`);
  }, [userId]);

  // Layout order is owned here (not backend order):
  // weekly_goal + latest_pr pairing, then streak, then any leftovers
  const ordered = useMemo(() => {
    const weekly = pickCard(cards, "weekly_goal");
    const pr = pickCard(cards, "latest_pr");
    const streak = pickCard(cards, "streak");

    const core: any[] = [];
    if (weekly) core.push(weekly);
    if (pr) core.push(pr);
    if (streak) core.push(streak);

    const leftovers = excludeTypes(cards, ["hero", "weekly_goal", "latest_pr", "streak"]);
    return [...core, ...leftovers];
  }, [cards]);

  const rows = useMemo(() => toRows(ordered), [ordered]);

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
        <View>
          {/* Primary action first */}
          <View style={styles.rowSingleWrap}>
            <HomeCardRenderer card={hero} summary={summary} />
          </View>

          {/* Quote always below primary */}
          <View style={styles.quoteWrap}>
            <QuoteHeader quote={dailyQuote} />
          </View>
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
    listContent: { paddingBottom: layout.space.xl },
    quoteWrap: {
      paddingHorizontal: layout.space.lg,
      marginTop: layout.space.sm,
      marginBottom: layout.space.lg,
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
