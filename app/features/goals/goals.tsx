// app/(features)/goals/goals.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";

type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  is_active: boolean | null;
  notes: string | null; // JSON with { start?: number }
  exercises: { name: string | null } | null;
};

export default function GoalsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  // Fetch plan + goals
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // 1) Active plan (else most recent)
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

        if (cancelled) return;
        setPlan(activePlan ?? null);

        // 2) Goals for that plan (if any)
        // 2) Goals for that plan (if any)
        if (activePlan?.id) {
          const { data: g } = await supabase
            .from("goals")
            .select(
              `
        id,
        type,
        target_number,
        unit,
        deadline,
        is_active,
        notes,
        exercises ( name )
      `
            )
            .eq("plan_id", activePlan.id)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

          const rows: GoalRow[] = (g ?? []).map((r: any) => {
            // normalize exercises -> single object or null
            let ex: { name: string | null } | null = null;
            if (Array.isArray(r.exercises)) {
              const first = r.exercises[0];
              ex = first ? { name: first?.name ?? null } : null;
            } else if (r.exercises) {
              ex = { name: r.exercises?.name ?? null };
            }

            return {
              id: String(r.id),
              type: r.type,
              target_number: Number(r.target_number),
              unit: r.unit ?? null,
              deadline: r.deadline ?? null,
              is_active: Boolean(r.is_active),
              notes: r.notes ?? null,
              exercises: ex,
            };
          });

          setGoals(rows);
        } else {
          setGoals([]);
        }
      } catch (e) {
        console.warn("goals load error:", e);
        if (!cancelled) {
          setPlan(null);
          setGoals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const planTitle = plan?.title ?? "Active Plan";
  const endText = useMemo(() => {
    if (!plan?.end_date) return null;
    const d = new Date(plan.end_date);
    return isNaN(d.getTime())
      ? plan.end_date
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }, [plan?.end_date]);

  function fmtMode(m: GoalRow["type"]) {
    switch (m) {
      case "exercise_weight":
        return "Weight";
      case "exercise_reps":
        return "Reps";
      case "distance":
        return "Distance";
      case "time":
        return "Time";
      default:
        return m;
    }
  }

  function parseStart(notes?: string | null): number | null {
    if (!notes) return null;
    try {
      const obj = JSON.parse(notes);
      if (typeof obj?.start === "number") return obj.start;
      return null;
    } catch {
      return null;
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Plan Goals</Text>
          <Text style={styles.h2}>
            {plan
              ? `From “${planTitle}”${endText ? ` • Ends ${endText}` : ""}`
              : "No active plan"}
          </Text>
        </View>
        <View style={{ width: 52 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        {loading ? (
          <View style={[styles.card, { alignItems: "center" }]}>
            <ActivityIndicator />
          </View>
        ) : goals.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: "#6b7280" }}>
              No plan goals yet. Once you create a plan with goals, they will
              appear here.
            </Text>
            <Pressable
              style={[styles.btn, styles.primary, { marginTop: 12 }]}
              onPress={() => router.push("/features/plans/create/planInfo")}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                Create Plan
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {goals.map((g) => {
              const start = parseStart(g.notes);
              const exerciseName = g.exercises?.name ?? "Exercise";
              return (
                <View key={g.id} style={styles.card}>
                  <Text style={{ fontWeight: "800" }}>{exerciseName}</Text>
                  <Text style={{ color: "#6b7280", marginTop: 2 }}>
                    {fmtMode(g.type)} → {g.target_number}
                    {g.unit ? ` ${g.unit}` : ""}
                    {start != null ? `  (start ${start}${g.unit ?? ""})` : ""}
                  </Text>
                  {!!g.deadline && (
                    <Text style={{ color: "#9ca3af", marginTop: 4 }}>
                      Due{" "}
                      {new Date(g.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  link: { color: "#2563eb", fontWeight: "700", width: 52 },
  headerRow: {
    paddingBottom: 8,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  body: { flex: 1, paddingVertical: 16 },
  h1: { fontSize: 18, fontWeight: "800" },
  h2: { color: "#6b7280" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  btn: {
    backgroundColor: "#EEF2F6",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { fontWeight: "800", color: "#111827" },
  primary: { backgroundColor: "#2563eb" },
});
