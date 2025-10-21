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
import Svg, { Circle } from "react-native-svg";

type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type PlanWorkoutRow = {
  id: string;
  title: string | null;
  order_index: number | null;
  weekly_complete: boolean | null;
  workout_id: string;
  // nested workout with exercises (names) for highlights
  workouts: {
    id: string;
    workout_exercises: Array<{
      order_index: number | null;
      exercises: { name: string | null } | null;
    }>;
  } | null;
};

type Workout = {
  id: string;
  title: string | null;
  notes: string | null;
};

function weeksBetween(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 1;
  const weeks = (e - s) / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}

function progressColor(pct: number) {
  if (pct < 40) return "#ef4444"; 
  if (pct < 80) return "#f59e0b"; 
  return "#22c55e"; 
}

/** Simple ring progress with a % label */
function ProgressRing({
  size = 64,
  stroke = 8,
  pct = 0,
}: {
  size?: number;
  stroke?: number;
  pct: number; // 0..100
}) {
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - clamped / 100);
  const color = progressColor(clamped);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        {/* track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={stroke}
          fill="none"
        />
        {/* progress */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          // rotate so 0% starts at 12 o'clock
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <Text
        style={{ position: "absolute", fontWeight: "800", color: "#111827" }}
      >
        {Math.round(clamped)}%
      </Text>
    </View>
  );
}

export default function WorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
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

        // 1) Active plan (else most recent)
        let { data: activePlan, error: pErr } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date, is_completed")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pErr) console.warn("plans fetch error:", pErr);

        if (!activePlan) {
          const { data, error } = await supabase
            .from("plans")
            .select("id, title, start_date, end_date, is_completed")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) console.warn("recent plan fetch error:", error);
          activePlan = data ?? null;
        }

        setPlan(activePlan ?? null);

        // 2) Load plan_workouts (with nested workout + exercise names)
        let planWorkoutIds: string[] = [];
        if (activePlan?.id) {
          const { data: pws, error: pwErr } = await supabase
            .from("plan_workouts")
            .select(
              `
    id,
    title,
    order_index,
    weekly_complete,
    workout_id,
    workouts!inner (
      id,
      workout_exercises (
        order_index,
        exercises ( name )
      )
    )
  `
            )
            .eq("plan_id", activePlan.id)
            .order("order_index", { ascending: true });

          if (pwErr) {
            console.warn("plan_workouts fetch error:", pwErr);
          }

          // Normalize to your PlanWorkoutRow shape
          type PlanWorkoutRow = {
            id: string;
            title: string | null;
            order_index: number | null;
            weekly_complete: boolean | null;
            workout_id: string;
            workouts: {
              id: string;
              workout_exercises: Array<{
                order_index: number | null;
                exercises: { name: string | null } | null;
              }>;
            } | null;
          };

          const rows: PlanWorkoutRow[] = (pws ?? []).map((r: any) => {
            // Supabase may return workouts as an array; normalize to a single object or null
            const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts;

            return {
              id: String(r.id),
              title: r.title ?? null,
              order_index: r.order_index ?? null,
              weekly_complete: r.weekly_complete ?? null,
              workout_id: String(r.workout_id),
              workouts: w
                ? {
                    id: String(w.id),
                    workout_exercises: (w.workout_exercises ?? []).map(
                      (we: any) => ({
                        order_index: we?.order_index ?? null,
                        exercises: we?.exercises
                          ? { name: we.exercises.name ?? null }
                          : null,
                      })
                    ),
                  }
                : null,
            };
          });
          setPlanWorkouts(rows);
          planWorkoutIds = rows.map((r) => r.workout_id);

          // 3) Completed count (any history for these workouts)
          if (planWorkoutIds.length) {
            const { count, error: whErr } = await supabase
              .from("workout_history")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .in("workout_id", planWorkoutIds);
            if (whErr) console.warn("workout_history count error:", whErr);
            setCompletedCount(count ?? 0);
          } else {
            setCompletedCount(0);
          }
        } else {
          setPlanWorkouts([]);
          setCompletedCount(0);
        }

        // 4) Loose workouts (exclude ones used in this plan)
        if (planWorkoutIds.length) {
          const { data: loose, error: lwErr } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .not(
              "id",
              "in",
              `(${planWorkoutIds.map((id) => `'${id}'`).join(",")})`
            )
            .order("updated_at", { ascending: false })
            .limit(20);
          if (lwErr) console.warn("loose workouts fetch error:", lwErr);
          setLooseWorkouts(loose ?? []);
        } else {
          const { data: loose, error: lwErr } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(20);
          if (lwErr) console.warn("loose workouts fetch error:", lwErr);
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

  // Build a readable “highlights” string from nested exercises
  function buildHighlights(row: PlanWorkoutRow): string {
    const exs =
      row.workouts?.workout_exercises
        ?.slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((we) => we.exercises?.name || "")
        .filter(Boolean) ?? [];
    return exs.slice(0, 4).join(", ");
  }

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

  // Empty-state: no plan and no loose workouts
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
            Alert.alert("Create Workout", "Workout creator coming soon.");
          }}
        />
      </ScrollView>
    );
  }

  const workoutsPerWeekPlanned = planWorkouts.length;
  const planWeeks = weeksBetween(plan?.start_date, plan?.end_date);
  const totalExpected = workoutsPerWeekPlanned * planWeeks;
  const pctComplete = totalExpected
    ? Math.min(100, (completedCount / totalExpected) * 100)
    : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Plan summary */}
      {plan && (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Left: text */}
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.planTitle}>{plan.title ?? "My Plan"}</Text>
              <Text style={styles.muted}>
                {endText ? `Ends: ${endText}` : "No end date set"}
              </Text>
              <Text style={[styles.muted, { marginTop: 2 }]}>
                {completedCount} of {totalExpected} workouts completed
              </Text>
              <Text style={[styles.muted, { marginTop: 2 }]}>
                ({workoutsPerWeekPlanned || 0} per week × {planWeeks} weeks)
              </Text>
            </View>

            {/* Right: progress ring */}
            <ProgressRing size={72} stroke={8} pct={pctComplete} />
          </View>
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
            {planWorkouts.map((pw) => (
              <PlanWorkoutItem
                key={pw.id}
                title={pw.title ?? "Workout"}
                highlights={buildHighlights(pw)}
                completed={false}
                onPress={() =>
                  Alert.alert("Open Workout", pw.title ?? "Workout")
                }
              />
            ))}

            {planWorkouts.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.muted}>No workouts in this plan yet.</Text>
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
              onPress={() => Alert.alert("Open Workout", w.title ?? "Workout")}
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

/* ---------- presentational ---------- */

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

function PlanWorkoutItem({
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
