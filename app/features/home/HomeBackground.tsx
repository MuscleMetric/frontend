import React, { useMemo } from "react";
import { View } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";
import { homeTokens } from "./ui/homeTheme";

export function HomeBackground() {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* top glow */}
      <View
        style={{
          position: "absolute",
          top: -140,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: 320,
          backgroundColor: t.isDark ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.12)",
        }}
      />
      {/* secondary glow */}
      <View
        style={{
          position: "absolute",
          top: -120,
          right: -110,
          width: 360,
          height: 360,
          borderRadius: 360,
          backgroundColor: t.isDark ? "rgba(34,197,94,0.14)" : "rgba(34,197,94,0.08)",
        }}
      />
    </View>
  );
}
