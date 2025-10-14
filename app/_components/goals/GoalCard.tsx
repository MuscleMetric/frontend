import { View, Text, Pressable, StyleSheet } from "react-native";

export type GoalItem = {
  id: string; 
  goal_id?: string;
  title: string;
  description?: string | null;
  type: string;
  target: number;
  unit?: string | null;
  period?: "day" | "week" | "month" | "total" | null;
  progress_ratio: number; // 0..1 from view
  due_date?: string | null;
  completed_at?: string | null;
};

export default function GoalCard({
  goal,
  onMarkComplete,
  onEdit,
  onDelete,
}: {
  goal: GoalItem;
  onMarkComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const pct = Math.round((goal.progress_ratio || 0) * 100);
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.title}>{goal.title}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {onEdit && (
            <Pressable onPress={onEdit}>
              <Text style={s.icon}>✏️</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete}>
              <Text style={s.icon}>🗑️</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!!goal.description && <Text style={s.desc}>{goal.description}</Text>}

      <View style={s.tagsRow}>
        <Tag>{labelForType(goal.type, goal.period)}</Tag>
        {goal.due_date && !goal.completed_at && <Tag danger>Overdue</Tag>}
      </View>

      <Text style={s.progressText}>{pct}%</Text>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${pct}%` }]} />
      </View>

      {!goal.completed_at && onMarkComplete && (
        <Pressable style={s.cta} onPress={onMarkComplete}>
          <Text style={s.ctaText}>Mark Complete</Text>
        </Pressable>
      )}
    </View>
  );
}

function Tag({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <View
      style={[
        s.tag,
        danger && { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
      ]}
    >
      <Text style={[s.tagText, danger && { color: "#b91c1c" }]}>
        {children}
      </Text>
    </View>
  );
}
function labelForType(type: string, period?: GoalItem["period"]) {
  switch (type) {
    case "workout_frequency":
      return `Workout ${period ?? "week"}`;
    case "steps_daily":
      return "Daily Steps";
    case "exercise_weight":
      return "Exercise Weight";
    case "exercise_reps":
      return "Exercise Reps";
    case "exercise_1rm":
      return "1RM";
    case "body_weight":
      return "Bodyweight";
    case "distance":
      return "Distance";
    case "time":
      return "Time";
    default:
      return "Goal";
  }
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "800", fontSize: 16 },
  desc: { color: "#6b7280", marginTop: 6 },
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  tagText: { color: "#1d4ed8", fontWeight: "600", fontSize: 12 },
  progressText: { marginTop: 10, fontWeight: "700" },
  barBg: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: 8, backgroundColor: "#3b82f6" },
  icon: { fontSize: 16 },
  cta: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#e6f6ea",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ctaText: { fontWeight: "700", color: "#166534" },
});
