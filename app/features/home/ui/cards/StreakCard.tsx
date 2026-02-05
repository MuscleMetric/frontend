// app/features/home/cards/StreakCard.tsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";
import { router } from "expo-router";

type DayItem = { day: string; trained: boolean; workout_count?: number };

function dayKeyFromAny(v: any): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function normalizeDays(raw: any): DayItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      day: dayKeyFromAny(it?.day),
      trained: Boolean(
        it?.trained === true || it?.trained === "true" || it?.trained === 1
      ),
      workout_count:
        it?.workout_count == null ? undefined : Number(it.workout_count),
    }))
    .filter((it) => !!it.day);
}

type DayWorkout = {
  workout_history_id: string;
  workout_id?: string | null;
  title?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  sets_completed?: number | null;
  volume_kg?: number | null;
};

const WEEKDAYS = ["M", "T", "W", "Th", "F", "Sa", "Su"];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtVolume(v?: number | null) {
  if (v == null) return "—";
  const n = Math.round(Number(v));
  return `${n.toLocaleString()} kg`;
}

export function StreakCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const weeklyStreak = Number(card?.weekly_streak ?? 0);

  const monthsPayload = useMemo(
    () => (Array.isArray(card?.months) ? card.months : []),
    [card?.months]
  );

  const [monthOffset, setMonthOffset] = useState<number>(0);

  const [monthStartStr, setMonthStartStr] = useState<string>(() => {
    const m0 = monthsPayload[0];
    return typeof m0?.month_start === "string" ? m0.month_start : "";
  });

  const [days, setDays] = useState<DayItem[]>(() => {
    const m0 = monthsPayload[0];
    return normalizeDays(m0?.days);
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dayWorkouts, setDayWorkouts] = useState<DayWorkout[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  useEffect(() => {
    const m = monthsPayload[monthOffset];
    if (!m) {
      setMonthStartStr("");
      setDays([]);
      return;
    }
    setMonthStartStr(String(m.month_start ?? ""));
    setDays(normalizeDays(m.days));
  }, [monthsPayload, monthOffset]);

  useEffect(() => {
    setSelectedKey(null);
    setDayWorkouts([]);
    setDayLoading(false);
    setDayError(null);
  }, [monthOffset, monthStartStr]);

  const monthStart = useMemo(() => {
    if (!monthStartStr) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return parseYmd(monthStartStr);
  }, [monthStartStr]);

  const monthTitle = useMemo(
    () => monthStart.toLocaleDateString(undefined, { month: "long" }),
    [monthStart]
  );

  const trainedSet = useMemo(() => {
    const s = new Set<string>();
    for (const it of days) if (it?.trained) s.add(dayKeyFromAny(it.day));
    return s;
  }, [days]);

  const daysInMonth = useMemo(() => {
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();
    return new Date(y, m + 1, 0).getDate();
  }, [monthStart]);

  const leadingEmpty = useMemo(() => {
    const jsDay = monthStart.getDay(); // 0 Sun..6 Sat
    return (jsDay + 6) % 7; // Monday-first
  }, [monthStart]);

  const todayKey = useMemo(() => ymd(new Date()), []);

  const weeks = useMemo(() => {
    const cells: Array<{
      key: string;
      dayNum: number | null;
      trained: boolean;
    }> = [];

    for (let i = 0; i < leadingEmpty; i++) {
      cells.push({
        key: `empty-${monthStartStr || "fallback"}-${i}`,
        dayNum: null,
        trained: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      const key = ymd(date);
      cells.push({ key, dayNum: d, trained: trainedSet.has(key) });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        key: `tail-${monthStartStr || "fallback"}-${cells.length}`,
        dayNum: null,
        trained: false,
      });
    }

    return chunk(cells, 7);
  }, [leadingEmpty, daysInMonth, monthStart, monthStartStr, trainedSet]);

  // Selection styling: semantic + mode-safe
  const ringOnBg = "rgba(37,99,235,0.14)";
  const ringOnBorder = "rgba(37,99,235,0.35)";
  const ringOffBorder = colors.trackBorder;

  const selectedBorder = colors.text; // strong contrast in both modes
  const selectedBg = colors.cardPressed;

  const fetchWorkoutsForDay = useCallback(async (dayKey: string) => {
    setDayLoading(true);
    setDayError(null);
    try {
      const { data, error } = await (
        await import("../../../../../lib/supabase")
      ).supabase.rpc("get_workouts_on_day", { p_day: dayKey });

      if (error) throw error;
      setDayWorkouts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setDayWorkouts([]);
      setDayError(e?.message ?? "Failed to load workouts");
    } finally {
      setDayLoading(false);
    }
  }, []);

  const onSelectDay = useCallback(
    (dayKey: string) => {
      if (dayKey > todayKey) return; // future days disabled
      setSelectedKey(dayKey);
      fetchWorkoutsForDay(dayKey);
    },
    [fetchWorkoutsForDay, todayKey]
  );

  const selectedTitle = useMemo(() => {
    if (!selectedKey) return "";
    const d = parseYmd(selectedKey);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [selectedKey]);

  const canGoPrev = monthOffset < monthsPayload.length - 1;
  const canGoNext = monthOffset > 0;

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        {/* Header */}
        <View style={styles.topRow}>
          <Text style={styles.sectionTitle}>Consistency</Text>
          <Pill
            label={`${weeklyStreak} week streak`}
            tone={weeklyStreak > 0 ? "success" : "neutral"}
          />
        </View>

        {/* Month header */}
        <View style={styles.monthHeaderRow}>
          <Text style={styles.monthTitle}>{monthTitle}</Text>

          <View style={{ flexDirection: "row", gap: layout.space.sm }}>
            <Pressable
              onPress={() => setMonthOffset((x) => x + 1)}
              disabled={!canGoPrev}
              style={({ pressed }) => [
                styles.navPill,
                {
                  backgroundColor: colors.trackBg,
                  borderColor: colors.trackBorder,
                  opacity: canGoPrev ? 1 : 0.4,
                },
                pressed && canGoPrev ? { opacity: 0.75 } : null,
              ]}
            >
              <Text style={styles.navText}>Prev</Text>
            </Pressable>

            <Pressable
              onPress={() => setMonthOffset((x) => x - 1)}
              disabled={!canGoNext}
              style={({ pressed }) => [
                styles.navPill,
                {
                  backgroundColor: colors.trackBg,
                  borderColor: colors.trackBorder,
                  opacity: canGoNext ? 1 : 0.4,
                },
                pressed && canGoNext ? { opacity: 0.75 } : null,
              ]}
            >
              <Text style={styles.navText}>Next</Text>
            </Pressable>
          </View>
        </View>

        {/* Week labels */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, idx) => (
            <Text
              key={`${d}-${idx}`}
              style={[
                styles.weekLabel,
                { color: colors.textMuted },
                idx >= 5 ? { opacity: 0.65 } : null,
              ]}
            >
              {d}
            </Text>
          ))}
        </View>

        <View
          style={[styles.divider, { backgroundColor: colors.trackBorder }]}
        />

        {/* Calendar */}
        <View style={{ gap: layout.space.sm }}>
          {weeks.map((week, wIdx) => (
            <View key={`week-${wIdx}`} style={styles.weekGridRow}>
              {week.map((c) => {
                if (c.dayNum == null)
                  return <View key={c.key} style={styles.cell} />;

                const isToday = c.key === todayKey;
                const isSelected = selectedKey === c.key;
                const trained = c.trained;
                const isFuture = c.key > todayKey;

                const borderColor = isFuture
                  ? colors.trackBorder
                  : isSelected
                  ? selectedBorder
                  : trained
                  ? ringOnBorder
                  : ringOffBorder;

                const bgColor = isFuture
                  ? "transparent"
                  : isSelected
                  ? selectedBg
                  : trained
                  ? ringOnBg
                  : "transparent";

                const textColor = isFuture
                  ? colors.textMuted
                  : isSelected
                  ? selectedBorder
                  : colors.text;

                return (
                  <Pressable
                    key={c.key}
                    onPress={() => onSelectDay(c.key)}
                    disabled={isFuture}
                    style={({ pressed }) => [
                      styles.cell,
                      isFuture ? { opacity: 0.35 } : null,
                      pressed && !isFuture ? { opacity: 0.85 } : null,
                    ]}
                    hitSlop={8}
                  >
                    <View
                      style={[
                        styles.ring,
                        {
                          borderColor,
                          backgroundColor: bgColor,
                          transform: isToday ? [{ scale: 1.02 }] : undefined,
                        },
                      ]}
                    >
                      <Text style={[styles.dayText, { color: textColor }]}>
                        {c.dayNum}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Selected day panel */}
        {selectedKey ? (
          <View style={[styles.dayPanel, { borderColor: colors.trackBorder }]}>
            <View style={styles.dayPanelHeader}>
              <Text style={styles.dayPanelTitle}>{selectedTitle}</Text>

              {dayLoading ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.dayPanelMeta}>
                  {dayWorkouts.length} workout
                  {dayWorkouts.length === 1 ? "" : "s"}
                </Text>
              )}
            </View>

            {dayError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {dayError}
              </Text>
            ) : null}

            {!dayLoading && !dayError && dayWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>
                No workouts logged on this day.
              </Text>
            ) : null}

            {!dayLoading && !dayError && dayWorkouts.length > 0 ? (
              <View style={{ gap: layout.space.sm }}>
                {dayWorkouts.map((w) => (
                  <Pressable
                    key={w.workout_history_id}
                    onPress={() => {
                      if (!w.workout_history_id) return;
                      router.push({
                        pathname: "features/history/screens/WorkoutHistoryDetailScreen",
                        params: { workoutHistoryId: w.workout_history_id },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.workoutRow,
                      {
                        backgroundColor: colors.trackBg,
                        borderColor: colors.trackBorder,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    hitSlop={8}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.workoutTitle} numberOfLines={1}>
                        {w.title ?? "Workout"}
                      </Text>

                      <Text style={styles.workoutSub}>
                        {fmtTime(w.completed_at)} •{" "}
                        {fmtDuration(w.duration_seconds)} •{" "}
                        {w.sets_completed ?? 0} sets • {fmtVolume(w.volume_kg)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.hintText}>Tap a day to see workouts.</Text>
        )}
      </View>
    </Card>
  );
}

const CELL = 38;

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    sectionTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.text,
      letterSpacing: -0.2,
    },

    monthHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    monthTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      color: colors.text,
      letterSpacing: -1.2,
    },

    navPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },

    navText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.text,
    },

    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 2,
      marginTop: 2,
    },

    weekLabel: {
      width: CELL,
      textAlign: "center",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      width: "100%",
      marginTop: 6,
      marginBottom: 6,
      opacity: 0.9,
    },

    weekGridRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    cell: { width: CELL, alignItems: "center" },

    ring: {
      width: CELL,
      height: CELL,
      borderRadius: layout.radius.pill,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },

    dayText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 15,
      letterSpacing: -0.3,
      lineHeight: 16,
    },

    hintText: {
      marginTop: 2,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },

    dayPanel: {
      marginTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 12,
      gap: 10,
    },

    dayPanelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    dayPanelTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.text,
      flex: 1,
    },

    dayPanelMeta: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },

    errorText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },

    emptyText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      paddingVertical: 6,
    },

    workoutRow: {
      borderRadius: layout.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    workoutTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      color: colors.text,
      letterSpacing: -0.2,
    },

    workoutSub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
  });
