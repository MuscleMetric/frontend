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
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

export default function PlanInfo() {
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
        <Text style={s.h2}>Plan Info</Text>

        {loadingExercises && (
          <View style={s.loadingRow}>
            <ActivityIndicator />
            <Text style={s.muted}>Loading exercises…</Text>
          </View>
        )}

        <Text style={s.label}>Title</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={(t) => setMeta({ title: t })}
          placeholder="Push/Pull/Legs"
          placeholderTextColor={colors.subtle}
        />

        <Text style={s.label}>End date</Text>
        <Pressable
          style={[s.input, s.inputPressable]}
          onPress={() => setShow(true)}
        >
          <Text style={{ color: endDate ? colors.text : colors.subtle }}>
            {endDate ? new Date(endDate).toDateString() : "Select end date"}
          </Text>
        </Pressable>

        <Text style={s.label}>Workouts per week</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const active = workoutsPerWeek === n;
            const textColor = active ? "#fff" : colors.text;
            return (
              <Pressable
                key={n}
                onPress={() => setMeta({ workoutsPerWeek: n })}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={{ fontWeight: "700", color: textColor }}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[s.btn, s.primary]} onPress={proceed}>
          <Text style={s.btnPrimaryText}>Next →</Text>
        </Pressable>

        {/* end date modal */}
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={s.modalScrim}>
            <View style={s.modalCard}>
              <Text style={s.h3}>Select End Date</Text>
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
                    setMeta({ endDate: tempDate.toISOString().slice(0, 10) });
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
    page: { flex: 1, padding: 16, backgroundColor: colors.background },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    h2: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 12,
      color: colors.text,
    },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    label: {
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
      color: colors.text,
    },

    muted: { color: colors.subtle },

    input: {
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
    },
    inputPressable: { justifyContent: "center" },

    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 4,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "800", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },

    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
