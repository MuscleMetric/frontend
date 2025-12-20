import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SectionCard } from "../../../_components";

type PlanListRow = {
  id: string;
  title: string | null;
  completed_at: string | null;
};

export default function AllPlansScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanListRow[]>([]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("id, title, completed_at")
          .eq("user_id", userId)
          .eq("is_completed", true)
          .order("completed_at", { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!cancelled) setPlans((data ?? []) as any);
      } catch (e) {
        console.warn("all plans load error:", e);
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.heading}>Plan history</Text>

      <SectionCard>
        {loading ? (
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator />
          </View>
        ) : plans.length === 0 ? (
          <Text style={styles.subtle}>No completed plans yet.</Text>
        ) : (
          <View style={{ marginTop: 2 }}>
            {plans.map((p) => (
              <Pressable
                key={p.id}
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: "/features/plans/history/view",
                    params: { planId: p.id },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{p.title ?? "Plan"}</Text>
                  <Text style={styles.subtitle}>Completed • {formatShortDate(p.completed_at)}</Text>
                </View>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SectionCard>
    </ScrollView>
  );
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    heading: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 10,
    },
    subtle: {
      color: colors.subtle,
      fontSize: 13,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 10,
    },
    title: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.subtle,
    },
    chevron: {
      color: colors.subtle,
      fontSize: 18,
      fontWeight: "800",
    },
  });
