// app/features/home/HomeScreen.tsx
import React, { useMemo } from "react";
import { FlatList, View } from "react-native";
import { QuoteHeader } from "./ui/QuoteHeader";
import { HomeCardRenderer } from "./HomeCardRenderer";
import { quoteOfTheDay } from "../../../lib/quotes";

type RowItem =
  | { kind: "single"; card: any }
  | { kind: "pair"; left: any; right: any };

function groupHomeCards(cards: any[]): RowItem[] {
  const out: RowItem[] = [];

  for (let i = 0; i < cards.length; i++) {
    const cur = cards[i];
    const next = cards[i + 1];

    // weekly goal + latest PR side-by-side
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
  monthOffset,
  onChangeMonthOffset,
}: {
  summary: any;
  userId: string;
  monthOffset: number;
  onChangeMonthOffset: (next: number) => void;
}) {
  const cards = summary?.cards ?? [];
  const rows = useMemo(() => groupHomeCards(cards), [cards]);

  const dailyQuote = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return quoteOfTheDay(`${userId}|${todayKey}`);
  }, [userId]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row, idx) =>
        row.kind === "pair"
          ? `pair:${row.left?.type}:${row.right?.type}:${idx}`
          : `single:${row.card?.type}:${idx}`
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 8,
        paddingBottom: 20,
      }}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
          <QuoteHeader quote={dailyQuote} />
        </View>
      }
      renderItem={({ item }) => {
        if (item.kind === "pair") {
          return (
            <View
              style={{
                flexDirection: "row",
                gap: 14,
                paddingHorizontal: 16,
                marginBottom: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <HomeCardRenderer
                  card={item.left}
                  summary={summary}
                  monthOffset={monthOffset}
                  onChangeMonthOffset={onChangeMonthOffset}
                />
              </View>

              <View style={{ flex: 1 }}>
                <HomeCardRenderer
                  card={item.right}
                  summary={summary}
                  monthOffset={monthOffset}
                  onChangeMonthOffset={onChangeMonthOffset}
                />
              </View>
            </View>
          );
        }

        return (
          <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <HomeCardRenderer
              card={item.card}
              summary={summary}
              monthOffset={monthOffset}
              onChangeMonthOffset={onChangeMonthOffset}
            />
          </View>
        );
      }}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={8}
    />
  );
}
