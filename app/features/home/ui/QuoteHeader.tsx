// app/features/home/ui/QuoteHeader.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { Quote } from "../../../../lib/quotes";

export function QuoteHeader({ quote }: { quote: Quote }) {
  const { colors, typography, layout } = useAppTheme();

  const q = String(quote?.text ?? "").trim();
  const author = String(quote?.author ?? "").trim();

  const displayQuote = q
    ? q.startsWith("“")
      ? q
      : `“${q}”`
    : "“Ready to train?”";

  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.quote} numberOfLines={5}>
        {displayQuote}
      </Text>

      {!!author && (
        <Text style={styles.author} numberOfLines={1}>
          — {author}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      paddingTop: layout.space.sm,
      paddingBottom: layout.space.sm,
    },

    // Big, but not ridiculous. Premium and readable.
    quote: {
      color: colors.text,
      fontSize: typography.size.hero, // 36 by your tokens
      lineHeight: typography.lineHeight.hero, // 44
      fontFamily: typography.fontFamily.bold,
      letterSpacing: -0.6,
    },

    author: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
    },
  });
