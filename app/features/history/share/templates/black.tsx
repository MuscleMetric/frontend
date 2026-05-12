// app/(features)/workouts/share/templates/black.tsx

import React, { useMemo } from "react";
import { View, Text } from "react-native";
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

export function BlackShareCard({
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
        backgroundColor: "#000000",
        paddingHorizontal: styles.horizontalPadding,
        paddingTop: 140,
        paddingBottom: 90,
      }}
    >
      <View style={{ flex: 1 }}>
        {/* TOP */}
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
            }}
          >
            {data.title}
          </Text>

          <Text
            style={{
              marginTop: 20,
              color: "rgba(255,255,255,0.72)",
              textAlign: "center",
              fontSize: 28,
              letterSpacing: 0.3,
              fontFamily: typography.fontFamily.medium,
            }}
          >
            {data.dateLabel}
          </Text>
        </View>

        {/* CENTER */}
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
                  borderBottomColor: "rgba(255,255,255,0.08)",
                  paddingBottom: 18,
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.68)",
                    fontSize: 30,
                    letterSpacing: 0.5,
                    fontFamily: typography.fontFamily.medium,
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
                borderColor: "rgba(255,255,255,0.12)",
                borderRadius: 32,
                padding: 32,
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
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
                        color: "rgba(255,255,255,0.74)",
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

        {/* FOOTER */}
        <View>
          <Text
            style={{
              textAlign: "center",
              color: "#FFFFFF",
              fontSize: 30,
              letterSpacing: 1.2,
              fontFamily: typography.fontFamily.semibold,
            }}
          >
            Trained with MuscleMetric
          </Text>
        </View>
      </View>
    </View>
  );
}