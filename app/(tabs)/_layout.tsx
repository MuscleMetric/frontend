// app/(tabs)/_layout.tsx
import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
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

export default function TabsLayout() {
  const { colors, typography } = useAppTheme();
  const { profile } = useAuth();

  const isAdmin = profile?.role === "admin";

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

          // ✅ Tab bar uses your semantic surface/bg
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

          // ✅ Scene background matches app background token
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
            href: isAdmin ? "admin" : null, // ✅ hide when not admin
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
      backgroundColor: colors.bg,
    },
    headerTitle: {
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
    },
  });
