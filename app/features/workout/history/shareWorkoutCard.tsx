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
  totalVolumeKg?: number; // optional
  totalDistanceM?: number; // optional
  variant?: "transparent" | "pattern";
  mode?: Mode;
  fullText?: string;
  weeklyStreak?: number; // NEW
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
      totalDistanceM,
      variant = "pattern",
      mode = "stats",
      fullText,
      weeklyStreak,
    },
    ref
  ) => {
    const isFull = mode === "full";
    const hasWeeklyStreak =
      typeof weeklyStreak === "number" && weeklyStreak > 0;

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
          {/* In stats mode we keep the big title at the top.
              In full mode, header (title + date) is rendered inside FullWorkoutBody. */}
          {!isFull && (
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.titleStats} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.date} numberOfLines={1}>
                {dateLabel}
              </Text>
            </View>
          )}

          {/* Body */}
          {isFull ? (
            <FullWorkoutBody
              title={title}
              dateLabel={dateLabel}
              durationLabel={durationLabel}
              exercisesCount={exercisesCount}
              setsCount={setsCount}
              totalVolumeKg={totalVolumeKg ?? 0}
              fullText={fullText}
            />
          ) : (
            <StatsBody
              durationLabel={durationLabel}
              exercisesCount={exercisesCount}
              setsCount={setsCount}
              totalVolumeKg={totalVolumeKg}
              totalDistanceM={totalDistanceM}
            />
          )}

          {/* Weekly streak – centred just above brand footer (both modes) */}
          {hasWeeklyStreak && (
            <View style={styles.weeklyStreakContainer}>
              <WeeklyStreakBadge value={weeklyStreak!} />
            </View>
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

/* ---------- stats-only body ---------- */

function StatsBody({
  durationLabel,
  exercisesCount,
  setsCount,
  totalVolumeKg,
  totalDistanceM,
}: {
  durationLabel: string;
  exercisesCount: number;
  setsCount: number;
  totalVolumeKg?: number;
  totalDistanceM?: number;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statsBlock}>
        <Stat label="Duration" value={durationLabel} />
        <Stat label="Exercises" value={String(exercisesCount)} />
        <Stat label="Total sets" value={String(setsCount)} />

        {typeof totalVolumeKg === "number" && totalVolumeKg > 0 && (
          <Stat
            label="Total volume"
            value={`${totalVolumeKg.toLocaleString()} kg`}
          />
        )}

        {typeof totalDistanceM === "number" && totalDistanceM > 0 && (
          <Stat
            label="Total distance"
            value={`${totalDistanceM.toLocaleString()} m`}
          />
        )}
      </View>
    </View>
  );
}

/* ---------- full-workout body ---------- */

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
  // Build stats from props
  const stats: { label: string; value: string }[] = [
    { label: "Duration", value: durationLabel },
    { label: "Exercises", value: String(exercisesCount) },
    { label: "Total sets", value: String(setsCount) },
  ];

  if (totalVolumeKg > 0) {
    stats.push({
      label: "Total volume",
      value: `${totalVolumeKg.toLocaleString()} kg`,
    });
  }

  // Parse exercises + set lines out of fullText
  type ExerciseBlock = { name: string; setLines: string[] };
  const exerciseBlocks: ExerciseBlock[] = [];

  if (fullText && fullText.trim().length > 0) {
    const raw = fullText.split("\n").map((l) => l.trimEnd());

    // Skip header + stats until first blank line, then blank lines
    let i = 0;
    while (i < raw.length && raw[i].trim() !== "") i++;
    while (i < raw.length && raw[i].trim() === "") i++;

    let current: ExerciseBlock | null = null;

    for (; i < raw.length; i++) {
      const line = raw[i].trimEnd();
      if (line.trim() === "") {
        if (current) {
          exerciseBlocks.push(current);
          current = null;
        }
        continue;
      }

      if (!current) {
        // new exercise heading
        current = { name: line, setLines: [] };
      } else {
        current.setLines.push(line);
      }
    }
    if (current) exerciseBlocks.push(current);
  }

  return (
    <View style={styles.fullBody}>
      {/* Header */}
      <View style={styles.fullHeaderRight}>
        <Text style={styles.titleFull} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.dateFull} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>

      {/* Stats – full width rows label left / value right */}
      <View style={styles.fullStatsBlock}>
        {stats.map((s) => (
          <View key={s.label} style={styles.fullStatRow}>
            <Text style={styles.fullStatLabel}>{s.label}</Text>
            <Text style={styles.fullStatValue} numberOfLines={1}>
              {s.value}
            </Text>
          </View>
        ))}
      </View>

      {/* 10 padding gap before exercises */}
      <View style={{ height: 10 }} />

      {/* Exercises + sets, small gap between each exercise */}
      {exerciseBlocks.map((ex, idx) => (
        <View
          key={`${ex.name}-${idx}`}
          style={[
            styles.exerciseBlock,
            { marginBottom: idx === exerciseBlocks.length - 1 ? 0 : 2 },
          ]}
        >
          <Text style={styles.exerciseName}>{ex.name}</Text>
          {ex.setLines.map((line, j) => (
            <Text key={j} style={styles.exerciseSetLine}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ---------- tiny stat row component (stats mode) ---------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- Weekly streak badge ---------- */

function WeeklyStreakBadge({ value }: { value: number }) {
  return (
    <View style={styles.streakWrapper}>
      <View style={styles.streakCircle}>
        <Text style={styles.streakNumber}>{value}</Text>
      </View>
      <Text style={styles.streakLabel}>Weekly Streak!</Text>
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

  // titles (stats mode)
  titleStats: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  date: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "600",
    color: "#E5E7EB",
  },

  // stats mode
  statsRow: {
    marginTop: 16,
  },
  statsBlock: {
    width: "100%",
    alignSelf: "stretch",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 26,
    fontWeight: "600",
    color: "#E5E7EB",
    opacity: 0.85,
    textAlign: "left",
  },
  statValue: {
    marginTop: 0,
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "right",
  },

  // full-workout mode
  fullBody: {
    flexGrow: 1,
    marginTop: 8,
    marginBottom: 24,
    alignSelf: "stretch",
  },

  fullHeaderRight: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  titleFull: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  dateFull: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "600",
    color: "#E5E7EB",
  },

  fullStatsBlock: {
    width: "100%",
  },
  fullStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  fullStatLabel: {
    fontSize: 22,
    fontWeight: "600",
    color: "#E5E7EB",
    opacity: 0.9,
  },
  fullStatValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  exerciseBlock: {
    paddingTop: 4,
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  exerciseSetLine: {
    fontSize: 18,
    fontWeight: "400",
    color: "#F9FAFB",
    lineHeight: 22,
  },

  // weekly streak – now just above brand footer
  weeklyStreakContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  streakWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  streakCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 50,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  streakLabel: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // brand
  footer: {
    alignItems: "center",
  },
  brand: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#FFFFFF",
  },
});
