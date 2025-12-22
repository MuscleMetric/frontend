import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-start grid: Mon=0 ... Sun=6
function mondayIndex(jsDay: number) {
  // JS: Sun=0..Sat=6  -> Mon=0..Sun=6
  return (jsDay + 6) % 7;
}

type TrainedKeysInput = string[] | Set<string> | ReadonlySet<string>;

function toTrainedSet(input: TrainedKeysInput) {
  // Already a Set-like?
  if (input && typeof (input as any).has === "function") {
    return input as ReadonlySet<string>;
  }
  // Array -> Set
  return new Set(input as string[]);
}

export function MiniMonthCalendar({
  colors,
  trainedKeys,
  monthDate,
  onPressHeader,
  onPressDay,
  selectedDayKey,
  compact = true,
}: {
  colors: any;
  trainedKeys: TrainedKeysInput;
  monthDate?: Date;
  onPressHeader?: () => void;
  onPressDay?: (dayKey: string) => void;
  selectedDayKey?: string | null;
  compact?: boolean;
}) {
  const base = monthDate ?? new Date();

  const monthStart = useMemo(
    () => new Date(base.getFullYear(), base.getMonth(), 1),
    [base]
  );
  const monthEnd = useMemo(
    () => new Date(base.getFullYear(), base.getMonth() + 1, 0),
    [base]
  );

  const daysInMonth = monthEnd.getDate();

  const trainedSet = useMemo(() => toTrainedSet(trainedKeys), [trainedKeys]);

  const title = useMemo(
    () => monthStart.toLocaleDateString(undefined, { month: "long" }),
    [monthStart]
  );

  const cells = useMemo(() => {
    const firstDow = mondayIndex(monthStart.getDay());
    const totalCells = 42; // 6-week grid
    const out: Array<{ date: Date | null; key: string | null }> = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDow + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        out.push({ date: null, key: null });
      } else {
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
        out.push({ date: d, key: dayKeyLocal(d) });
      }
    }
    return out;
  }, [monthStart, daysInMonth]);

  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);

  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <View style={{ gap: 10 }}>
      {/* Header */}
      <Pressable
        onPress={onPressHeader}
        disabled={!onPressHeader}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={styles.headerTitle}>{title}</Text>
      </Pressable>

      {/* Weekday row */}
      <View style={styles.weekRow}>
        {weekdays.map((w, idx) => (
          <Text key={`${w}-${idx}`} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((c, idx) => {
          if (!c.date || !c.key) {
            return <View key={`empty-${idx}`} style={styles.cell} />;
          }

          const trained = trainedSet.has(c.key);
          const selected = !!selectedDayKey && c.key === selectedDayKey;

          return (
            <Pressable
              key={c.key}
              onPress={() => onPressDay?.(c.key!)}
              style={styles.cell}
              hitSlop={6}
            >
              <View
                style={[
                  styles.dayPill,
                  trained ? styles.dayPillTrained : null,
                  selected ? styles.dayPillSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    trained ? styles.dayTextTrained : null,
                    selected ? styles.dayTextSelected : null,
                  ]}
                >
                  {c.date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: any, compact: boolean) =>
  StyleSheet.create({
    headerTitle: {
      fontSize: compact ? 18 : 22,
      fontWeight: "900",
      color: colors.text,
    },
    headerHint: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.subtle,
    },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 2,
    },
    weekLabel: {
      width: "14.28%",
      textAlign: "center",
      fontSize: 12,
      fontWeight: "800",
      color: colors.subtle,
      opacity: 0.9,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    cell: {
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    dayPill: {
      width: compact ? 28 : 34,
      height: compact ? 28 : 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    dayPillTrained: {
      borderWidth: 2,
      borderColor: colors.primaryText ?? colors.primary,
      backgroundColor: "rgba(59,130,246,0.08)",
    },
    dayPillSelected: {
      backgroundColor: "rgba(59,130,246,0.18)",
      borderWidth: 2,
      borderColor: colors.primaryText ?? colors.primary,
    },
    dayText: {
      fontSize: compact ? 13 : 15,
      fontWeight: "900",
      color: colors.text,
    },
    dayTextTrained: {
      color: colors.text,
    },
    dayTextSelected: {
      color: colors.text,
    },
  });
