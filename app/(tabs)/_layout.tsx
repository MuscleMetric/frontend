import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, router } from "expo-router";
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
import { log } from "../../lib/logger";

function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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
    [colors, typography, layout],
  );

  return (
    <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>

        <View style={styles.headerRight}>{right}</View>
      </View>
    </View>
  );
}

type Stage1Status = {
  user_id: string;
  is_complete: boolean;
  onboarding_step: number | null;
  onboarding_completed_at: string | null;
  onboarding_dismissed_at: string | null;
  missing_fields: string[];
};

type OnboardingGateRow = {
  user_id: string;
  required_stage: "stage2" | "stage3" | null;
  workouts_completed: number;
  stage2_triggered_at: string | null;
  stage2_completed_at: string | null;
  stage3_triggered_at: string | null;
  stage3_completed_at: string | null;
};

type RpcResult<T> = {
  data: T | null;
  error: any;
};

export default function TabsLayout() {
  const { colors, typography } = useAppTheme();
  const { session, loading: authLoading } = useAuth();

  const [checking, setChecking] = useState(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const sessionUserId = session?.user?.id ?? null;

  const loadUnreadCount = useCallback(async () => {
    if (!sessionUserId) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await supabase.rpc("get_unread_notifications_count_v1");

      log("unread rpc raw:", res.data);

      if (res.error) {
        log("unread count error:", res.error);
        setUnreadCount(0);
        return;
      }

      const raw = res.data;
      const n = Array.isArray(raw)
        ? Number(raw[0]?.unread_count ?? 0)
        : Number((raw as any)?.unread_count ?? 0);

      setUnreadCount(Number.isFinite(n) ? n : 0);
    } catch (err) {
      console.warn("[tabs] unread count crash", err);
      setUnreadCount(0);
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;
    void loadUnreadCount();
  }, [sessionUserId, loadUnreadCount]);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      setChecking(false);
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setChecking(true);

    async function runGates() {
      try {
        const s1 = (await withTimeout(
          supabase.rpc("get_onboarding_status_v1").single(),
          6000,
          "get_onboarding_status_v1",
        )) as RpcResult<Stage1Status>;

        if (cancelled) return;

        // Fail open
        if (s1.error) {
          setChecking(false);
          return;
        }

        const stage1 = s1.data;

        if (!stage1?.is_complete) {
          setChecking(false);
          router.replace("/onboarding");
          return;
        }

        const g = (await withTimeout(
          supabase.rpc("get_onboarding_gate_v1").single(),
          6000,
          "get_onboarding_gate_v1",
        )) as RpcResult<OnboardingGateRow>;

        if (cancelled) return;

        if (g.error) {
          setChecking(false);
          return;
        }

        const gate = g.data;

        if (gate?.required_stage === "stage2") {
          setChecking(false);
          router.replace("/onboarding/stage2");
          return;
        }

        if (gate?.required_stage === "stage3") {
          setChecking(false);
          router.replace("/onboarding/stage3");
          return;
        }

        setChecking(false);
      } catch {
        if (!cancelled) {
          setChecking(false); // fail open
        }
      }
    }

    const timer = setTimeout(() => {
      void runGates();
    }, 750);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authLoading, sessionUserId, !!session]);

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
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
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
                onPress={() =>
                  router.push({
                    pathname: "/social",
                    params: { openCreate: "1" },
                  })
                }
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
          tabBarIcon: ({ color, size }) => <User2 color={color} size={size} />,
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
