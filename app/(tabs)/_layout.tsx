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
import { useAuth } from "../../lib/authContext"; // 👈 you already have this

function CustomHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth(); // 👈 must include role

  const isAdmin = profile?.role === "admin";

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
          />
        ),
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: "Muscle Metrics",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          headerTitle: "Progress Overview",
          tabBarLabel: "Progress",
          tabBarIcon: ({ color, size }) => (
            <LineChart color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="workout"
        options={{
          headerTitle: "Workout Planner",
          tabBarLabel: "Workouts",
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} />
          ),
        }}
      />

      {isAdmin && (
        <Tabs.Screen
          name="admin"
          options={{
            headerTitle: "Admin Dashboard",
            tabBarLabel: "Admin",
            tabBarIcon: ({ color, size }) => (
              <BarChart3 color={color} size={size} />
            ),
          }}
        />
      )}

      <Tabs.Screen
        name="user"
        options={{
          headerTitle: "Your Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    headerContainer: {
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    header: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerText: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
  });
