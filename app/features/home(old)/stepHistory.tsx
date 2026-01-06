// app/features/home/stepHistory.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
} from "react-native";
import Svg, { Polyline, Line, Circle } from "react-native-svg";
import { useAppTheme } from "../../../lib/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";

type Props = {
  steps7?: number[];
  stepsGoal?: number;
};

const RANGES = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

export default function StepHistoryScreen(p: Props) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const params = useLocalSearchParams();
  const defaultGoal = p.stepsGoal ?? Number(params.stepsGoal ?? 10000);

  const [days, setDays] = React.useState<RangeDays>(7);
  const [steps, setSteps] = React.useState<number[]>(
    p.steps7 ??
      (params.steps7 ? JSON.parse(String(params.steps7)) : Array(7).fill(0))
  );
  const [goal, setGoal] = React.useState<number>(defaultGoal);
  const [loading, setLoading] = React.useState<boolean>(false);

  // NEW: track earliest day we have data for + computed max selectable days
  const [earliestDay, setEarliestDay] = React.useState<Date | null>(null);
  const [maxDaysAvail, setMaxDaysAvail] = React.useState<number>(7);

  // Load earliest day + goal once
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) {
        // If we only have in-memory steps from params, limit by its length
        setMaxDaysAvail(steps.length || 7);
        return;
      }
      // profiles.steps_goal
      const { data: prof } = await supabase
        .from("profiles")
        .select("steps_goal")
        .eq("id", userId)
        .maybeSingle();
      if (alive && prof?.steps_goal) setGoal(Number(prof.steps_goal));

      // earliest daily_steps.day
      const { data: minRow } = await supabase
        .from("daily_steps")
        .select("day")
        .eq("user_id", userId)
        .order("day", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (alive) {
        if (minRow?.day) {
          const d = new Date(String(minRow.day));
          setEarliestDay(d);
          const today = new Date();
          const diffDays =
            Math.floor(
              (today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) /
                (1000 * 60 * 60 * 24)
            ) + 1; // inclusive
          setMaxDaysAvail(Math.max(1, diffDays));
        } else {
          // no rows yet: allow only 7 days (empty)
          setEarliestDay(null);
          setMaxDaysAvail(7);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Reload data when range changes (clamped to max available)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      // Clamp days to max available
      const clampedDays = Math.min(days, maxDaysAvail);
      if (clampedDays !== days) {
        setDays(clampedDays as RangeDays);
      }

      if (!userId) return; // params-only mode: keep provided data
      setLoading(true);
      try {
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - (clampedDays - 1));

        const { data: ds } = await supabase
          .from("daily_steps")
          .select("day, steps")
          .eq("user_id", userId)
          .gte("day", from.toISOString().slice(0, 10))
          .lte("day", today.toISOString().slice(0, 10))
          .order("day", { ascending: true });

        if (alive) {
          const map = new Map<string, number>();
          (ds ?? []).forEach((r: any) =>
            map.set(String(r.day).slice(0, 10), r.steps ?? 0)
          );
          const arr: number[] = [];
          for (let i = clampedDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            arr.push(map.get(key) ?? 0);
          }
          setSteps(arr);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, days, maxDaysAvail]);

  // Average of daily percentages (cap each day at 100%)
  const avgDailyPct =
    goal > 0 && steps.length > 0
      ? (steps.reduce((sum, v) => sum + Math.min(1, v / goal), 0) /
          steps.length) *
        100
      : 0;

  // Build pills with disabled state if beyond available history
  const pills = RANGES.map((r) => {
    const disabled = r > maxDaysAvail;
    return {
      value: r,
      label: r === 7 ? "7D" : r === 14 ? "2W" : r === 30 ? "1M" : "3M",
      disabled,
    };
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        <View style={{ marginBottom: 4 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
                marginRight: 4,
              }}
            >
              ←
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              Back
            </Text>
          </Pressable>
        </View>
        {/* Range selector (centered) */}
        <View style={styles(colors).rangeRow}>
          {pills.map(({ value, label, disabled }) => {
            const active = value === days;
            return (
              <Pressable
                key={value}
                onPress={() => !disabled && setDays(value as RangeDays)}
                style={[
                  styles(colors).pill,
                  active && { backgroundColor: colors.primaryBg },
                  disabled && { opacity: 0.45 },
                ]}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles(colors).pillText,
                    active && { color: colors.primaryText },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles(colors).card}>
          <Text style={styles(colors).title}>
            Steps — Last {days} Day{days > 1 ? "s" : ""}
          </Text>
          <Text style={styles(colors).subtle}>
            Avg daily goal reached:{" "}
            <Text style={styles(colors).big}>{Math.round(avgDailyPct)}%</Text> •
            Daily goal: {formatNumber(goal)}
          </Text>

          {/* Optional: show “from <date>” if we have an earliest day */}
          {earliestDay && (
            <Text style={[styles(colors).subtle, { marginTop: -8 }]}>
              History available from {earliestDay.toLocaleDateString()}
            </Text>
          )}

          {/* Center the chart */}
          <View style={styles(colors).chartContainer}>
            <StepsChart
              colors={colors}
              data={steps}
              dailyGoal={goal}
              height={280}
              leftPadding={56}
              rightPadding={20}
              bottomPadding={34}
              topPadding={18}
              showDots
              xLabels={buildXLabels(days)}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ---------------- Chart component (unchanged from prior except props) ---------------- */
function StepsChart({
  colors,
  data,
  dailyGoal,
  xLabels,
  height = 280,
  leftPadding = 56,
  rightPadding = 20,
  topPadding = 18,
  bottomPadding = 34,
  showDots = true,
  loading = false,
}: {
  colors: any;
  data: number[];
  dailyGoal: number;
  xLabels: string[];
  height?: number;
  leftPadding?: number;
  rightPadding?: number;
  topPadding?: number;
  bottomPadding?: number;
  showDots?: boolean;
  loading?: boolean;
}) {
  const [width, setWidth] = React.useState(0);
  const n = Math.max(1, data.length);

  const rawMax = Math.max(dailyGoal || 0, ...data, 1);
  const { yMax, step } = niceYAxis(rawMax);
  const yTicks = Math.round(yMax / step);

  const innerW = Math.max(0, width - leftPadding - rightPadding);
  const innerH = Math.max(0, height - topPadding - bottomPadding);

  const xs = React.useMemo(
    () => data.map((_, i) => leftPadding + (i * innerW) / Math.max(1, n - 1)),
    [data, leftPadding, innerW, n]
  );

  const yFor = (v: number) => topPadding + (1 - Math.min(v / yMax, 1)) * innerH;

  const points = React.useMemo(
    () => data.map((v, i) => `${xs[i]},${yFor(v)}`).join(" "),
    [data, xs, yMax, innerH, topPadding]
  );

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%", height }}
    >
      <Svg width={width} height={height}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const value = i * step;
          const y = yFor(value);
          return (
            <Line
              key={`gl-${i}`}
              x1={leftPadding}
              x2={width - rightPadding}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}

        {dailyGoal > 0 && (
          <Line
            x1={leftPadding}
            x2={width - rightPadding}
            y1={yFor(dailyGoal)}
            y2={yFor(dailyGoal)}
            stroke={colors.warnText}
            strokeDasharray="6 6"
            strokeWidth={2}
          />
        )}

        <Polyline
          points={points}
          fill="none"
          stroke={colors.primaryText}
          strokeWidth={3}
        />

        {showDots &&
          data.map((v, i) => (
            <Circle
              key={`pt-${i}`}
              cx={xs[i]}
              cy={yFor(v)}
              r={2.75}
              fill={colors.primaryText}
            />
          ))}
      </Svg>

      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject]}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const value = i * step;
          const y = yFor(value);
          return (
            <Text
              key={`yl-${i}`}
              style={{
                position: "absolute",
                left: 0,
                top: y - 8,
                width: leftPadding - 8,
                textAlign: "right",
                color: colors.subtle,
                fontSize: 12,
              }}
            >
              {formatNumber(value)}
            </Text>
          );
        })}

        <View
          style={{
            position: "absolute",
            left: leftPadding,
            right: rightPadding,
            bottom: 2,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {xLabels.map((d, i) => (
            <Text
              key={`xl-${i}`}
              style={{ color: colors.subtle, fontSize: 12 }}
            >
              {d}
            </Text>
          ))}
        </View>

        {dailyGoal > 0 && (
          <Text
            style={{
              position: "absolute",
              left: leftPadding + 6,
              top: yFor(dailyGoal) - 18,
              color: colors.warnText,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            Goal: {formatNumber(dailyGoal)}
          </Text>
        )}
      </View>
    </View>
  );
}

/** ---------------- helpers ---------------- */
function niceYAxis(maxVal: number): { yMax: number; step: number } {
  const targetTicks = 5;
  const rough = maxVal / targetTicks;
  const step = niceRound(rough);
  let yMax = Math.ceil(maxVal / step) * step;
  if (Math.abs(yMax - maxVal) < 1e-9) yMax += step;
  return { yMax, step };
}
function niceRound(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const n = v / pow;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return mult * pow;
}
function buildXLabels(days: number): string[] {
  const labels: string[] = [];
  if (days <= 14) {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const short = fmt.format(d);
      labels.push(short[0].toUpperCase());
    }
  } else if (days <= 30) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(todayUTC().getDate() - i);
      const dayNum = d.getDate();
      labels.push(dayNum % 5 === 0 ? String(dayNum) : " ");
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      if (i % 7 === 0) {
        const weekIndex = Math.floor((days - 1 - i) / 7) + 1;
        labels.push(`W${weekIndex}`);
      } else labels.push(" ");
    }
  }
  return labels;
}
function todayUTC() {
  const d = new Date();
  return d;
}
function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

const styles = (colors: any) =>
  StyleSheet.create({
    rangeRow: {
      flexDirection: "row",
      alignSelf: "center",
      gap: 8 as any,
      marginTop: 4,
    },
    pill: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginHorizontal: 4,
    },
    pillText: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 12,
    },
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignSelf: "stretch",
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 4,
      textAlign: "left",
    },
    subtle: { color: colors.subtle, marginBottom: 12 },
    big: { color: colors.text, fontWeight: "800" },
    chartContainer: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
    },
  });
