// app/(tabs)/_layout.tsx
import { useEffect, useMemo, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  House,
  LineChart,
  Dumbbell,
  User2,
  BarChart3,
} from "lucide-react-native";

import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/authContext";
import { supabase } from "../../lib/supabase";
import { ResumeWorkoutGate } from "@/app/features/workouts/components/ResumeWorkoutGate";

function CustomHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/** Stage 1 gate response (your existing RPC) */
type Stage1Status = {
  user_id: string;
  is_complete: boolean;
  onboarding_step: number | null;
  onboarding_completed_at: string | null;
  onboarding_dismissed_at: string | null;
  missing_fields: string[];
};

/** Stage 2/3 gate response (new RPC) */
type OnboardingGateRow = {
  user_id: string;
  required_stage: "stage2" | "stage3" | null;
  workouts_completed: number;
  stage2_triggered_at: string | null;
  stage2_completed_at: string | null;
  stage3_triggered_at: string | null;
  stage3_completed_at: string | null;
};

export default function TabsLayout() {
  const { colors, typography } = useAppTheme();
  const { session, profile, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      router.replace("/(auth)/login");
      return;
    }

    let cancelled = false;

    async function runGates() {
      try {
        // -------------------------
        // 1) Stage 1 gate
        // -------------------------
        const s1 = await supabase.rpc("get_onboarding_status_v1").single();
        if (cancelled) return;

        if (s1.error) {
          router.replace("/(auth)/onboarding");
          return;
        }

        const stage1 = s1.data as unknown as Stage1Status;

        if (!stage1?.is_complete) {
          router.replace("/(auth)/onboarding");
          return;
        }

        // -------------------------
        // 2) Stage 2/3 gate
        // -------------------------
        const g = await supabase.rpc("get_onboarding_gate_v1").single();

        if (g.error) {
          console.log("gate rpc error:", g.error);
          console.log("gate rpc data:", g.data);
          setChecking(false);
          return;
        }

        const gate = g.data as unknown as OnboardingGateRow;

        if (gate?.required_stage === "stage2") {
          // avoid pointless loop if you ever mount tabs while already on this route
          if (pathname !== "/onboarding/stage2") {
            router.replace("/onboarding/stage2");
            return;
          }
        }

        if (gate?.required_stage === "stage3") {
          if (pathname !== "/onboarding/stage3") {
            router.replace("/onboarding/stage3");
            return;
          }
        }

        setChecking(false);
      } catch {
        // safest fallback: allow app to load
        setChecking(false);
      }
    }

    runGates();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, pathname]);

  if (authLoading || checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <ResumeWorkoutGate />

      <Tabs
        screenOptions={{
          header: ({ options }) => (
            <CustomHeader
              title={
                (options.headerTitle as string) ??
                (options.title as string) ??
                "MuscleMetric"
              }
            />
          ),

          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          },

          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,

          tabBarLabelStyle: {
            fontSize: typography.size.meta,
            fontFamily: typography.fontFamily.semibold,
          },

          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerTitle: "MuscleMetric",
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => (
              <House color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="progress"
          options={{
            headerTitle: "Progress",
            tabBarLabel: "Progress",
            tabBarIcon: ({ color, size }) => (
              <LineChart color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="workout"
          options={{
            headerTitle: "Workouts",
            tabBarLabel: "Workouts",
            tabBarIcon: ({ color, size }) => (
              <Dumbbell color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="admin"
          options={{
            headerTitle: "Admin",
            tabBarLabel: "Admin",
            tabBarIcon: ({ color, size }) => (
              <BarChart3 color={color} size={size} />
            ),
            href: isAdmin ? "admin" : null,
          }}
        />

        <Tabs.Screen
          name="user"
          options={{
            headerTitle: "Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, size }) => (
              <User2 color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    headerWrap: {
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerRow: {
      height: 52,
      paddingHorizontal: layout.space.lg,
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
    },
  });
