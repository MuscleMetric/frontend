// app/(tabs)/user.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  AppState,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAuth } from "../../lib/useAuth";
import { useFocusEffect } from "expo-router";

import { SectionCard, RingProgress } from "../_components";
import { useAppTheme } from "../../lib/useAppTheme";

type ProfileRow = {
  name: string | null;
  email: string | null;
  created_at: string;
  settings: any;
  weekly_streak: number | null;
};

type PlanRowType = {
  id: string;
  title: string;
  subtitle: string;
  status: "active" | "completed";
};

type FavouriteAchievement = {
  id: string;
  code: string;
  title: string;
  category: string;
  difficulty: string;
};

export default function UserScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);

  const { colors, dark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [workoutsCompleted, setWorkoutsCompleted] = useState<number>(0);
  const [plannedWorkouts, setPlannedWorkouts] = useState<number>(0);
  const [weeklyStreak, setWeeklyStreak] = useState<number>(0);

  const [achievementsTotal, setAchievementsTotal] = useState<number>(0);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState<number>(0);

  const [recentPlans, setRecentPlans] = useState<PlanRowType[]>([]);
  const [hasMorePlans, setHasMorePlans] = useState(false);

  const [favouriteAchievements, setFavouriteAchievements] = useState<
    FavouriteAchievement[]
  >([]);

  // steps + timezone
  const [stepsStreak, setStepsStreak] = useState<number>(0);
  const [stepsDaysMetTotal, setStepsDaysMetTotal] = useState<number>(0);
  const [profileTz, setProfileTz] = useState<string>("UTC");
  const appState = useRef(AppState.currentState);

  const name =
    profile?.name ?? (session?.user?.user_metadata as any)?.name ?? "User";
  const joinedAt =
    profile?.created_at ??
    session?.user?.created_at ??
    new Date().toISOString();
  const joinedText = useMemo(() => formatMonthYear(joinedAt), [joinedAt]);

  const settings = (profile?.settings ?? {}) as any;
  const levelLabel = formatLevel(settings.level);
  const goalLabel = formatPrimaryGoal(settings.primaryGoal);

  const initials = useMemo(() => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  }, [name]);

  useFocusEffect(
    React.useCallback(() => {
      if (!userId) return;
      fetchProfile(userId);
      fetchTotals(userId);
    }, [userId])
  );

  // ---------- timezone + steps ----------
  useEffect(() => {
    if (!userId) return;

    syncTimezoneIfChanged(userId);
    fetchStepStats(userId);

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        syncTimezoneIfChanged(userId);
        fetchStepStats(userId);
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [userId]);

  async function syncTimezoneIfChanged(uid: string) {
    try {
      const deviceTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const { data } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", uid)
        .maybeSingle();

      const currentTz = data?.timezone || "UTC";
      setProfileTz(currentTz);

      if (deviceTz && deviceTz !== currentTz) {
        await supabase
          .from("profiles")
          .update({ timezone: deviceTz })
          .eq("id", uid);
        setProfileTz(deviceTz);
      }
    } catch (e) {
      console.warn("syncTimezoneIfChanged error", e);
    }
  }

  async function fetchStepStats(uid: string) {
    const { data, error } = await supabase
      .from("user_steps_stats")
      .select(
        "streak_current, streak_best, days_met_30, days_met_90, days_met_total"
      )
      .eq("user_id", uid)
      .maybeSingle();

    if (!error && data) {
      setStepsStreak(data.streak_current ?? 0);
      setStepsDaysMetTotal(data.days_met_total ?? 0);
    } else {
      setStepsStreak(0);
      setStepsDaysMetTotal(0);
    }
  }

  // ---------- profile + totals ----------
  async function fetchProfile(uid: string) {
    try {
      setLoading(true);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("name, email, created_at, settings, weekly_streak")
        .eq("id", uid)
        .single();

      if (error) throw error;

      if (profileData) {
        setProfile(profileData);

        const streakFromDb =
          profileData.weekly_streak !== null &&
          profileData.weekly_streak !== undefined
            ? Number(profileData.weekly_streak)
            : 0;
        setWeeklyStreak(Number.isFinite(streakFromDb) ? streakFromDb : 0);

        // 🔥 ADD THIS: load favourites from settings
        await loadFavouriteAchievements(uid, profileData.settings);
      }
    } catch (e) {
      console.error("fetchProfile error", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTotals(uid: string) {
    try {
      // 1) total completed workouts
      const { data: totals } = await supabase
        .from("v_user_totals")
        .select("workouts_completed")
        .eq("user_id", uid)
        .maybeSingle();

      setWorkoutsCompleted(Number(totals?.workouts_completed ?? 0));

      // 2) planned workouts = all workouts in active plans (exclude archived)
      const { data: planned, error: plannedErr } = await supabase
        .from("plan_workouts")
        .select(
          `
          id,
          is_archived,
          plans!inner(
            id,
            user_id,
            is_completed
          )
        `
        )
        .eq("plans.user_id", uid)
        .eq("plans.is_completed", false)
        .eq("is_archived", false);

      if (plannedErr) throw plannedErr;
      setPlannedWorkouts(Array.isArray(planned) ? planned.length : 0);

      // 3) achievements counts
      const [{ count: totalCount }, { count: unlockedCount }] =
        await Promise.all([
          supabase
            .from("achievements")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("user_achievements")
            .select("*", { count: "exact", head: true })
            .eq("user_id", uid),
        ]);

      setAchievementsTotal(totalCount ?? 0);
      setAchievementsUnlocked(unlockedCount ?? 0);

      // 4) recent plans: show active (if any) + last completed (up to 3)
      const [
        { data: activePlan, error: activeErr },
        { data: completedPlans, error: completedErr },
      ] = await Promise.all([
        supabase
          .from("plans")
          .select("id, title, start_date, end_date")
          .eq("user_id", uid)
          .eq("is_completed", false)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // fetch 4 completed so we can show 3 and decide if "View all" should appear
        supabase
          .from("plans")
          .select("id, title, completed_at")
          .eq("user_id", uid)
          .eq("is_completed", true)
          .order("completed_at", { ascending: false })
          .limit(4),
      ]);

      if (activeErr) throw activeErr;
      if (completedErr) throw completedErr;

      const completedArr = Array.isArray(completedPlans) ? completedPlans : [];
      setHasMorePlans(completedArr.length > 3);

      const rows: PlanRowType[] = [];

      // active plan first (if exists)
      if (activePlan?.id) {
        rows.push({
          id: activePlan.id,
          title: activePlan.title ?? "Active plan",
          subtitle: `Active • Ends ${formatShortDate(activePlan.end_date)}`,
          status: "active",
        });
      }

      // then up to 3 completed plans
      rows.push(
        ...completedArr.slice(0, 3).map((p: any) => ({
          id: p.id,
          title: p.title ?? "Plan",
          subtitle: `Completed • ${formatShortDate(p.completed_at)}`,
          status: "completed" as const,
        }))
      );

      setRecentPlans(rows);
    } catch (e) {
      console.error("fetchTotals error", e);
      setPlannedWorkouts(0);
      setAchievementsTotal(0);
      setAchievementsUnlocked(0);
      setRecentPlans([]);
      setHasMorePlans(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  async function loadFavouriteAchievements(uid: string, rawSettings: any) {
    try {
      const favIds: string[] = Array.isArray(
        rawSettings?.favourite_achievements
      )
        ? rawSettings.favourite_achievements.filter(
            (id: any) => typeof id === "string"
          )
        : [];

      if (!favIds.length) {
        setFavouriteAchievements([]);
        return;
      }

      const { data, error } = await supabase
        .from("achievements")
        .select("id, code, title, category, difficulty")
        .in("id", favIds);

      if (error) throw error;
      if (!data) {
        setFavouriteAchievements([]);
        return;
      }

      // preserve order from settings and cap at 3
      const ordered: FavouriteAchievement[] = favIds
        .map((id) => (data as any[]).find((row) => row.id === id))
        .filter(Boolean)
        .slice(0, 3)
        .map((row: any) => ({
          id: row.id,
          code: row.code,
          title: row.title,
          category: row.category,
          difficulty: row.difficulty,
        }));

      setFavouriteAchievements(ordered);
    } catch (e) {
      console.error("loadFavouriteAchievements error", e);
      setFavouriteAchievements([]);
    }
  }

  function renderFavouriteBadge(a: FavouriteAchievement) {
    return (
      <View key={a.id} style={styles.favouriteBadge}>
        <Text style={styles.favouriteBadgeEmoji}>
          {difficultyEmoji(a.difficulty)}
        </Text>
        <Text
          style={styles.favouriteBadgeTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {a.title}
        </Text>
      </View>
    );
  }

  // ---------- Half donut gauge ----------
  type HalfDonutProps = {
    completed: number;
    planned: number;
    size?: number;
    strokeWidth?: number;
    progressColor: string;
    backgroundColor: string;
    labelColor: string;
  };

  function HalfDonut({
    completed,
    planned,
    size = 190,
    strokeWidth = 18,
    progressColor,
    backgroundColor,
    labelColor,
  }: HalfDonutProps) {
    const cx = size / 2;
    const cy = size / 2;
    const radius = cx - strokeWidth / 2;

    const total = Math.max(completed + planned, 1);
    const progress = Math.max(
      0,
      Math.min(1, total > 0 ? completed / total : 0)
    );

    const startAngle = -Math.PI; // left
    const endAngle = 0; // right
    const progressEndAngle = startAngle + (endAngle - startAngle) * progress;

    const buildArc = (from: number, to: number) => {
      const x1 = cx + radius * Math.cos(from);
      const y1 = cy + radius * Math.sin(from);
      const x2 = cx + radius * Math.cos(to);
      const y2 = cy + radius * Math.sin(to);
      const largeArc = to - from > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    const bgPath = buildArc(startAngle, endAngle);
    const fgPath = buildArc(startAngle, progressEndAngle);

    return (
      <View style={{ alignItems: "center" }}>
        <Svg width={size} height={size / 1.3}>
          {/* background half ring */}
          <Path
            d={bgPath}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
          />
          {/* progress half ring */}
          <Path
            d={fgPath}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
          />
        </Svg>

        <View
          style={{
            position: "absolute",
            top: size / 4.1,
            alignItems: "center",
          }}
        >
          <Text style={{ color: labelColor, fontSize: 12, opacity: 0.7 }}>
            Total workouts
          </Text>
          <Text style={{ color: labelColor, fontSize: 26, fontWeight: "800" }}>
            {completed}
          </Text>
        </View>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <Text style={{ color: colors.text }}>Please log in.</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* Profile card */}
        <SectionCard>
          <View style={styles.profileContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <Text style={styles.profileName}>{name}</Text>

            {/* Level + primary goal */}
            <Text style={styles.profileMeta}>
              {levelLabel} · {goalLabel}
            </Text>

            <Text style={styles.profileJoined}>Joined {joinedText}</Text>

            {/* 🔥 Favourite achievements */}
            {favouriteAchievements.length > 0 ? (
              <View style={styles.favouritesContainer}>
                <Text style={styles.favouritesHeading}>
                  Favourite achievements
                </Text>

                <View style={styles.favouritesBadgesWrapper}>
                  {favouriteAchievements.length <= 2 ? (
                    // 1–2: single centered row
                    <View style={styles.favouritesRow}>
                      {favouriteAchievements.map((a) =>
                        renderFavouriteBadge(a)
                      )}
                    </View>
                  ) : (
                    // 3: two on top row, one centered below
                    <>
                      <View style={styles.favouritesRow}>
                        {favouriteAchievements
                          .slice(0, 2)
                          .map((a) => renderFavouriteBadge(a))}
                      </View>
                      <View style={styles.favouritesRowSingle}>
                        {renderFavouriteBadge(favouriteAchievements[2])}
                      </View>
                    </>
                  )}
                </View>

                <Pressable
                  style={styles.favouritesEditButton}
                  onPress={() =>
                    router.push(
                      "/features/achievements/achievements?fromProfile=1"
                    )
                  }
                >
                  <Text style={styles.favouritesEditText}>Edit favourites</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.favouritesEmptyButton}
                onPress={() =>
                  router.push(
                    "/features/achievements/achievements?fromProfile=1"
                  )
                }
              >
                <Text style={styles.favouritesEmptyText}>
                  Pick your favourite achievements →
                </Text>
              </Pressable>
            )}
          </View>
        </SectionCard>

        {/* My Activity */}
        <Text style={styles.sectionHeading}>My Activity</Text>
        <SectionCard tint={colors.card}>
          {loading ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              {/* Half donut gauge */}
              <View style={styles.activityGaugeContainer}>
                <HalfDonut
                  completed={workoutsCompleted}
                  planned={plannedWorkouts}
                  progressColor={colors.successBg ?? "#22c55e"}
                  backgroundColor={colors.border}
                  labelColor={colors.text}
                />
              </View>

              {/* Legend under gauge */}
              <View style={styles.activityLegendRow}>
                <View style={styles.activityLegendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: colors.successBg ?? "#22c55e" },
                    ]}
                  />
                  <Text style={styles.activityLabel}>
                    Completed ({workoutsCompleted})
                  </Text>
                </View>
                <View style={styles.activityLegendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <Text style={styles.activityLabel}>
                    Planned ({plannedWorkouts})
                  </Text>
                </View>
              </View>

              {/* Streak cards */}
              <View style={styles.streakRow}>
                <View style={styles.streakCard}>
                  <Text style={styles.streakLabel}>Weekly workout streak</Text>
                  <Text style={styles.streakValue}>
                    {weeklyStreak} week{weeklyStreak === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.streakHint}>
                    Hit your weekly goal to keep this going.
                  </Text>
                </View>

                <View style={styles.streakCard}>
                  <Text style={styles.streakLabel}>Step streak</Text>
                  <Text style={styles.streakValue}>
                    {stepsStreak} day{stepsStreak === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.streakHint}>
                    Days met total: {stepsDaysMetTotal}
                  </Text>
                </View>
              </View>

              {/* --- divider before extra sections --- */}
              <View style={styles.activityDivider} />

              {/* Achievements section */}
              <Text style={styles.subSectionHeading}>Achievements</Text>
              <View style={styles.achievementsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.achievementsText}>
                    {achievementsUnlocked} of {achievementsTotal} unlocked
                  </Text>
                  <Text style={styles.achievementsHint}>
                    Keep training to unlock more badges.
                  </Text>
                </View>
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
                style={[
                  styles.smallButton,
                  { backgroundColor: colors.successBg },
                ]}
                onPress={() =>
                  router.push("/features/achievements/achievements")
                }
              >
                <Text
                  style={[
                    styles.smallButtonText,
                    { color: colors.successText },
                  ]}
                >
                  View all achievements
                </Text>
              </Pressable>

              {/* --- divider before plan history --- */}
              <View style={styles.activityDivider} />

              <Text style={styles.subSectionHeading}>Recent plans</Text>

              {recentPlans.length === 0 ? (
                <Text style={styles.subtle}>
                  No plans have been completed yet.
                </Text>
              ) : (
                <View style={{ marginTop: 4 }}>
                  {recentPlans.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.planRow}
                      onPress={() =>
                        router.push(
                          p.status === "active"
                            ? {
                                pathname: "/features/plans/history/view",
                                params: { planId: p.id },
                              }
                            : {
                                pathname: "/features/plans/history/view",
                                params: { planId: p.id },
                              }
                        )
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle}>{p.title}</Text>
                        <Text style={styles.planSubtitle}>{p.subtitle}</Text>
                      </View>

                      <View
                        style={[
                          styles.planStatusPill,
                          p.status === "active"
                            ? styles.planStatusPillActive
                            : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.planStatusText,
                            p.status === "active"
                              ? styles.planStatusTextActive
                              : null,
                          ]}
                        >
                          {p.status === "active" ? "Active" : "Completed"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}

                  {hasMorePlans && (
                    <Pressable
                      style={[
                        styles.smallButton,
                        { backgroundColor: colors.primaryBg ?? colors.card },
                      ]}
                      onPress={() => router.push("/features/plans/history/all")}
                    >
                      <Text
                        style={[styles.smallButtonText, { color: colors.text }]}
                      >
                        View all plans →
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
        </SectionCard>

        {/* Settings */}
        <Text style={styles.sectionHeading}>Settings</Text>
        <SectionCard>
          <SettingRowSimple
            label="Personal Information"
            onPress={() => router.push("/features/profile/EditProfile")}
          />
          <SettingRowSimple
            label="Notifications"
            onPress={() =>
              Alert.alert("Notifications", "Notification settings coming soon.")
            }
          />
          <SettingRowSimple
            label="Help & Support"
            onPress={() =>
              Alert.alert("Help & Support", "Support screen coming soon.")
            }
          />
          <SettingRowSimple
            label="Privacy Policy"
            onPress={() =>
              Alert.alert(
                "Privacy Policy",
                "Privacy Policy screen coming soon."
              )
            }
          />
          <SettingRowSimple
            label="Terms & Conditions"
            onPress={() =>
              Alert.alert(
                "Terms & Conditions",
                "Terms & Conditions screen coming soon."
              )
            }
          />
          <SettingRowSimple
            label="Community Guidelines"
            onPress={() =>
              Alert.alert(
                "Community Guidelines",
                "Community Guidelines screen coming soon."
              )
            }
            showDivider={false}
          />
        </SectionCard>

        {/* Logout */}
        <Pressable style={styles.logout} onPress={onLogout}>
          <Text style={{ color: "#ef4444", fontWeight: "700" }}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

/**
 * Simple settings row for this screen.
 */
function SettingRowSimple({
  label,
  onPress,
  showDivider = true,
}: {
  label: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
          {label}
        </Text>
        <Text style={{ color: colors.subtle, fontSize: 16 }}>›</Text>
      </Pressable>
      {showDivider && (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
          }}
        />
      )}
    </View>
  );
}

function formatLevel(level?: string | null) {
  if (!level) return "Set your level";
  switch (level) {
    case "beginner":
      return "Beginner";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced";
    default:
      return level.replace(/_/g, " ");
  }
}

function formatPrimaryGoal(goal?: string | null) {
  if (!goal) return "Set your primary goal";
  switch (goal) {
    case "build_muscle":
      return "Build muscle";
    case "lose_fat":
      return "Lose fat";
    case "maintain":
      return "Maintain";
    case "get_stronger":
      return "Get stronger";
    case "improve_fitness":
      return "Improve fitness";
    default:
      return goal.replace(/_/g, " ");
  }
}

/* ---------- Themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    sectionHeading: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 8,
      color: colors.text,
      marginTop: 16,
    },

    activityGaugeContainer: {
      alignItems: "center",
      marginBottom: 12,
      marginTop: 4,
    },
    activityLegendRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    activityLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    activityLabel: {
      fontSize: 13,
      color: colors.subtle,
    },

    streakRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    streakCard: {
      flex: 1,
      backgroundColor: colors.surface ?? colors.background,
      borderRadius: 12,
      padding: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    streakLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.subtle,
      marginBottom: 4,
    },
    streakValue: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 2,
    },
    streakHint: {
      fontSize: 11,
      color: colors.subtle,
    },

    activityDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginTop: 18,
      marginBottom: 12,
    },
    subSectionHeading: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },

    // Achievements section
    achievementsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    achievementsText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    achievementsHint: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
    },
    smallButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginTop: 8,
    },
    smallButtonText: {
      fontSize: 12,
      fontWeight: "700",
    },

    // Plan history rows
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    planTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    planSubtitle: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
    },
    planStatusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.successBg ?? "#22c55e22",
    },
    planStatusText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.successText ?? "#16a34a",
    },

    subtle: {
      color: colors.subtle,
      fontSize: 13,
    },

    profileContainer: {
      alignItems: "center",
      paddingVertical: 16,
      gap: 4,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primaryBg ?? colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.primaryText ?? colors.text,
    },
    profileName: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    profileJoined: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
      textAlign: "center",
    },
    editProfileBtn: {
      marginTop: 10,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    editProfileText: {
      fontWeight: "700",
      color: colors.text,
      fontSize: 14,
    },

    logout: {
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "flex-start",
    },

    profileMeta: {
      fontSize: 14,
      color: colors.subtle,
      marginTop: 2,
      textAlign: "center",
    },

    favouritesContainer: {
      marginTop: 12,
      width: "100%",
      alignItems: "center",
      gap: 8,
    },
    favouritesHeading: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    favouritesBadgesWrapper: {
      marginTop: 4,
      width: "100%",
      gap: 6,
    },
    favouritesRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      width: "100%",
    },
    favouritesRowSingle: {
      marginTop: 4,
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
    },

    favouriteBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxWidth: 180,
      gap: 6,
    },
    favouriteBadgeEmoji: {
      fontSize: 16,
    },
    favouriteBadgeTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },

    favouritesEditButton: {
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    favouritesEditText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.text,
    },
    favouritesEmptyButton: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    favouritesEmptyText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.subtle,
    },
    planStatusPillActive: {
      backgroundColor: "rgba(59,130,246,0.12)", // blue tint
    },
    planStatusTextActive: {
      color: colors.primary ?? "#3b82f6",
    },
  });

/* ---------- Helpers ---------- */
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

function difficultyEmoji(diff?: string | null) {
  if (!diff) return "⭐️";
  switch (diff.toLowerCase()) {
    case "easy":
      return "🟢";
    case "medium":
      return "🔵";
    case "hard":
      return "🟣";
    case "elite":
      return "🏆";
    case "legendary":
      return "🔥";
    default:
      return "⭐️";
  }
}

function prettyAchievementCategory(category?: string | null) {
  if (!category) return "";
  return category.replace(/_/g, " ");
}
