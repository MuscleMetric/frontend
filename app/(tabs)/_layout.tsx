// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { House, LineChart, Dumbbell, User2 } from "lucide-react-native";

function CustomHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>{title}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // Each screen gets this header by default
      screenOptions={{
        header: ({ options }) => (
          <CustomHeader title={(options.title as string) ?? "MuscleMetric"} />
        ),
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User2 color={color} size={size} />,
        }}
      />

      {/* Detail/hidden pages: header OFF here */}
      <Tabs.Screen
        name="achievements"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
