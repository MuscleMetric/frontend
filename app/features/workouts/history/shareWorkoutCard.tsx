// app/features/history/ShareWorkoutCard.tsx
import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";

type Mode = "stats" | "full";

type Props = {
  colors: any;
  title: string;
  dateLabel: string;
  durationLabel: string;
  exercisesCount: number;
  setsCount: number;
  totalVolumeKg: number;
  variant?: "transparent" | "pattern";
  mode?: Mode;
  fullText?: string; // for full mode
};

const CARD_WIDTH = 720;
const CARD_HEIGHT = 1280;

export const ShareWorkoutCard = forwardRef<View, Props>(
  (
    {
      colors,
      title,
      dateLabel,
      durationLabel,
      exercisesCount,
      setsCount,
      totalVolumeKg,
      variant = "pattern",
      mode = "stats",
      fullText,
    },
    ref
  ) => {
    const isFull = mode === "full";

    return (
      <View
        ref={ref}
        style={[
          styles.root,
          {
            backgroundColor:
              variant === "transparent" ? "transparent" : "#05060A",
          },
        ]}
      >
        {variant === "pattern" && <PatternBackground />}

        <View style={styles.content}>
          {/* Header */}
          <View style={{ marginBottom: isFull ? 16 : 32 }}>
            <Text
              style={isFull ? styles.titleFull : styles.titleStats}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={styles.date} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>

          {/* Body */}
          {isFull ? (
            <FullWorkoutBody
              title={title}
              dateLabel={dateLabel}
              durationLabel={durationLabel}
              exercisesCount={exercisesCount}
              setsCount={setsCount}
              totalVolumeKg={totalVolumeKg}
              fullText={fullText}
            />
          ) : (
            <StatsBody
              durationLabel={durationLabel}
              exercisesCount={exercisesCount}
              setsCount={setsCount}
              totalVolumeKg={totalVolumeKg}
            />
          )}

          {/* Brand footer */}
          <View style={styles.footer}>
            <Text style={styles.brand}>MUSCLEMETRIC</Text>
          </View>
        </View>
      </View>
    );
  }
);

/* ---------- sub-sections ---------- */

function StatsBody({
  durationLabel,
  exercisesCount,
  setsCount,
  totalVolumeKg,
}: {
  durationLabel: string;
  exercisesCount: number;
  setsCount: number;
  totalVolumeKg: number;
}) {
  return (
    <View style={styles.statsRow}>
      <Stat label="Duration" value={durationLabel} />
      <Stat label="Exercises" value={String(exercisesCount)} />
      <Stat label="Total sets" value={String(setsCount)} />
      <Stat
        label="Total volume"
        value={`${totalVolumeKg.toLocaleString()} kg`}
      />
    </View>
  );
}

function FullWorkoutBody({
  title,
  dateLabel,
  durationLabel,
  exercisesCount,
  setsCount,
  totalVolumeKg,
  fullText,
}: {
  title: string;
  dateLabel: string;
  durationLabel: string;
  exercisesCount: number;
  setsCount: number;
  totalVolumeKg: number;
  fullText?: string;
}) {
  // Default header lines (used when no fullText provided)
  const headerLines = [
    `${title} — ${dateLabel}`,
    `Duration: ${durationLabel}`,
    `Exercises: ${exercisesCount}`,
    `Total sets: ${setsCount}`,
    `Total volume: ${totalVolumeKg.toLocaleString()} kg`,
  ];

  const hasFullText = !!fullText && fullText.trim().length > 0;
  const lines = hasFullText
    ? fullText!
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0)
    : headerLines;

  return (
    <View style={styles.fullBody}>
      {lines.map((line, idx) => (
        <Text key={idx} style={styles.fullLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- background pattern ---------- */

function PatternBackground() {
  const base = "#05060A";
  const accent = "#15161C";

  const rows = 16;
  const cols = 8;

  return (
    <View style={styles.pattern}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.patternRow}>
          {Array.from({ length: cols }).map((_, c) => {
            const isAccent = (r + c) % 2 === 0;
            return (
              <View
                key={c}
                style={[
                  styles.patternCell,
                  { backgroundColor: isAccent ? accent : base },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  root: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 40,
    overflow: "hidden",
  },

  // pattern grid
  pattern: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
  },
  patternRow: {
    flex: 1,
    flexDirection: "row",
  },
  patternCell: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 52,
    paddingBottom: 40,
    justifyContent: "space-between",
  },

  // titles
  titleStats: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  titleFull: {
    fontSize: 52, // was 40
    fontWeight: "900",
    color: "#FFFFFF",
  },
  date: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "600",
    color: "#E5E7EB",
  },

  // stats mode
  statsRow: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },
  statBox: {
    width: "47%",
  },
  statLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E5E7EB",
    opacity: 0.85,
  },
  statValue: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  // full-workout mode
  fullBody: {
    flexGrow: 1,
    marginTop: 18, // a bit more space under title
    marginBottom: 24,
    alignSelf: "stretch", // keep aligned with the title, not centred
  },
  fullSectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 10,
  },
  fullLine: {
    fontSize: 22, // slightly larger
    fontWeight: "400",
    color: "#F9FAFB",
    lineHeight: 24, // more vertical breathing room
    marginBottom: 4,
  },

  // brand
  footer: {
    alignItems: "center",
    marginTop: 8,
  },
  brand: {
    fontSize: 36, // match titleFull size
    fontWeight: "900",
    letterSpacing: 4,
    color: "#FFFFFF",
  },
});
