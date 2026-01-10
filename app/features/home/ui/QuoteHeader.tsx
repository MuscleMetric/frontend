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

  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

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
      paddingVertical: layout.space.md,
      alignItems: "center",
    },

    quote: {
      color: colors.text,
      textAlign: "center",
      fontSize: typography.size.xl,          // ↓ slightly smaller than hero
      lineHeight: typography.lineHeight.xl,  // tighter than hero
      fontFamily: typography.fontFamily.bold,
      letterSpacing: -0.4,
    },

    author: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      fontStyle: "italic",   // ✅ tasteful here
      textAlign: "center",
    },
  });
