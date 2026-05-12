import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ShareWorkoutData } from "../workoutShare";

function formatVolume(v?: number | null) {
  if (v == null) return null;
  const rounded = Math.round(v);
  return `${rounded.toLocaleString()} kg`;
}

function formatDistance(v?: number | null) {
  if (v == null || v <= 0) return null;
  return `${Math.round(v * 100) / 100} km`;
}

export function TransparentShareCard({
  data,
  width,
  height,
}: {
  data: ShareWorkoutData;
  width: number;
  height: number;
}) {
  const { typography } = useAppTheme();

  const styles = useMemo(
    () => ({
      horizontalPadding: Math.round(width * 0.08),
    }),
    [width],
  );

  const hasPrs = (data.prs?.length ?? 0) > 0;

  const statRows = [
    { label: "Duration", value: data.durationLabel || "—" },
    { label: "Total Sets", value: data.totalSets != null ? String(data.totalSets) : null },
    { label: "Total Volume", value: formatVolume(data.totalVolumeKg) },
    { label: "Distance", value: formatDistance(data.totalDistanceKm) },
    { label: "PRs", value: hasPrs ? String(data.prs.length) : null },
  ].filter((x) => !!x.value);

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "transparent",
        paddingHorizontal: styles.horizontalPadding,
        paddingTop: 140,
        paddingBottom: 90,
      }}
    >
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.64)",
          "rgba(0,0,0,0.28)",
          "rgba(0,0,0,0.12)",
          "rgba(0,0,0,0.55)",
        ]}
        locations={[0, 0.28, 0.62, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      />

      <View style={{ flex: 1 }}>
        <View>
          <Text
            numberOfLines={2}
            style={{
              color: "#FFFFFF",
              textAlign: "center",
              fontSize: 74,
              lineHeight: 78,
              letterSpacing: -2,
              fontFamily: typography.fontFamily.bold,
              textShadowColor: "rgba(0,0,0,0.55)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 12,
            }}
          >
            {data.title}
          </Text>

          <Text
            style={{
              marginTop: 20,
              color: "#FFFFFF",
              textAlign: "center",
              fontSize: 28,
              letterSpacing: 0.3,
              fontFamily: typography.fontFamily.medium,
              textShadowColor: "rgba(0,0,0,0.55)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 10,
            }}
          >
            {data.dateLabel}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
          }}
        >
          <View style={{ gap: 28 }}>
            {statRows.map((row) => (
              <View
                key={row.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.2)",
                  paddingBottom: 18,
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.82)",
                    fontSize: 30,
                    letterSpacing: 0.5,
                    fontFamily: typography.fontFamily.medium,
                    textShadowColor: "rgba(0,0,0,0.45)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 8,
                  }}
                >
                  {row.label}
                </Text>

                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 34,
                    letterSpacing: -0.5,
                    fontFamily: typography.fontFamily.bold,
                    textShadowColor: "rgba(0,0,0,0.55)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 8,
                  }}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {hasPrs ? (
            <View
              style={{
                marginTop: 80,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.24)",
                borderRadius: 32,
                padding: 32,
                backgroundColor: "rgba(0,0,0,0.26)",
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 22,
                  letterSpacing: 2,
                  marginBottom: 20,
                  fontFamily: typography.fontFamily.semibold,
                }}
              >
                PERSONAL BESTS
              </Text>

              <View style={{ gap: 18 }}>
                {data.prs.slice(0, 4).map((pr, index) => (
                  <View
                    key={`${pr.exerciseName}-${index}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: "#FFFFFF",
                        fontSize: 28,
                        paddingRight: 20,
                        fontFamily: typography.fontFamily.semibold,
                      }}
                    >
                      {pr.exerciseName}
                    </Text>

                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 24,
                        fontFamily: typography.fontFamily.medium,
                      }}
                    >
                      {pr.value || "PR"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <Text
          style={{
            textAlign: "center",
            color: "#FFFFFF",
            fontSize: 30,
            letterSpacing: 1.2,
            fontFamily: typography.fontFamily.semibold,
            textShadowColor: "rgba(0,0,0,0.65)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 10,
          }}
        >
          Trained with MuscleMetric
        </Text>
      </View>
    </View>
  );
}