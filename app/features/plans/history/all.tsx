// app/features/plans/history/all.tsx  (or wherever this screen lives)
// Drop-in update to match the redesign: Screen + ScreenHeader + Card, cleaner rows, no SectionCard.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { Screen, ScreenHeader, Card, Pill } from "@/ui";

type PlanListRow = {
  id: string;
  title: string | null;
  completed_at: string | null;
};

export default function AllPlansScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const router = useRouter();

  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

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
    <Screen>
      <ScreenHeader title="Plan history" showBack={true} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.space.md,
          paddingBottom: layout.space.xl,
        }}
      >
        <Card style={styles.card}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : plans.length === 0 ? (
            <View style={{ gap: layout.space.xs }}>
              <Text style={styles.emptyTitle}>No completed plans yet</Text>
              <Text style={styles.muted}>
                Finish a plan and it’ll show up here with a full breakdown.
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionLabel}>COMPLETED PLANS</Text>

              <View style={{ marginTop: layout.space.sm }}>
                {plans.map((p, idx) => (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.row,
                      idx === 0 ? styles.rowFirst : null,
                      idx === plans.length - 1 ? styles.rowLast : null,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/features/plans/history/view",
                        params: { planId: p.id },
                      })
                    }
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {p.title ?? "Plan"}
                      </Text>

                      <View style={styles.metaRow}>
                        <Pill label="Completed" tone="success" />
                        <Text style={styles.metaText}>
                          {formatShortDate(p.completed_at)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      marginTop: layout.space.md,
    },

    loadingWrap: {
      paddingVertical: layout.space.lg,
      alignItems: "center",
      justifyContent: "center",
    },

    sectionLabel: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
    },

    emptyTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
      letterSpacing: -0.2,
    },

    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      paddingVertical: layout.space.md,
      paddingHorizontal: layout.space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },

    rowFirst: {
      borderTopWidth: 0,
      borderTopLeftRadius: layout.radius.lg,
      borderTopRightRadius: layout.radius.lg,
    },

    rowLast: {
      borderBottomLeftRadius: layout.radius.lg,
      borderBottomRightRadius: layout.radius.lg,
    },

    title: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.xs,
    },

    metaText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    chevron: {
      fontSize: 20,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      marginLeft: layout.space.xs,
    },
  });
