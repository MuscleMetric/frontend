import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { MiniDonut } from "../ui/MiniDonut"; // adjust path as needed

type Props = {
  colors: any;
  loading: boolean;
  data: { muscle_name: string; pct_of_week: number } | null;
};

export function TopMuscleCardContent({ colors, loading, data }: Props) {
  const s = styles(colors);

  return (
    <View style={{ width: "100%" }}>
      <Text style={s.title}>TOP MUSCLE GROUP LAST 7 DAYS</Text>

      {loading ? (
        <ActivityIndicator />
      ) : data ? (
        <View style={s.row}>
          <MiniDonut
            size={56}
            percent={(data.pct_of_week ?? 0) / 100}
            trackColor={"#E5E7EB55"}
            progressColor={colors.primary}
          />
          <View style={s.textCol}>
            <Text
              style={s.big}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {data.muscle_name}
            </Text>
            <Text style={s.subtle}>{Math.round(data.pct_of_week)}%</Text>
          </View>
        </View>
      ) : (
        <Text style={s.subtle}>Log a session to see focus.</Text>
      )}
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    // content-only styles; parent owns the card chrome
    title: {
      color: colors.subtle,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.5, // smaller so uppercase won’t wrap
      marginBottom: 10,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      // use margins for wide RN support instead of `gap`
    },
    textCol: {
      flex: 1,
      minWidth: 0, // 🔑 allows Text to truncate instead of forcing wrap
      marginLeft: 12,
    },
    big: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22,
    },
    subtle: { color: colors.subtle },
  });
