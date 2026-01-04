// app/features/plans/create/PlanInfo.tsx
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../../lib/supabase";
import { useExercisesCache, CachedExercise } from "./exercisesStore";
import { usePlanDraft } from "./store";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SafeAreaView } from "react-native-safe-area-context";

async function fetchAllExercises(): Promise<CachedExercise[]> {
  const pageSize = 500;
  let from = 0;
  const out: CachedExercise[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("v_exercises_compact")
      .select("id,name,type,primary_muscle,popularity")
      .order("popularity", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as CachedExercise[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseYmdLocal(ymd: string) {
  // ymd = "YYYY-MM-DD"
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

function formatYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addWeeksLocal(base: Date, weeks: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function weeksBetweenCeil(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(days / 7));
}

export default function PlanInfo() {
  const { reset } = usePlanDraft();

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset])
  );
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { title, endDate, workoutsPerWeek, setMeta, initWorkouts } =
    usePlanDraft();
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(
    endDate ? new Date(endDate) : new Date()
  );
  const { items, setItems } = useExercisesCache();
  const [loadingExercises, setLoadingExercises] = useState(false);

  type LengthPreset = 4 | 8 | 12 | "custom";

  const [lengthPreset, setLengthPreset] = useState<LengthPreset>(() => {
    if (!endDate) return 4; // default
    const start = startOfTodayLocal();
    const end = parseYmdLocal(endDate);
    const w = weeksBetweenCeil(start, end);
    if (w === 4 || w === 8 || w === 12) return w;
    return "custom";
  });

  const PRESETS = [4, 8, 12] as const;

  const start = useMemo(() => startOfTodayLocal(), []);
  const end = endDate ? parseYmdLocal(endDate) : null;

  const computedWeeks = useMemo(() => {
    if (!end) return 0;
    return weeksBetweenCeil(start, end);
  }, [endDate]); // ok; depends on endDate string

  const endDateLabel = end ? end.toDateString() : "Not set";

  useEffect(() => {
    if (items.length > 0) return;
    (async () => {
      setLoadingExercises(true);
      try {
        const list = await fetchAllExercises();
        setItems(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingExercises(false);
      }
    })();
  }, []);

  function proceed() {
    if (!title.trim()) return Alert.alert("Please add a plan title");
    if (!endDate) return Alert.alert("Please choose an end date");
    if (workoutsPerWeek < 1)
      return Alert.alert("Workouts per week must be at least 1");
    initWorkouts(workoutsPerWeek);
    router.push({
      pathname: "/features/plans/create/workout",
      params: { index: 0 },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={s.page}>
        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={s.backPill}
          >
            <Text style={s.backIcon}>‹</Text>
            <Text style={s.backText}>Back</Text>
          </Pressable>

          {/* Optional: step indicator */}
          <View style={s.stepPill}>
            <Text style={s.stepText}>Step 1 of 4</Text>
          </View>
        </View>

        {/* Centered sheet */}
        <View style={s.sheet}>
          <View style={{ marginBottom: 14 }}>
            <Text style={s.h1}>Plan setup</Text>
            <Text style={s.subtitle}>
              Name your plan and choose how many workouts you’ll run each week.
            </Text>
          </View>

          {loadingExercises ? (
            <View style={s.loadingRow}>
              <ActivityIndicator />
              <Text style={s.muted}>Loading exercise library…</Text>
            </View>
          ) : null}

          {/* Section: Title */}
          <View style={s.section}>
            <Text style={s.label}>Title</Text>
            <Text style={s.helper}>Make it recognisable at a glance.</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={(t) => setMeta({ title: t })}
              placeholder="Push / Pull / Legs"
              placeholderTextColor={colors.subtle}
              returnKeyType="done"
            />
          </View>

          <View style={s.section}>
            <Text style={s.label}>Plan length</Text>
            <Text style={s.helper}>
              Pick a duration — you can still set a custom end date.
            </Text>

            <View style={s.lengthRow}>
              {PRESETS.map((w) => {
                const active = lengthPreset === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => {
                      setLengthPreset(w);
                      const d = addWeeksLocal(start, w);
                      setMeta({ endDate: formatYmdLocal(d) });
                      setTempDate(d);
                    }}
                    style={[s.lengthChip, active && s.lengthChipActive]}
                  >
                    <Text
                      style={[
                        s.lengthChipText,
                        active && s.lengthChipTextActive,
                      ]}
                    >
                      {w}w
                    </Text>
                  </Pressable>
                );
              })}

              {/* Custom */}
              <Pressable
                onPress={() => {
                  setLengthPreset("custom");
                  // open picker; tempDate should be current end date or today
                  setTempDate(end ? end : start);
                  setShow(true);
                }}
                style={[
                  s.lengthChip,
                  lengthPreset === "custom" && s.lengthChipActive,
                ]}
              >
                <Text
                  style={[
                    s.lengthChipText,
                    lengthPreset === "custom" && s.lengthChipTextActive,
                  ]}
                >
                  Custom
                </Text>
              </Pressable>
            </View>

            {/* Always visible summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>End date</Text>
                <Text style={s.summaryValue}>{endDateLabel}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Duration</Text>
                <Text style={s.summaryValue}>
                  {end
                    ? `${computedWeeks} week${computedWeeks === 1 ? "" : "s"}`
                    : "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Section: Workouts per week */}
          <View style={s.section}>
            <Text style={s.label}>Workouts per week</Text>
            <Text style={s.helper}>
              This creates that many workouts in your plan.
            </Text>

            <View style={s.chipRow}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const active = workoutsPerWeek === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setMeta({ workoutsPerWeek: n })}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Primary action */}
          <Pressable style={[s.btn, s.primary]} onPress={proceed}>
            <Text style={s.btnPrimaryText}>Next</Text>
            <Text style={s.btnArrow}>→</Text>
          </Pressable>
        </View>

        {/* end date modal */}
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={s.modalScrim}>
            <View style={s.modalCard}>
              <View style={{ marginBottom: 8 }}>
                <Text style={s.h3}>Select end date</Text>
                <Text style={s.modalSub}>
                  Pick when this plan finishes (you can change it later).
                </Text>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(_, d) => d && setTempDate(d)}
              />

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  style={[s.btn, { flex: 1 }]}
                  onPress={() => setShow(false)}
                >
                  <Text style={s.btnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.btn, s.primary, { flex: 1 }]}
                  onPress={() => {
                    const ymd = formatYmdLocal(tempDate);
                    setMeta({ endDate: ymd });

                    // if user-picked date matches preset (4/8/12), snap to it; else keep custom
                    const w = weeksBetweenCeil(start, tempDate);
                    if (w === 4 || w === 8 || w === 12) setLengthPreset(w);
                    else setLengthPreset("custom");

                    setShow(false);
                  }}
                >
                  <Text style={s.btnPrimaryText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* -------- themed styles -------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: colors.background,
      alignItems: "center", // centers the sheet
    },

    topBar: {
      width: "100%",
      maxWidth: 520,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    backPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    backIcon: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "900",
      marginTop: -1,
    },
    backText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "800",
    },

    stepPill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stepText: {
      color: colors.subtle,
      fontWeight: "800",
      fontSize: 12,
    },

    sheet: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 14,
      elevation: 2,
    },

    h1: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      color: colors.subtle,
      fontWeight: "600",
      lineHeight: 18,
    },

    h3: { fontSize: 16, fontWeight: "900", color: colors.text },
    modalSub: { marginTop: 4, color: colors.subtle, fontWeight: "600" },

    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    muted: { color: colors.subtle, fontWeight: "600" },

    section: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },

    label: {
      fontWeight: "900",
      marginBottom: 4,
      color: colors.text,
      fontSize: 14,
    },
    helper: {
      color: colors.subtle,
      fontWeight: "600",
      marginBottom: 10,
      fontSize: 12,
    },

    input: {
      backgroundColor: colors.background,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
      fontWeight: "700",
    },
    inputPressable: { justifyContent: "center" },

    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    chevron: {
      color: colors.subtle,
      fontSize: 18,
      fontWeight: "900",
      marginLeft: 10,
    },

    chipRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    chip: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 3,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontWeight: "900", color: colors.text },
    chipTextActive: { color: colors.onPrimary ?? "#fff" },

    btn: {
      marginTop: 16,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    btnText: { fontWeight: "900", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "900" },
    btnArrow: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "900",
      fontSize: 16,
    },

    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    lengthRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },

    lengthChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
    },

    lengthChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    lengthChipText: {
      fontWeight: "900",
      color: colors.text,
    },

    lengthChipTextActive: {
      color: colors.onPrimary ?? "#fff",
    },

    summaryCard: {
      marginTop: 12,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 12,
    },

    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
    },

    summaryLabel: {
      color: colors.subtle,
      fontWeight: "800",
      fontSize: 12,
    },

    summaryValue: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 12,
    },
  });
