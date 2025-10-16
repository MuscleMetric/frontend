// app/(tabs)/workout.tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { router } from "expo-router";

type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type PlanWorkout = {
  id: string;
  title: string | null;
  order_index: number | null;
  weekly_complete: boolean | null; // schema field; not used as "done"
  workout_id: string;
  highlights: string | null;
};

type Workout = {
  id: string;
  title: string | null;
  notes: string | null;
};

export default function WorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkout[]>([]);
  const [looseWorkouts, setLooseWorkouts] = useState<Workout[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);

  const endText = useMemo(() => {
    if (!plan?.end_date) return null;
    try {
      const d = new Date(plan.end_date);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return plan.end_date;
    }
  }, [plan?.end_date]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);

        // 1) Active plan (or most recent)
        let { data: activePlan } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date, is_completed")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activePlan) {
          const { data } = await supabase
            .from("plans")
            .select("id, title, start_date, end_date, is_completed")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          activePlan = data ?? null;
        }

        setPlan(activePlan ?? null);

        // 2) If plan exists, load plan_workouts
        let planWorkoutIds: string[] = [];
        if (activePlan?.id) {
          const { data: pws } = await supabase
            .from("plan_workouts")
            .select("id, title, order_index, weekly_complete, workout_id, highlights")
            .eq("plan_id", activePlan.id)
            .order("order_index", { ascending: true });

          const rows = (pws ?? []) as PlanWorkout[];
          setPlanWorkouts(rows);
          planWorkoutIds = rows.map((r) => r.workout_id);

          // 3) Compute completed count using workout_history for those workouts
          if (planWorkoutIds.length) {
            const { count } = await supabase
              .from("workout_history")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .in("workout_id", planWorkoutIds);
            setCompletedCount(count ?? 0);
          } else {
            setCompletedCount(0);
          }
        } else {
          setPlanWorkouts([]);
          setCompletedCount(0);
        }

        // 4) Standalone workouts (workouts not in current plan)
        if (planWorkoutIds.length) {
          const { data: loose } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .not("id", "in", `(${planWorkoutIds.map((id) => `'${id}'`).join(",")})`)
            .order("updated_at", { ascending: false })
            .limit(20);
          setLooseWorkouts(loose ?? []);
        } else {
          const { data: loose } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(20);
          setLooseWorkouts(loose ?? []);
        }
      } catch (e) {
        console.warn("workout tab load error:", e);
        setPlan(null);
        setPlanWorkouts([]);
        setLooseWorkouts([]);
        setCompletedCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text>Please log in to view your workouts.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!plan && looseWorkouts.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F7F8FA" }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <CalloutCard
          title="Create your first plan"
          subtitle="Build a routine with targeted workouts, then track your progress."
          primary="Create Plan"
          onPrimary={() => router.push("/features/plans/create/planInfo")}
          secondary="Or add a single workout"
          onSecondary={() => {
            // router.push("/features/workouts/create");
            Alert.alert("Create Workout", "Workout creator coming soon.");
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Plan summary */}
      {plan && (
        <View style={styles.card}>
          <Text style={styles.planTitle}>{plan.title ?? "My Plan"}</Text>
          <Text style={styles.muted}>
            {endText ? `Ends: ${endText}` : "No end date set"}
          </Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>
            {completedCount} of {planWorkouts.length} workouts completed
          </Text>
        </View>
      )}

      {/* Plan workout list */}
      {plan && (
        <View style={styles.section}>
          <SectionHeader
            title="Plan"
            right={
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PillButton
                  label="View"
                  onPress={() =>
                    Alert.alert("View Plan", "Plan details coming soon.")
                  }
                />
                <PillButton
                  label="Edit"
                  tone="warning"
                  onPress={() =>
                    Alert.alert("Edit Plan", "Plan editor coming soon.")
                  }
                />
              </View>
            }
          />
          <View style={{ gap: 10 }}>
            {planWorkouts.map((w) => (
              <PlanWorkoutRow
                key={w.id}
                title={w.title ?? "Workout"}
                highlights={w.highlights ?? ""}
                // consider "completed" = has at least 1 history row
                completed={false /* set true once you open a specific workout */}
                onPress={() =>
                  Alert.alert("Open Workout", w.title ?? "Workout")
                }
              />
            ))}
            {planWorkouts.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  No workouts in this plan yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Standalone workouts */}
      <View style={styles.section}>
        <SectionHeader
          title="Workouts"
          right={
            <PillButton
              label="Create Workout"
              tone="primary"
              onPress={() =>
                Alert.alert("Create Workout", "Workout creator coming soon.")
              }
            />
          }
        />
        <View style={{ gap: 12 }}>
          {looseWorkouts.map((w) => (
            <WorkoutCard
              key={w.id}
              title={w.title ?? "Untitled Workout"}
              notes={w.notes ?? null}
              onPress={() =>
                Alert.alert("Open Workout", w.title ?? "Workout")
              }
            />
          ))}
          {looseWorkouts.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>No standalone workouts yet.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- small presentational bits ---------- */

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.h2}>{title}</Text>
      {right}
    </View>
  );
}

function PillButton({
  label,
  onPress,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  tone?: "default" | "primary" | "warning";
}) {
  const styleByTone =
    tone === "primary"
      ? { bg: "#e6f0ff", fg: "#0b6aa9" }
      : tone === "warning"
      ? { bg: "#fff3e0", fg: "#b45309" }
      : { bg: "#EEF2F6", fg: "#111827" };
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: styleByTone.bg }]}
    >
      <Text style={{ fontWeight: "700", color: styleByTone.fg }}>{label}</Text>
    </Pressable>
  );
}

function PlanWorkoutRow({
  title,
  highlights,
  completed,
  onPress,
}: {
  title: string;
  highlights: string;
  completed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, completed && styles.completedCard]}
    >
      <Text style={[styles.h3, completed && { color: "#22c55e" }]}>
        {title}
        {completed ? "  ✓ Completed" : ""}
      </Text>
      {!!highlights && <Text style={styles.muted}>{highlights}</Text>}
    </Pressable>
  );
}

function WorkoutCard({
  title,
  notes,
  onPress,
}: {
  title: string;
  notes: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={styles.h3}>{title}</Text>
      </View>
      <Text style={styles.muted}>
        {notes ? (notes.length > 80 ? notes.slice(0, 80) + "…" : notes) : "—"}
      </Text>
    </Pressable>
  );
}

function CalloutCard({
  title,
  subtitle,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  title: string;
  subtitle?: string;
  primary: string;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.muted, { marginTop: 4 }]}>{subtitle}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <PillButton label={primary} onPress={onPrimary} tone="primary" />
        {secondary ? (
          <PillButton label={secondary} onPress={onSecondary!} />
        ) : null}
      </View>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  section: { gap: 10 },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  completedCard: {
    backgroundColor: "#ecfdf5",
    borderColor: "#A7F3D0",
  },

  planTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  muted: { color: "#6b7280" },
  h2: { fontSize: 16, fontWeight: "800" },
  h3: { fontSize: 15, fontWeight: "700" },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
});
