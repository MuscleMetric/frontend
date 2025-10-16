// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { House, LineChart, Dumbbell, User2 } from "lucide-react-native";

function CustomHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => (
          <CustomHeader
            // Prefer headerTitle if available, fall back to title
            title={
              (options.headerTitle as string) ??
              (options.title as string) ??
              "MuscleMetric"
            }
          />
        ),
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: "Muscle Metrics", // 👈 Header title
          tabBarLabel: "Home", // 👈 Bottom tab label
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
      <Tabs.Screen
        name="user"
        options={{
          headerTitle: "Your Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User2 color={color} size={size} />,
        }}
      />

      {/* Hidden tab (no header or tab bar item) */}
      <Tabs.Screen
        name="achievements"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#fff", // important so the notch area isn’t transparent
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
});
