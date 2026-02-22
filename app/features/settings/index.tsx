// app/features/settings/SettingsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

import { ProfileHeaderCard } from "./components/ProfileHeaderCard";
import { SectionHeader } from "./components/SectionHeader";
import { SettingsCard } from "./components/SettingsCard";
import { SettingsRow } from "./components/SettingsRow";
import { ToggleRow } from "./components/ToggleRow";
import { SegmentedRow } from "./components/SegmentedRow";

type Visibility = "public" | "followers" | "private";
type Units = "kg" | "lb";

type SettingsOverview = {
  user_id: string;
  name: string | null;
  username: string | null;
  email: string | null;

  height_cm: number | null;
  weight_kg: number | null;
  date_of_birth: string | null;

  unit_weight: "kg" | "lb" | string;
  unit_height: "cm" | "ft_in" | string;
  experience_level: string | null;
  primary_goal: string | null;

  visibility: Visibility;

  notif_workout_reminders: boolean;
  notif_goal_progress: boolean;
  notif_social_activity: boolean;
};

function fmtDateLabel(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(s?: string | null) {
  if (!s) return "—";
  const clean = s.replace(/_/g, " ").trim();
  if (!clean) return "—";
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SettingsScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },

        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg,
        },
        headerTitle: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        content: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.xxl,
          gap: 18,
        },

        loadingWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
      }),
    [colors, typography, layout],
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SettingsOverview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const res = await supabase.rpc("get_settings_overview");
    if (res.error) {
      console.log("get_settings_overview error:", res.error);
      setData(null);
      setLoading(false);
      return;
    }

    const row = Array.isArray(res.data)
      ? (res.data[0] as SettingsOverview | undefined)
      : undefined;
    setData(row ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChangeVisibility = useCallback(
    async (next: Visibility) => {
      setData((prev) => (prev ? { ...prev, visibility: next } : prev)); // optimistic
      const res = await supabase.rpc("set_profile_visibility_v1", {
        p_visibility: next,
      });

      if (res.error) {
        console.log("set_profile_visibility_v1 error:", res.error);
        // reload to revert accurately
        await load();
      }
    },
    [load],
  );

  const toggleNotif = useCallback(
    async (
      key:
        | "notif_workout_reminders"
        | "notif_goal_progress"
        | "notif_social_activity",
      next: boolean,
    ) => {
      setData((prev) => (prev ? { ...prev, [key]: next } : prev)); // optimistic

      const res = await supabase.rpc("set_notification_pref_v1", {
        p_key: key,
        p_value: next,
      });

      if (res.error) {
        console.log("set_notification_pref_v1 error:", res.error);
        await load();
      }
    },
    [load],
  );

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["top", "left", "right"]}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.backBtn} />
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = data?.name ?? "User";
  const handle = data?.username ?? "username";
  const email = data?.email ?? "—";

  const heightLabel = data?.height_cm != null ? `${data.height_cm} cm` : "—";
  const weightLabel = data?.weight_kg != null ? `${data.weight_kg} kg` : "—";
  const dobLabel = fmtDateLabel(data?.date_of_birth);
  const unitsLabel = (data?.unit_weight ?? "kg").toUpperCase();
  const expLabel = titleCase(data?.experience_level);
  const goalLabel = titleCase(data?.primary_goal);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={10}
          >
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeaderCard
            name={displayName}
            username={handle}
            onPressEdit={() => {
              // TODO: open edit profile route/modal
            }}
          />

          <SectionHeader title="ACCOUNT" />
          <SettingsCard>
            <SettingsRow label="Username" value={handle} onPress={() => {}} />
            <SettingsRow label="Email" value={email} onPress={() => {}} />
            <SettingsRow label="Change Password" onPress={() => {}} last />
          </SettingsCard>

          <SectionHeader title="PERSONAL INFO" />
          <SettingsCard>
            <SettingsRow
              label="Height"
              value={heightLabel}
              onPress={() => {}}
            />
            <SettingsRow
              label="Weight"
              value={weightLabel}
              onPress={() => {}}
            />
            <SettingsRow
              label="Date of Birth"
              value={dobLabel}
              onPress={() => {}}
            />
            <SettingsRow label="Units" value={unitsLabel} onPress={() => {}} />
            <SettingsRow
              label="Experience Level"
              value={expLabel}
              onPress={() => {}}
            />
            <SettingsRow
              label="Primary Goal"
              value={goalLabel}
              onPress={() => {}}
              last
            />
          </SettingsCard>

          <SectionHeader title="NOTIFICATIONS" />
          <SettingsCard>
            <ToggleRow
              label="Workout Reminders"
              value={!!data?.notif_workout_reminders}
              onValueChange={(v) => toggleNotif("notif_workout_reminders", v)}
            />
            <ToggleRow
              label="Goal Progress"
              value={!!data?.notif_goal_progress}
              onValueChange={(v) => toggleNotif("notif_goal_progress", v)}
            />
            <ToggleRow
              label="Social Activity"
              value={!!data?.notif_social_activity}
              onValueChange={(v) => toggleNotif("notif_social_activity", v)}
              last
            />
          </SettingsCard>

          <SectionHeader title="PRIVACY" />
          <SettingsCard>
            <SegmentedRow
              label="Profile Visibility"
              value={(data?.visibility ?? "public") as Visibility}
              options={[
                { key: "public", label: "Public" },
                { key: "followers", label: "Followers" },
                { key: "private", label: "Private" },
              ]}
              onChange={onChangeVisibility}
            />
          </SettingsCard>

          <SectionHeader title="HELP & LEGAL" />
          <SettingsCard>
            <SettingsRow label="Help & Support" onPress={() => {}} />
            <SettingsRow label="Privacy Policy" onPress={() => {}} />
            <SettingsRow label="Terms & Conditions" onPress={() => {}} last />
          </SettingsCard>

          <SectionHeader title="DANGER ZONE" tone="danger" />
          <SettingsCard tone="danger">
            <SettingsRow label="Log Out" tone="danger" onPress={() => {}} />
            <SettingsRow
              label="Delete Account"
              tone="danger"
              onPress={() => {}}
              last
            />
          </SettingsCard>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
