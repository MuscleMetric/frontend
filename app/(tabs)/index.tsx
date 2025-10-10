// app/(tabs)/index.tsx
import { View, Text, ScrollView } from "react-native";

export default function Home() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Greeting */}
      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Good evening, Harry 👋</Text>
      </View>

      {/* Daily Summary */}
      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Daily Summary</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <CardStat value="75" label="Workouts Completed" />
          <CardStat value="12.4k" label="Total Volume Lifted (kg)" />
        </View>
      </View>

      {/* Steps */}
      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Total Steps</Text>
        {/* drop in a progress bar later */}
        <Text style={{ fontSize: 24, fontWeight: "800" }}>8,542</Text>
        <Text>/10,000 steps</Text>
      </View>

      {/* Recent Lift Progress */}
      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Recent Lift Progress</Text>
        <LiftRow name="Bench Press" from="85kg" to="90kg" delta="+5.9%" />
        <LiftRow name="Deadlift" from="130kg" to="135kg" delta="+3.8%" />
        <LiftRow name="Squat" from="115kg" to="120kg" delta="+4.3%" />
      </View>
    </ScrollView>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F4F6FA", padding: 16, borderRadius: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "900", marginBottom: 6 }}>{value}</Text>
      <Text style={{ opacity: 0.8 }}>{label}</Text>
    </View>
  );
}

function LiftRow({ name, from, to, delta }: { name: string; from: string; to: string; delta: string }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontWeight: "700" }}>{name}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text>{from} → {to}</Text>
        <Text style={{ fontWeight: "700" }}>{delta}</Text>
      </View>
    </View>
  );
}
