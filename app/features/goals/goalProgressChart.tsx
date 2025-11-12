// app/(features)/goals/GoalProgressChart.tsx
import React, { useMemo } from "react";
import { View } from "react-native";
import {
  VictoryChart,
  VictoryAxis,
  VictoryLine,
  VictoryScatter,
  VictoryGroup,
  VictoryVoronoiContainer,
  VictoryTooltip,
} from "victory-native";

type SessionPoint = {
  // ISO date string
  date: string;
  // heaviest set weight for that exercise in this session
  weight: number;
};

type Props = {
  // for axis label & colors if you want to theme outside
  colorActual?: string;
  colorGuide?: string;
  unit?: string | null; // "kg" | "lb" | null
  // data
  sessions: SessionPoint[]; // sorted by date asc (we’ll sort again safely)
  startWeight: number | null; // from goal.notes.start if present; else first session weight
  targetWeight: number; // goal.target_number
  // How to construct guidance steps:
  // "fitToSessions" => make N equal steps from start to target for N sessions so far
  // "fixedCount" => use plannedSessions to spread steps (if provided)
  mode?: "fitToSessions" | "fixedCount";
  plannedSessions?: number; // only used if mode === "fixedCount"
};

export default function GoalProgressChart({
  sessions,
  startWeight,
  targetWeight,
  unit,
  colorActual = "#6ea8fe",
  colorGuide = "#94d82d",
  mode = "fitToSessions",
  plannedSessions,
}: Props) {
  const { actual, guide } = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    // Build x as strictly increasing indices for clean plotting (Victory can do Date, but
    // using indices avoids tick crowding and makes session-stepped guidance simple).
    const xs = sorted.map((_, i) => i + 1);

    // Actual: map to points (index, weight)
    const actualPoints = sorted.map((s, i) => ({
      x: i + 1,
      y: s.weight,
      date: s.date,
    }));

    // Establish start
    const start =
      typeof startWeight === "number"
        ? startWeight
        : sorted.length
        ? sorted[0].weight
        : 0;

    // Compute number of steps
    const steps =
      mode === "fixedCount" && plannedSessions && plannedSessions > 0
        ? plannedSessions
        : Math.max(1, xs.length); // fit to sessions (at least 1 to avoid div-by-zero)

    // Step size
    const step = (targetWeight - start) / steps;

    // Guidance is a step function that jumps each session index
    // For N sessions shown, we generate N points so the last point reaches the target (fitToSessions).
    const guidePoints =
      xs.length === 0
        ? []
        : xs.map((idx) => {
            const y = start + step * idx;
            return { x: idx, y };
          });

    return { actual: actualPoints, guide: guidePoints };
  }, [sessions, startWeight, targetWeight, mode, plannedSessions]);

  // Axis labels
  const yLabel = unit ? `Weight (${unit})` : "Weight";

  // Domain paddings so points aren't pinned to the frame
  const yValues = [...actual.map(p => p.y), ...guide.map(p => p.y)];
  const yMin = Math.min(...yValues, isFinite as any) || 0;
  const yMax = Math.max(...yValues, isFinite as any) || 0;
  const pad = Math.max(1, Math.round((yMax - yMin) * 0.1));

  return (
    <View style={{ height: 220 }}>
      <VictoryChart
        padding={{ top: 12, right: 12, bottom: 36, left: 48 }}
        domain={{ x: [1, Math.max(1, actual.length || guide.length)], y: [yMin - pad, yMax + pad] }}
        containerComponent={
          <VictoryVoronoiContainer
            labels={({ datum }: any) =>
              datum?.date
                ? `Session: ${datum.x}\n${yLabel}: ${datum.y}\n${new Date(datum.date).toLocaleDateString()}`
                : `Session: ${datum.x}\n${yLabel}: ${datum.y}`
            }
            labelComponent={<VictoryTooltip constrainToVisibleArea />}
          />
        }
      >
        <VictoryAxis
          label="Sessions"
          style={{
            axisLabel: { padding: 28, fontSize: 11 },
            tickLabels: { fontSize: 10 },
          }}
          tickFormat={(t) => `${t}`}
        />
        <VictoryAxis
          dependentAxis
          label={yLabel}
          style={{
            axisLabel: { padding: 36, fontSize: 11 },
            tickLabels: { fontSize: 10 },
          }}
        />

        {/* Guidance line */}
        <VictoryLine
          data={guide}
          style={{ data: { stroke: colorGuide, strokeWidth: 2, strokeDasharray: "6,4" } }}
        />

        {/* Actual line + points */}
        <VictoryGroup data={actual}>
          <VictoryLine style={{ data: { stroke: colorActual, strokeWidth: 2 } }} />
          <VictoryScatter size={3.5} style={{ data: { fill: colorActual } }} />
        </VictoryGroup>
      </VictoryChart>
    </View>
  );
}
