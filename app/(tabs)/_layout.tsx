// app/(tabs)/_layout.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  House,
  LineChart,
  Dumbbell,
  User2,
  MessageCircle,
  Search,
  Bell,
  Plus,
  Settings,
} from "lucide-react-native";

import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/authContext";
import { supabase } from "../../lib/supabase";
import { ResumeWorkoutGate } from "@/app/features/workouts/components/ResumeWorkoutGate";

function CustomHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
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

        {/* right actions */}
        <View style={styles.headerRight}>{right}</View>
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

  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadUnreadCount = useCallback(async () => {
    const res = await supabase.rpc("get_unread_notifications_count_v1");

    console.log("unread rpc raw:", res.data);

    if (res.error) {
      console.log("unread count error:", res.error);
      setUnreadCount(0);
      return;
    }

    const n = Array.isArray(res.data)
      ? Number(res.data[0]?.unread_count ?? 0)
      : 0;
    setUnreadCount(Number.isFinite(n) ? n : 0);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadUnreadCount();
  }, [session, pathname, loadUnreadCount]);

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
              right={
                typeof options.headerRight === "function"
                  ? options.headerRight({
                      tintColor: colors.text,
                      pressColor: colors.cardPressed,
                      pressOpacity: 0.6,
                      canGoBack: router.canGoBack?.() ?? false,
                    })
                  : null
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
          name="social"
          options={{
            headerTitle: "Social",
            tabBarLabel: "Social",
            tabBarIcon: ({ color, size }) => (
              <MessageCircle color={color} size={size} />
            ),
            headerRight: () => (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 20 }}
              >
                <Pressable
                  onPress={() => router.push("/features/social/search")}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Search size={20} color={colors.text} />
                </Pressable>

                <Pressable
                  onPress={() => router.push("/features/social/inbox")}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ position: "relative" }}>
                    <Bell size={20} color={colors.text} />

                    {unreadCount > 0 ? (
                      <View
                        style={{
                          position: "absolute",
                          right: -6,
                          top: -6,
                          minWidth: 16,
                          height: 16,
                          paddingHorizontal: 4,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.primary,
                          borderWidth: 1,
                          borderColor: colors.bg,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.onPrimary,
                            fontFamily: typography.fontFamily.semibold,
                            fontSize: 10,
                            lineHeight: 12,
                          }}
                          numberOfLines={1}
                        >
                          {unreadCount > 99 ? "99+" : String(unreadCount)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/features/social/create")}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Plus size={22} color={colors.text} />
                </Pressable>
              </View>
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
          name="user"
          options={{
            headerTitle: "Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, size }) => (
              <User2 color={color} size={size} />
            ),
            headerRight: () => (
              <Pressable
                onPress={() => router.push("/features/settings")}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Settings size={20} color={colors.text} />
              </Pressable>
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
      flexDirection: "row",
      alignItems: "center",
    },

    headerTitle: {
      flex: 1,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
    },

    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
    },
  });
