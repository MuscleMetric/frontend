import React, { useMemo } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { QuoteHeader } from "../ui/QuoteHeader";
import { HomeCardRenderer } from "../ui/HomeCardRenderer";
import { quoteOfTheDay } from "../../../../lib/quotes";
import type { Quote } from "../../../../lib/quotes";
import { pickCard, excludeTypes } from "./homeLayoutHelpers";
import { NewUserProgressCard } from "../ui/cards/NewUserProgressCard";

export function HomeNewUser({
  summary,
  userId,
}: {
  summary: any;
  userId: string;
}) {
  const { layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(layout), [layout]);

  const cards = summary?.cards ?? [];

  // new_user should always start with hero
  const hero = useMemo(() => pickCard(cards, "hero"), [cards]);

  const dailyQuote: Quote = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return quoteOfTheDay(`${userId}|${todayKey}`);
  }, [userId]);

  // For new users, you may later add bespoke blocks (unlock cards, starters).
  // For now we render the rest defensively.
  const rest = useMemo(() => excludeTypes(cards, ["hero"]), [cards]);

  return (
    <FlatList
      data={rest}
      keyExtractor={(c, idx) => `${c?.type ?? "unknown"}:${idx}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View>
          {/* Primary action first */}
          <View style={styles.block}>
            <HomeCardRenderer card={hero} summary={summary} />
          </View>

          {/* Quote always visible below primary */}
          <View style={styles.quoteWrap}>
            <QuoteHeader quote={dailyQuote} />
          </View>

          <View style={styles.block}>
            <NewUserProgressCard
              completed={summary?.user?.workouts_total ?? 0}
              target={5}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.block}>
          <HomeCardRenderer card={item} summary={summary} />
        </View>
      )}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={8}
    />
  );
}

const makeStyles = (layout: any) =>
  StyleSheet.create({
    listContent: { paddingBottom: layout.space.xl },
    block: {
      paddingHorizontal: layout.space.lg,
      marginBottom: layout.space.md,
    },
    quoteWrap: {
      paddingHorizontal: layout.space.lg,
      marginTop: layout.space.sm,
      marginBottom: layout.space.lg,
    },
  });
