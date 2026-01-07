// app/features/home/cards/StreakCard.tsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { Pill } from "../ui/Pill";
import { homeTokens } from "../ui/homeTheme";

type DayItem = { day: string; trained: boolean; workout_count?: number };

function dayKeyFromAny(v: any): string {
  if (!v) return "";
  // handles "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss..."
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

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

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

export function StreakCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const weeklyStreak = Number(card?.weekly_streak ?? 0);

  /**
   * ✅ IMPORTANT CHANGE:
   * We now use the home summary payload:
   * card.months = [{ month_start: 'YYYY-MM-01', days: [{day,trained,workout_count}] }]
   * This fixes "not showing markers on first load".
   */
  const monthsPayload = useMemo(
    () => (Array.isArray(card?.months) ? card.months : []),
    [card?.months]
  );

  // Card-local month state (0=this month, 1=last month, 2=two months ago)
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const [monthStartStr, setMonthStartStr] = useState<string>(() => {
    const m0 = monthsPayload[0];
    return typeof m0?.month_start === "string" ? m0.month_start : "";
  });

  const [days, setDays] = useState<DayItem[]>(() => {
    const m0 = monthsPayload[0];
    return normalizeDays(m0?.days);
  });

  // selection + workouts list for selected day
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dayWorkouts, setDayWorkouts] = useState<DayWorkout[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  /**
   * ✅ When home payload arrives/changes OR monthOffset changes,
   * hydrate monthStartStr + days from monthsPayload.
   */
  useEffect(() => {
    const m = monthsPayload[monthOffset];
    if (!m) {
      // fallback if payload not present
      setMonthStartStr("");
      setDays([]);
      return;
    }
    setMonthStartStr(String(m.month_start ?? ""));
    setDays(normalizeDays(m.days));
  }, [monthsPayload, monthOffset]);

  // When month changes, clear selection/workouts (prevents bleed)
  useEffect(() => {
    setSelectedKey(null);
    setDayWorkouts([]);
    setDayLoading(false);
    setDayError(null);
  }, [monthOffset, monthStartStr]);

  const monthStart = useMemo(() => {
    // if month_start is empty, fall back to actual current month start
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
    // Monday-first: 0..6 where 0 = Monday
    const jsDay = monthStart.getDay(); // 0 Sun..6 Sat
    return (jsDay + 6) % 7;
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

  const ringOnBg = t.primarySoft;
  const ringOnBorder = "rgba(14,165,233,0.35)";
  const ringOffBorder = t.trackBorder;

  const selectedBorder = "rgba(15, 23, 42, 0.95)"; // slate/navy
  const selectedBg = "rgba(15, 23, 42, 0.10)";

  const fetchWorkoutsForDay = useCallback(
    async (dayKey: string) => {
      setDayLoading(true);
      setDayError(null);
      try {
        // We keep the same RPC you already use.
        // If you renamed it, update here.
        const { data, error } = await (
          await import("../../../../lib/supabase")
        ).supabase.rpc("get_workouts_on_day", {
          p_day: dayKey,
        });

        if (error) throw error;
        setDayWorkouts(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setDayWorkouts([]);
        setDayError(e?.message ?? "Failed to load workouts");
      } finally {
        setDayLoading(false);
      }
    },
    []
  );

  const onSelectDay = useCallback(
    (dayKey: string) => {
      // ✅ Disable future days selection (safety net)
      if (dayKey > todayKey) return;

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

  // ✅ Month nav now uses monthsPayload length (no RPC month fetching)
  const canGoPrev = monthOffset < monthsPayload.length - 1; // older
  const canGoNext = monthOffset > 0; // newer

  return (
    <BaseCard>
      <View style={{ gap: 12 }}>
        <View style={styles.topRow}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>
            Consistency
          </Text>
          <Pill
            label={`${weeklyStreak} week streak`}
            tone={weeklyStreak > 0 ? "green" : "neutral"}
          />
        </View>

        <View style={styles.monthHeaderRow}>
          <Text style={[styles.monthTitle, { color: t.text }]}>
            {monthTitle}
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setMonthOffset((x) => x + 1)}
              disabled={!canGoPrev}
              style={({ pressed }) => [
                styles.navPill,
                {
                  backgroundColor: t.pill.neutral.bg,
                  borderColor: t.pill.neutral.bd,
                  opacity: canGoPrev ? 1 : 0.4,
                },
                pressed && canGoPrev ? { opacity: 0.75 } : null,
              ]}
            >
              <Text style={[styles.navText, { color: t.text }]}>Prev</Text>
            </Pressable>

            <Pressable
              onPress={() => setMonthOffset((x) => x - 1)}
              disabled={!canGoNext}
              style={({ pressed }) => [
                styles.navPill,
                {
                  backgroundColor: t.pill.neutral.bg,
                  borderColor: t.pill.neutral.bd,
                  opacity: canGoNext ? 1 : 0.4,
                },
                pressed && canGoNext ? { opacity: 0.75 } : null,
              ]}
            >
              <Text style={[styles.navText, { color: t.text }]}>Next</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, idx) => (
            <Text
              key={`${d}-${idx}`}
              style={[
                styles.weekLabel,
                { color: t.subtle },
                idx >= 5 ? { opacity: 0.65 } : null,
              ]}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: t.trackBorder }]} />

        <View style={{ gap: 8 }}>
          {weeks.map((week, wIdx) => (
            <View key={`week-${wIdx}`} style={styles.weekGridRow}>
              {week.map((c) => {
                if (c.dayNum == null)
                  return <View key={c.key} style={styles.cell} />;

                const isToday = c.key === todayKey;
                const isSelected = selectedKey === c.key;
                const trained = c.trained;

                // ✅ Future day logic (YYYY-MM-DD string compare is safe)
                const isFuture = c.key > todayKey;

                const borderColor = isFuture
                  ? t.trackBorder
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
                  ? t.subtle
                  : isSelected
                  ? selectedBorder
                  : t.text;

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

        {selectedKey ? (
          <View style={[styles.dayPanel, { borderColor: t.trackBorder }]}>
            <View style={styles.dayPanelHeader}>
              <Text style={[styles.dayPanelTitle, { color: t.text }]}>
                {selectedTitle}
              </Text>

              {dayLoading ? (
                <ActivityIndicator />
              ) : (
                <Text style={[styles.dayPanelMeta, { color: t.subtle }]}>
                  {dayWorkouts.length} workout
                  {dayWorkouts.length === 1 ? "" : "s"}
                </Text>
              )}
            </View>

            {dayError ? (
              <Text style={[styles.errorText, { color: selectedBorder }]}>
                {dayError}
              </Text>
            ) : null}

            {!dayLoading && !dayError && dayWorkouts.length === 0 ? (
              <Text style={[styles.emptyText, { color: t.subtle }]}>
                No workouts logged on this day.
              </Text>
            ) : null}

            {!dayLoading && !dayError && dayWorkouts.length > 0 ? (
              <View style={{ gap: 10 }}>
                {dayWorkouts.map((w) => (
                  <View
                    key={w.workout_history_id}
                    style={[
                      styles.workoutRow,
                      {
                        backgroundColor: t.pill.neutral.bg,
                        borderColor: t.pill.neutral.bd,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={[styles.workoutTitle, { color: t.text }]}
                        numberOfLines={1}
                      >
                        {w.title ?? "Workout"}
                      </Text>

                      <Text style={[styles.workoutSub, { color: t.subtle }]}>
                        {fmtTime(w.completed_at)} •{" "}
                        {fmtDuration(w.duration_seconds)} •{" "}
                        {w.sets_completed ?? 0} sets • {fmtVolume(w.volume_kg)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.hintText, { color: t.subtle }]}>
            Tap a day to see workouts.
          </Text>
        )}
      </View>
    </BaseCard>
  );
}

const CELL = 38;

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },

  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  monthTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 38,
  },

  navPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navText: { fontSize: 12, fontWeight: "900" },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  weekLabel: {
    width: CELL,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginTop: 6,
    marginBottom: 6,
    opacity: 0.9,
  },

  weekGridRow: { flexDirection: "row", justifyContent: "space-between" },
  cell: { width: CELL, alignItems: "center" },

  ring: {
    width: CELL,
    height: CELL,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  dayText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
    lineHeight: 16,
  },

  hintText: { marginTop: 2, fontSize: 12, fontWeight: "700" },

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
  dayPanelTitle: { fontSize: 14, fontWeight: "900", flex: 1 },
  dayPanelMeta: { fontSize: 12, fontWeight: "800" },

  errorText: { fontSize: 12, fontWeight: "800" },
  emptyText: { fontSize: 12, fontWeight: "700", paddingVertical: 6 },

  workoutRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  workoutTitle: { fontSize: 13, fontWeight: "900", letterSpacing: -0.2 },
  workoutSub: { fontSize: 12, fontWeight: "700" },
});
