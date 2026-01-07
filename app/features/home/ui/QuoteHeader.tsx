// app/features/home/ui/QuoteHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { Quote } from "../../../../lib/quotes";

export function QuoteHeader({ quote }: { quote: Quote }) {
  const { colors } = useAppTheme();

  const q = String(quote?.text ?? "").trim();
  const author = String(quote?.author ?? "").trim();

  return (
    <View style={{ paddingTop: 10, paddingBottom: 6 }}>
      <Text
        style={{
          color: colors.text,
          fontSize: 30,
          fontWeight: "900",
          letterSpacing: -0.6,
          lineHeight: 34,
          paddingLeft: "6%",
        }}
        numberOfLines={5}
      >
        {q ? (q.startsWith("“") ? q : `“${q}”`) : "“Ready to train?”"}
      </Text>

      {!!author && (
        <Text
          style={{
            marginTop: 8,
            color: colors.subtle,
            fontWeight: "800",
            paddingLeft: "6%",
          }}
          numberOfLines={1}
        >
          — {author}
        </Text>
      )}
    </View>
  );
}
