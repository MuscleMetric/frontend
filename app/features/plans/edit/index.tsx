// app/features/plans/edit/index.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";

import {
  useEditPlan,
  type WorkoutDraft,
  type ExerciseRow,
  type GoalDraft,
} from "./store";

// Your custom header + icons
import { ScreenHeader } from "@/ui";
import { Icon } from "@/ui/icons/Icon";

function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Normalize plan state for stable dirty-checking */
function normalizePlanSnapshot(input: {
  title: string;
  endDate: string | null;
  workouts: WorkoutDraft[];
  goals: GoalDraft[];
}) {
  const planInfo = {
    title: (input.title ?? "").trim(),
    endDate: input.endDate ?? null,
    workoutsPerWeek: input.workouts?.length ?? 0,
  };

  const workouts = (input.workouts ?? []).map((w, wIdx) => ({
    order: wIdx,
    title: (w.title ?? "").trim(),
    exercises: (w.exercises ?? [])
      .slice()
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((e, i) => ({
        order: i,
        exerciseId: e.exercise?.id ?? "",
        supersetGroup: e.supersetGroup ?? null,
        isDropset: !!e.isDropset,
      })),
  }));

  const goals = (input.goals ?? []).map((g) => ({
    exerciseId: g.exercise?.id ?? "",
    mode: g.mode,
    unit: g.unit ?? null,
    start: g.start ?? null,
    target: Number(g.target ?? 0),
  }));

  return { planInfo, workouts, goals };
}

