import React, { useMemo } from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

type Variant = "overlay" | "stats";

export function WorkoutSummaryCard({
  imageUri,
  kicker = "BASELINE ESTABLISHED",
  workoutTitle,
  durationLabel,
  setsLabel,
  volumeLabel,
  volumeUnit = "kg",

  // ✅ new
  variant = "overlay",
  showImage,
}: {
  imageUri?: string;
  kicker?: string;
  workoutTitle: string;
  durationLabel: string;
  setsLabel: string;
  volumeLabel: string;
  volumeUnit?: string;

  variant?: Variant;
  showImage?: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const shouldShowImage =
    showImage ?? (variant === "overlay" ? !!imageUri : false);

  // ✅ STATS-ONLY CARD (for your new design with WorkoutCover above)
  if (variant === "stats") {
    return (
      <View style={styles.statsShell}>
        <View style={styles.statsTopRow}>
          <View style={styles.statsMetric}>
            <Text style={styles.statsMetricLabel}>DURATION</Text>
            <View style={styles.statsValueRow}>
              <Icon name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.statsMetricValue}>{durationLabel}</Text>
            </View>
          </View>

          <View style={styles.statsMetric}>
            <Text style={styles.statsMetricLabel}>SETS LOGGED</Text>
            <View style={styles.statsValueRow}>
              <Icon
                name="clipboard-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.statsMetricValue}>{setsLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsDivider} />

        <View style={styles.statsVolume}>
          <Text style={styles.statsVolumeLabel}>TOTAL VOLUME MOVED</Text>
          <View style={styles.statsVolumeRow}>
            <Text style={styles.statsVolumeValue}>{volumeLabel}</Text>
            <Text style={styles.statsVolumeUnit}>{volumeUnit}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ LEGACY OVERLAY CARD (kept for backwards compatibility)
  return (
    <View style={styles.shell}>
      <ImageBackground
        source={shouldShowImage ? { uri: imageUri! } : undefined}
        style={styles.bg}
        imageStyle={styles.bgImg}
      >
        <View style={styles.overlay} />

        <View style={styles.top}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{workoutTitle}</Text>
        </View>

        <View style={styles.midRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>DURATION</Text>
            <View style={styles.metricValueRow}>
              <Icon name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.metricValue}>{durationLabel}</Text>
            </View>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>SETS LOGGED</Text>
            <View style={styles.metricValueRow}>
              <Icon
                name="clipboard-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.metricValue}>{setsLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.volume}>
          <Text style={styles.volumeLabel}>TOTAL VOLUME MOVED</Text>
          <View style={styles.volumeRow}>
            <Text style={styles.volumeValue}>{volumeLabel}</Text>
            <Text style={styles.volumeUnit}>{volumeUnit}</Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    // ---------------- LEGACY (overlay) ----------------
    shell: {
      borderRadius: layout.radius.xl,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bg: {
      minHeight: 360,
      padding: 18,
      justifyContent: "space-between",
    },
    bgImg: {
      resizeMode: "cover",
      opacity: 0.9,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    top: { paddingTop: 6 },
    kicker: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.4,
      fontSize: 12,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    title: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: 24,
      letterSpacing: -0.4,
    },
    midRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 14,
      marginTop: 18,
    },
    metric: { flex: 1 },
    metricLabel: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.2,
      fontSize: 11,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    metricValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    metricValue: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: 22,
      letterSpacing: -0.2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.14)",
      marginTop: 16,
    },
    volume: {
      alignItems: "center",
      paddingTop: 14,
      paddingBottom: 2,
    },
    volumeLabel: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.2,
      fontSize: 11,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    volumeRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    volumeValue: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: 40,
      letterSpacing: -1.0,
    },
    volumeUnit: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      letterSpacing: 0.2,
    },

    // ---------------- NEW (stats only) ----------------
    statsShell: {
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 18,
    },

    statsTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 14,
    },

    statsMetric: { flex: 1 },

    statsMetricLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.1,
      fontSize: 11,
      marginBottom: 8,
      textTransform: "uppercase",
    },

    statsValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    statsMetricValue: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 22,
      letterSpacing: -0.2,
    },

    statsDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginTop: 16,
    },

    statsVolume: {
      alignItems: "center",
      paddingTop: 14,
    },

    statsVolumeLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.1,
      fontSize: 11,
      textTransform: "uppercase",
      marginBottom: 8,
    },

    statsVolumeRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },

    statsVolumeValue: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 40,
      letterSpacing: -1.0,
    },

    statsVolumeUnit: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      letterSpacing: 0.2,
    },
  });
