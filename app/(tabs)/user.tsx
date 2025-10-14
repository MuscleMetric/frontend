// app/(tabs)/user.tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAuth } from "../../lib/useAuth";
import QuickUpdateModal from "../features/profile/QuickUpdateModal";

import {
  Header,
  SectionCard,
  StatCard,
  RingProgress,
  PlanRow,
  SettingRow,
} from "@/app/_components";

type PlanRowType = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
};

export default function UserScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHeightModal, setShowHeightModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);

  // DB-backed state
  const [profile, setProfile] = useState<{
    name: string | null;
    email: string | null;
    created_at: string;
    settings: any;
  } | null>(null);

  const [workoutsCompleted, setWorkoutsCompleted] = useState<number>(0);
  const [dayStreak, setDayStreak] = useState<number>(0);

  const [achievementsTotal, setAchievementsTotal] = useState<number>(0);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState<number>(0);

  const [plans, setPlans] = useState<PlanRowType[]>([]);

  const name =
    profile?.name ?? (session?.user?.user_metadata as any)?.name ?? "User";
  const email = profile?.email ?? session?.user?.email ?? "user@example.com";
  const joinedAt =
    profile?.created_at ??
    session?.user?.created_at ??
    new Date().toISOString();
  const joinedText = useMemo(() => formatMonthYear(joinedAt), [joinedAt]);

  useEffect(() => {
    if (userId) fetchProfile();
  }, [userId]);

  async function fetchProfile() {
    try {
      setLoading(true);

      // 1) Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, email, created_at, settings, height, weight")
        .eq("id", userId)
        .single();
      if (profileData) setProfile(profileData);

      // 2) Totals
      const { data: totals } = await supabase
        .from("v_user_totals")
        .select("workouts_completed")
        .eq("user_id", userId)
        .maybeSingle();
      setWorkoutsCompleted(Number(totals?.workouts_completed ?? 0));

      // 3) Streak
      const { data: history } = await supabase
        .from("workout_history")
        .select("completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(365);
      if (history)
        setDayStreak(computeDayStreak(history.map((d) => d.completed_at)));

      // 4) Achievements
      const [{ count: totalCount }, { count: unlockedCount }] =
        await Promise.all([
          supabase
            .from("achievements")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("user_achievements")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId),
        ]);
      setAchievementsTotal(totalCount ?? 0);
      setAchievementsUnlocked(unlockedCount ?? 0);

      // 5) Plans
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (Array.isArray(plansData) && plansData.length > 0) {
        const rows = plansData.map((p) => ({
          id: p.id,
          title: p.title ?? "Plan",
          subtitle: `Completed • Last Active: ${formatShortDate(p.updated_at)}`,
          status: "Completed",
          statusColor: "#22c55e",
        }));
        setPlans(rows);
      } else {
        setPlans([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text>Please log in.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Header
            name={name}
            email={email}
            joined={joinedText}
            onEdit={() => router.push("/features/profile/EditProfile")}
          />

          {/* Stats */}
          <View style={styles.row}>
            <StatCard
              value={workoutsCompleted}
              label="Workouts"
              tint="#eaf1ff"
            />
            <StatCard value={dayStreak} label="Day Streak" tint="#eaf7ea" />
          </View>

          {/* Quick Update Section */}
          <SectionCard>
            <Text style={styles.sectionTitle}>Quick Update</Text>
            <View style={styles.rowBetween}>
              <Pressable
                style={[styles.button, { backgroundColor: "#e6f0ff" }]}
                onPress={() => setShowHeightModal(true)}
              >
                <Text style={[styles.buttonText, { color: "#0b6aa9" }]}>
                  Update Height
                </Text>
              </Pressable>
              <Pressable
                style={[styles.button, { backgroundColor: "#e6f0ff" }]}
                onPress={() => setShowWeightModal(true)}
              >
                <Text style={[styles.buttonText, { color: "#0b6aa9" }]}>
                  Update Weight
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          <QuickUpdateModal
            visible={showHeightModal}
            onClose={() => {
              setShowHeightModal(false);
              fetchProfile();
            }}
            userId={userId}
            field="height"
            currentValue={profile?.settings?.height ?? null}
          />

          <QuickUpdateModal
            visible={showWeightModal}
            onClose={() => {
              setShowWeightModal(false);
              fetchProfile();
            }}
            userId={userId}
            field="weight"
            currentValue={profile?.settings?.weight ?? null}
          />

          {/* Achievements */}
          <SectionCard>
            <Text style={styles.sectionTitle}>Achievements Completed</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.subtle}>
                {achievementsUnlocked} of {achievementsTotal}
              </Text>
              <RingProgress
                size={64}
                stroke={8}
                progress={
                  achievementsTotal > 0
                    ? achievementsUnlocked / achievementsTotal
                    : 0
                }
                label={
                  achievementsTotal > 0
                    ? `${Math.round(
                        (achievementsUnlocked / achievementsTotal) * 100
                      )}%`
                    : "0%"
                }
              />
            </View>
            <Pressable
              style={styles.button}
              onPress={() =>
                router.push("/features/achievements/achievements")
              }
            >
              <Text style={styles.buttonText}>View Achievements</Text>
            </Pressable>
          </SectionCard>

          {/* Goals */}
          <SectionCard tint="#eaf4ff">
            <Text style={[styles.sectionTitle, { color: "#0b6aa9" }]}>
              Goals
            </Text>
            <Text style={[styles.body, { marginBottom: 8 }]}>
              Personal and plan goals will appear here once configured.
            </Text>
            <View style={styles.rowBetween}>
              <Pressable
                style={[styles.button, { backgroundColor: "#e6f0ff" }]}
                onPress={() => router.push("/features/goals/goals")}
              >
                <Text style={[styles.buttonText, { color: "#0b6aa9" }]}>
                  Manage Goals
                </Text>
              </Pressable>
              <RingProgress size={64} stroke={8} progress={0} label="0%" />
            </View>
          </SectionCard>

          {/* Plan history */}
          <Text style={styles.groupTitle}>Plan History</Text>
          {loading && (
            <View style={{ paddingVertical: 6 }}>
              <ActivityIndicator />
            </View>
          )}
          {!loading && plans.length === 0 && (
            <SectionCard>
              <Text style={styles.subtle}>
                No plans have been completed yet.
              </Text>
            </SectionCard>
          )}
        </View>
      }
      data={plans}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <PlanRow
          title={item.title}
          subtitle={item.subtitle}
          status={item.status}
          statusColor={item.statusColor}
          onPress={() => Alert.alert(item.title)}
        />
      )}
      ListFooterComponent={
        <View style={{ gap: 12, marginTop: 16 }}>
          <Text style={styles.groupTitle}>Settings</Text>

          <SettingRow
            icon="☀️"
            title="Dark Mode"
            right={<Switch value={darkMode} onValueChange={setDarkMode} />}
          />

          <SettingRow
            icon="🔒"
            title="Change Password"
            onPress={() => router.push("/(auth)/change-password")}
            chevron
          />

          <Pressable style={styles.logout} onPress={onLogout}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Logout</Text>
          </Pressable>
        </View>
      }
    />
  );
}

/* ---------- Helpers ---------- */

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  groupTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 8,
  },
  button: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#e6f6ea",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  buttonText: { fontWeight: "700" },
  body: { fontSize: 14, color: "#1f2937" },
  subtle: { color: "#6b7280" },
  logout: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    alignItems: "flex-start",
  },
});

function formatMonthYear(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "Jan 2024";
  }
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Compute consecutive-day streak up to today from ISO date strings */
function computeDayStreak(isoDates: string[]): number {
  if (!isoDates.length) return 0;
  const daysSet = new Set(isoDates.map((d) => new Date(d).toDateString()));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toDateString();
    if (daysSet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const key2 = cursor.toDateString();
        if (daysSet.has(key2)) continue;
      }
      break;
    }
  }
  return streak;
}
