import React from "react";
import { ImageBackground, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { resolveWorkoutCover } from "./workoutCovers";

export function WorkoutCover({
  imageKey,
  title,
  subtitle,
  height = 120,
  radius,
  style,
  children,
}: {
  imageKey?: string | null;
  title?: string | null;
  subtitle?: string | null;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  children?: React.ReactNode; // optional right-side actions etc.
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = React.useMemo(
    () => makeStyles(colors, typography, layout, height, radius ?? layout.radius.lg),
    [colors, typography, layout, height, radius]
  );

  return (
    <ImageBackground source={resolveWorkoutCover(imageKey)} style={[styles.bg, style]} imageStyle={styles.img}>
      {/* dark overlay */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        <View style={{ flex: 1, gap: 4 }}>
          {!!title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}

          {!!subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {!!children ? <View style={styles.right}>{children}</View> : null}
      </View>
    </ImageBackground>
  );
}

const makeStyles = (colors: any, typography: any, layout: any, height: number, radius: number) =>
  StyleSheet.create({
    bg: {
      height,
      borderRadius: radius,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    img: {
      borderRadius: radius,
      resizeMode: "cover",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.40)", // keep consistent everywhere
    },
    content: {
      flex: 1,
      padding: layout.space.md,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3 ?? typography.size.h2,
      color: "#fff",
      letterSpacing: -0.3,
    },
    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: "rgba(255,255,255,0.85)",
    },
    right: {
      alignSelf: "flex-end",
    },
  });
