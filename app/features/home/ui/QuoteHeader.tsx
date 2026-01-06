// app/features/home/ui/QuoteHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function QuoteHeader({ quote }: { quote: string }) {
  const { colors } = useAppTheme();

  const raw = String(quote ?? "").trim();
  const parts = raw.split("—");
  const q = (parts[0] ?? "").trim();
  const author = parts.length > 1 ? parts.slice(1).join("—").trim() : "";

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
        numberOfLines={3}
      >
        {q ? (q.startsWith("“") ? q : `“${q}”`) : "“Ready to train?”"}
      </Text>

      {!!author && (
        <Text
          style={{
            marginTop: 8,
            color: colors.subtle,
            fontWeight: "800",
          }}
          numberOfLines={1}
        >
          — {author}
        </Text>
      )}
    </View>
  );
}