export default function EditPlan() {
  // Hide native header so ScreenHeader is used instead
  // (Expo Router per-screen)
  // eslint-disable-next-line react/jsx-no-undef
  // @ts-ignore
  const _ = <Stack.Screen options={{ headerShown: false }} />;

  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme() as any;
  const s = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );
  const insets = useSafeAreaInsets();

  const { initFromLoaded, title, endDate, workouts, goals } = useEditPlan();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Snapshot used for dirty checks
  const initialSnapRef = useRef<string | null>(null);

  // -------------------- Load --------------------
  useEffect(() => {
    if (!userId || !planId) return;

    (async () => {
      try {
        setLoading(true);

        const { data: p, error: pErr } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date")
          .eq("id", planId)
          .eq("user_id", userId)
          .maybeSingle();

        if (pErr) throw pErr;

        const { data: pws, error: pwsErr } = await supabase
          .from("plan_workouts")
          .select(
            `
            id, title, order_index, workout_id,
            workouts!inner (
              id, title,
              workout_exercises (
                id, order_index, superset_group, is_dropset, is_archived,
                exercises ( id, name, type )
              )
            )
          `
          )
          .eq("plan_id", planId)
          .eq("is_archived", false)
          .order("order_index");

        if (pwsErr) throw pwsErr;

        const workoutDrafts: WorkoutDraft[] = (pws ?? []).map((row: any) => {
          const w = Array.isArray(row.workouts)
            ? row.workouts[0]
            : row.workouts;

          const exs = (w?.workout_exercises ?? [])
            .slice()
            .sort(
              (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
            )
            .map((we: any, i: number) => ({
              id: String(we.id ?? ""),
              exercise: {
                id: String(we.exercises?.id ?? ""),
                name: we.exercises?.name ?? "Exercise",
                type: we.exercises?.type ?? null,
              } as ExerciseRow,
              order_index: i,
              supersetGroup: we?.superset_group ?? null,
              isDropset: !!we?.is_dropset,
            }));

          return {
            id: String(row.id ?? ""),
            title: row.title ?? w?.title ?? "Workout",
            exercises: exs,
          };
        });

        const { data: g, error: gErr } = await supabase
          .from("goals")
          .select(
            `id, type, target_number, unit, notes, exercises ( id, name, type )`
          )
          .eq("plan_id", planId)
          .eq("user_id", userId)
          .order("created_at");

        if (gErr) throw gErr;

        const goalDrafts: GoalDraft[] = (g ?? []).map((r: any) => ({
          id: String(r.id),
          exercise: {
            id: String(r.exercises?.id ?? ""),
            name: r.exercises?.name ?? "Exercise",
            type: r.exercises?.type ?? null,
          },
          mode: r.type,
          unit: r.unit,
          start: safeStartFromNotes(r.notes),
          target: Number(r.target_number) || 0,
        }));

        initFromLoaded({
          planId,
          title: p?.title ?? "Plan",
          startDate: p?.start_date ?? null,
          endDate: p?.end_date ?? null,
          workouts: workoutDrafts,
          goals: goalDrafts,
        });

        const snap = JSON.stringify(
          normalizePlanSnapshot({
            title: p?.title ?? "Plan",
            endDate: p?.end_date ?? null,
            workouts: workoutDrafts,
            goals: goalDrafts,
          })
        );
        initialSnapRef.current = snap;
      } catch (e: any) {
        console.error("EditPlan load error:", e);
        Alert.alert("Could not load plan", e?.message ?? String(e));
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planId, initFromLoaded, router]);

  // -------------------- Dirty checks --------------------
  const currentSnap = useMemo(() => {
    return JSON.stringify(
      normalizePlanSnapshot({ title, endDate, workouts, goals })
    );
  }, [title, endDate, workouts, goals]);

  const isDirty = useMemo(() => {
    if (!initialSnapRef.current) return false;
    return initialSnapRef.current !== currentSnap;
  }, [currentSnap]);

  const dirtyPlanInfo = useMemo(() => {
    if (!initialSnapRef.current) return false;
    try {
      const a = JSON.parse(initialSnapRef.current);
      const b = JSON.parse(currentSnap);
      return JSON.stringify(a.planInfo) !== JSON.stringify(b.planInfo);
    } catch {
      return false;
    }
  }, [currentSnap]);

  const dirtyWorkouts = useMemo(() => {
    if (!initialSnapRef.current) return false;
    try {
      const a = JSON.parse(initialSnapRef.current);
      const b = JSON.parse(currentSnap);
      return JSON.stringify(a.workouts) !== JSON.stringify(b.workouts);
    } catch {
      return false;
    }
  }, [currentSnap]);

  const dirtyGoals = useMemo(() => {
    if (!initialSnapRef.current) return false;
    try {
      const a = JSON.parse(initialSnapRef.current);
      const b = JSON.parse(currentSnap);
      return JSON.stringify(a.goals) !== JSON.stringify(b.goals);
    } catch {
      return false;
    }
  }, [currentSnap]);

  const statusDot = (dirty: boolean) => (
    <View
      style={[
        s.statusDot,
        {
          backgroundColor: dirty ? colors.primary : colors.success ?? "#22c55e",
        },
      ]}
    />
  );

  // -------------------- Save --------------------
  const saveAll = useCallback(async () => {
    if (!userId || !planId) return;

    try {
      setSaving(true);

      const payload = {
        p_plan_id: planId,
        p_user_id: userId,
        p_title: title,
        p_end_date: endDate,

        p_workouts: workouts.map((w, wIdx) => ({
          id: w.id ?? null,
          title: w.title,
          order_index: wIdx,
          exercises: (w.exercises ?? []).map((e, idx) => ({
            id: e.id ?? null,
            exerciseId: e.exercise.id,
            order_index: idx,
            supersetGroup: e.supersetGroup ?? null,
            isDropset: !!e.isDropset,
          })),
        })),

        p_goals: goals.map((g) => ({
          id: g.id ?? null,
          exerciseId: g.exercise.id,
          mode: g.mode,
          target: g.target,
          unit: g.unit,
          start: g.start,
        })),
      };

      const { error } = await supabase.rpc("update_full_plan", payload);
      if (error) throw error;

      initialSnapRef.current = currentSnap;

      Alert.alert("Saved", "Plan changes have been saved.");
      router.back();
    } catch (e: any) {
      console.error("saveAll error:", e);
      Alert.alert("Could not save changes", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }, [userId, planId, title, endDate, workouts, goals, router, currentSnap]);

  // -------------------- Cancel / Archive --------------------
  const onCancel = () => {
    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert(
      "Discard changes?",
      "You have unsaved edits. Are you sure you want to discard them?",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  const onArchive = async () => {
    if (!userId || !planId) return;

    Alert.alert(
      "Archive plan?",
      "This will archive the plan and hide it from active views.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              const { error } = await supabase
                .from("plans")
                .update({ is_archived: true })
                .eq("id", planId)
                .eq("user_id", userId);

              if (error) throw error;
              Alert.alert("Archived", "Plan has been archived.");
              router.back();
            } catch (e: any) {
              console.error("archive error:", e);
              Alert.alert(
                "Could not archive",
                e?.message ??
                  "Your plans table may not have an is_archived column yet."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // -------------------- UI --------------------
  if (!userId || loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const footerH = 104 + insets.bottom;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScreenHeader
        title="Edit Plan"
        right={
          isDirty ? (
            <Icon
              name="alert-circle-outline"
              size={20}
              color={colors.primary}
            />
          ) : (
            <Icon
              name="checkmark-circle-outline"
              size={20}
              color={colors.success}
            />
          )
        }
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingHorizontal: layout.space?.lg ?? 18,
          paddingTop: layout.space?.md ?? 16,
          paddingBottom: footerH + 18,
          gap: 18,
        }}
      >
        <View style={s.headerCard}>
          <Text style={s.title} numberOfLines={1}>
            {title?.trim() || "Untitled plan"}
          </Text>
          <Text style={s.subTitle} numberOfLines={2}>
            Ends {fmtDateShort(endDate)}
          </Text>
        </View>

        <Text style={s.sectionLabel}>PLAN CONFIGURATION</Text>

        <View style={s.card}>
          {/* Plan Info */}
          <Pressable
            style={s.row}
            onPress={() =>
              router.push({
                pathname: "/features/plans/edit/planInfo",
                params: { planId },
              })
            }
          >
            <View style={s.rowLeft}>
              <View style={s.iconCircle}>
                <Icon
                  name="information-circle-outline"
                  size={18}
                  color={colors.text}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Plan Info</Text>
                <Text style={s.rowSub}>General settings and scheduling</Text>
              </View>
            </View>

            <View style={s.rowRight}>
              {statusDot(dirtyPlanInfo)}
              <Icon
                name="chevron-forward"
                size={18}
                color={colors.textMuted ?? colors.subtle}
              />
            </View>
          </Pressable>

          <View style={s.divider} />

          {/* Workouts */}
          <Pressable
            style={s.row}
            onPress={() =>
              router.push({
                pathname: "/features/plans/edit/workout",
                params: { planId },
              })
            }
          >
            <View style={s.rowLeft}>
              <View style={s.iconCircle}>
                <Icon name="barbell-outline" size={18} color={colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Workouts</Text>
                <Text style={s.rowSub}>
                  {workouts.length} workout{workouts.length === 1 ? "" : "s"} •{" "}
                  {workouts.reduce(
                    (sum, w) => sum + (w.exercises?.length ?? 0),
                    0
                  )}{" "}
                  exercise
                  {workouts.reduce(
                    (sum, w) => sum + (w.exercises?.length ?? 0),
                    0
                  ) === 1
                    ? ""
                    : "s"}
                </Text>
              </View>
            </View>

            <View style={s.rowRight}>
              {statusDot(dirtyWorkouts)}
              <Icon
                name="chevron-forward"
                size={18}
                color={colors.textMuted ?? colors.subtle}
              />
            </View>
          </Pressable>

          <View style={s.divider} />

          {/* Goals */}
          <Pressable
            style={s.row}
            onPress={() =>
              router.push({
                pathname: "/features/plans/edit/goals",
                params: { planId },
              })
            }
          >
            <View style={s.rowLeft}>
              <View style={s.iconCircle}>
                <Icon name="trophy-outline" size={18} color={colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Goals</Text>
                <Text style={s.rowSub}>
                  {goals.length} goal{goals.length === 1 ? "" : "s"} selected
                </Text>
              </View>
            </View>

            <View style={s.rowRight}>
              {statusDot(dirtyGoals)}
              <Icon
                name="chevron-forward"
                size={18}
                color={colors.textMuted ?? colors.subtle}
              />
            </View>
          </Pressable>
        </View>

        {isDirty ? (
          <Text style={s.dirtyHint}>You have unsaved changes.</Text>
        ) : (
          <Text style={s.cleanHint}>Everything is up to date.</Text>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            style={[s.footerBtn, s.footerBtnGhost]}
            onPress={onCancel}
            disabled={saving}
          >
            <Text style={s.footerBtnGhostText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[
              s.footerBtn,
              s.footerBtnPrimary,
              (!isDirty || saving) && { opacity: 0.55 },
            ]}
            onPress={saveAll}
            disabled={!isDirty || saving}
          >
            <Text style={s.footerBtnPrimaryText}>
              {saving ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onArchive}
          disabled={saving}
          style={{ marginTop: 12, alignItems: "center" }}
        >
          <Text style={s.archiveText}>Archive plan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function safeStartFromNotes(notes?: string | null) {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    return typeof obj?.start === "number" ? obj.start : null;
  } catch {
    return null;
  }
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },

    headerCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontWeight: "900",
      color: colors.text,
      letterSpacing: -0.2,
    },
    subTitle: {
      color: colors.textMuted ?? colors.subtle,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
      fontSize: 13,
    },

    sectionLabel: {
      marginTop: 6,
      marginBottom: -8,
      color: colors.textMuted ?? colors.subtle,
      fontSize: 12,
      letterSpacing: 0.9,
      fontWeight: "900",
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },

    row: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
      paddingRight: 14,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    rowTitle: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 15,
    },
    rowSub: {
      marginTop: 4,
      color: colors.textMuted ?? colors.subtle,
      fontSize: 12,
      fontWeight: "600",
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 68,
    },

    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },

    dirtyHint: {
      color: colors.primary,
      fontWeight: "900",
      marginTop: 2,
    },
    cleanHint: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      marginTop: 2,
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: layout?.space?.lg ?? 18,
      paddingTop: 12,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },

    footerBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    footerBtnGhost: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    footerBtnGhostText: {
      color: colors.text,
      fontWeight: "900",
    },
    footerBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    footerBtnPrimaryText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "900",
    },

    archiveText: {
      color: colors.danger ?? "#ef4444",
      fontWeight: "900",
    },
  });
