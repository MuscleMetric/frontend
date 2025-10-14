import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import GoalCard, { GoalItem } from "@/app/_components/goals/GoalCard";
import GoalCreateModal from "@/app/_components/goals/GoalCreateModal";

export default function GoalsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id!;
  const [tab, setTab] = useState<"personal" | "plan">("personal");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GoalItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (userId) load();
  }, [userId, tab]);

  async function load() {
    setLoading(true);
    try {
      if (tab === "personal") {
        const { data, error } = await supabase
          .from("v_personal_goal_progress")
          .select("*");
        if (error) throw error;

        // Map goal_id -> id so the rest of the UI can rely on `id`
        const rows = (data ?? []).map((d: any) => ({
          ...d,
          id: d.goal_id, // <-- important
        }));
        setItems(rows);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(id: string) {
    await supabase
      .from("personal_goals")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }
  async function deleteGoal(id: string) {
    if (!id) {
      Alert.alert("Delete failed", "Missing goal id.");
      return;
    }
    if (!userId) {
      Alert.alert("Delete failed", "You must be logged in.");
      return;
    }
    try {
      const { error } = await supabase
        .from("personal_goals")
        .delete()
        .eq("id", id)
        .eq("user_id", userId); // satisfy RLS
      if (error) {
        Alert.alert("Delete failed", error.message);
        return;
      }
      // Optimistic update
      setItems((prev) => prev.filter((g) => g.id !== id));
    } finally {
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(
      "Delete goal?",
      "This will permanently remove the goal and its logs.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteGoal(id) },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <View style={st.tabs}>
        <Tab
          text="Plan Goals"
          active={tab === "plan"}
          onPress={() => setTab("plan")}
        />
        <Tab
          text={`Personal Goals (${items.length})`}
          active={tab === "personal"}
          onPress={() => setTab("personal")}
        />
      </View>

      <View style={st.headerRow}>
        <View>
          <Text style={st.h1}>
            {tab === "personal" ? "Personal Goals" : "Plan Goals"}
          </Text>
          <Text style={st.h2}>
            {tab === "personal"
              ? "SMART goals to keep you motivated"
              : "Goals derived from your active plan"}
          </Text>
        </View>
        {tab === "personal" && (
          <Pressable onPress={() => setShowCreate(true)} style={st.addBtn}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>+ Add Goal</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <GoalCard
              goal={item}
              onMarkComplete={() => markComplete(item.id)} 
              onDelete={() => confirmDelete(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text
              style={{ textAlign: "center", color: "#6b7280", marginTop: 24 }}
            >
              {tab === "personal"
                ? "No personal goals yet."
                : "No plan goals yet."}
            </Text>
          }
        />
      )}

      <GoalCreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        userId={userId}
        onCreated={load}
      />
    </View>
  );
}
function Tab({
  text,
  active,
  onPress,
}: {
  text: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[st.tabBtn, active && st.tabActive]}>
      <Text
        style={[st.tabText, active && { color: "#111827", fontWeight: "800" }]}
      >
        {text}
      </Text>
    </Pressable>
  );
}
const st = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 8,
    gap: 8,
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#eef2ff" },
  tabText: { color: "#6b7280", fontWeight: "700" },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 18, fontWeight: "800" },
  h2: { color: "#6b7280" },
  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
