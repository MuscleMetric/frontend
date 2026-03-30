import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Linking,
  Alert,
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

import { EditUsernameModal } from "./modals/EditUsernameModal";
import { EditPersonalInfoModal } from "./modals/EditPersonalInfoModal";
import { ExperienceModal } from "./modals/ExperienceModal";
import { PrimaryGoalModal } from "./modals/PrimaryGoalModal";
import { ConfirmLogoutModal } from "./modals/ConfirmLogoutModal";
import { ConfirmDeleteAccountModal } from "./modals/ConfirmDeleteAccountModal";

type Visibility = "public" | "followers" | "private";

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
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Not set";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(s?: string | null) {
  if (!s) return "Not set";
  const clean = s.replace(/_/g, " ").trim();
  if (!clean) return "Not set";
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPersonalInfoSummary(data: SettingsOverview | null) {
  if (!data) return "Not set";

  const parts: string[] = [];

  if (data.height_cm != null) parts.push(`${data.height_cm} cm`);
  if (data.weight_kg != null) parts.push(`${data.weight_kg} kg`);
  if (data.date_of_birth) parts.push(fmtDateLabel(data.date_of_birth));

  return parts.length > 0 ? parts.join(" • ") : "Not set";
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

        errorWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
          gap: layout.space.md,
        },

        errorText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center",
        },

        retryBtn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.sm,
        },

        retryBtnText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },

        backRow: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          paddingVertical: 14,
          alignItems: "center",
        },

        backRowText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout],
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<SettingsOverview | null>(null);

  const [openUsername, setOpenUsername] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [openExperience, setOpenExperience] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);
  const [openLogout, setOpenLogout] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const res = await supabase.rpc("get_settings_overview");

    if (res.error) {
      console.log("get_settings_overview error:", res.error);
      setData(null);
      setLoadError("Could not load settings.");
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
      setData((prev) => (prev ? { ...prev, visibility: next } : prev));

      const res = await supabase.rpc("set_profile_visibility_v1", {
        p_visibility: next,
      });

      if (res.error) {
        console.log("set_profile_visibility_v1 error:", res.error);
        await load();
      }
    },
    [load],
  );

  const toggleSocialNotif = useCallback(
    async (next: boolean) => {
      setData((prev) =>
        prev ? { ...prev, notif_social_activity: next } : prev,
      );

      const res = await supabase.rpc("set_notification_pref_v1", {
        p_key: "notif_social_activity",
        p_value: next,
      });

      if (res.error) {
        console.log("set_notification_pref_v1 error:", res.error);
        await load();
      }
    },
    [load],
  );

  const openPrivacyPolicy = useCallback(async () => {
    const url = "https://musclemetric.github.io/musclemetric-legal/privacy.html";
    const ok = await Linking.canOpenURL(url);

    if (!ok) {
      Alert.alert("Can't open link", "Please try again later.");
      return;
    }

    await Linking.openURL(url);
  }, []);

  const openTerms = useCallback(async () => {
    const url = "https://musclemetric.github.io/musclemetric-legal/terms.html";
    const ok = await Linking.canOpenURL(url);

    if (!ok) {
      Alert.alert("Can't open link", "Please try again later.");
      return;
    }

    await Linking.openURL(url);
  }, []);

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

  if (loadError || !data) {
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

          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>
              {loadError ?? "Could not load settings."}
            </Text>

            <Pressable
              onPress={load}
              style={({ pressed }) => [
                styles.retryBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = data.name ?? "User";
  const handle = data.username ?? "username";
  const personalInfoLabel = buildPersonalInfoSummary(data);
  const expLabel = titleCase(data.experience_level);
  const goalLabel = titleCase(data.primary_goal);

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
          <ProfileHeaderCard name={displayName} username={handle} />

          <SectionHeader title="ACCOUNT" />
          <SettingsCard>
            <SettingsRow
              label="Username"
              value={handle}
              onPress={() => setOpenUsername(true)}
            />
            <SettingsRow
              label="Personal Info"
              value={personalInfoLabel}
              onPress={() => setOpenPersonal(true)}
              last
            />
          </SettingsCard>

          <SectionHeader title="TRAINING" />
          <SettingsCard>
            <SettingsRow
              label="Experience Level"
              value={expLabel}
              onPress={() => setOpenExperience(true)}
            />
            <SettingsRow
              label="Primary Goal"
              value={goalLabel}
              onPress={() => setOpenGoal(true)}
              last
            />
          </SettingsCard>

          <SectionHeader title="NOTIFICATIONS" />
          <SettingsCard>
            <ToggleRow
              label="Social Activity"
              value={!!data.notif_social_activity}
              onValueChange={toggleSocialNotif}
              last
            />
          </SettingsCard>

          <SectionHeader title="PRIVACY" />
          <SettingsCard>
            <SegmentedRow
              label="Profile Visibility"
              value={(data.visibility ?? "public") as Visibility}
              options={[
                { key: "public", label: "Public" },
                { key: "followers", label: "Followers" },
                { key: "private", label: "Private" },
              ]}
              onChange={onChangeVisibility}
            />
          </SettingsCard>

          <SectionHeader title="LEGAL" />
          <SettingsCard>
            <SettingsRow
              label="Privacy Policy"
              onPress={openPrivacyPolicy}
            />
            <SettingsRow
              label="Terms & Conditions"
              onPress={openTerms}
              last
            />
          </SettingsCard>

          <SectionHeader title="DANGER ZONE" tone="danger" />
          <SettingsCard tone="danger">
            <SettingsRow
              label="Log Out"
              tone="danger"
              onPress={() => setOpenLogout(true)}
            />
            <SettingsRow
              label="Delete Account"
              tone="danger"
              onPress={() => setOpenDelete(true)}
              last
            />
          </SettingsCard>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View style={styles.backRow}>
              <Text style={styles.backRowText}>Back</Text>
            </View>
          </Pressable>
        </ScrollView>

        <EditUsernameModal
          open={openUsername}
          onClose={() => setOpenUsername(false)}
          initialUsername={data.username ?? ""}
          onSaved={async () => {
            await load();
          }}
        />

        <EditPersonalInfoModal
          open={openPersonal}
          onClose={() => setOpenPersonal(false)}
          initial={{
            name: data.name ?? null,
            height_cm: data.height_cm ?? null,
            weight_kg: data.weight_kg ?? null,
            date_of_birth: data.date_of_birth ?? null,
          }}
          onSaved={async () => {
            await load();
          }}
        />

        <ExperienceModal
          open={openExperience}
          onClose={() => setOpenExperience(false)}
          initialLevel={(data.experience_level as any) ?? null}
          onSaved={async () => {
            await load();
          }}
        />

        <PrimaryGoalModal
          open={openGoal}
          onClose={() => setOpenGoal(false)}
          initialGoal={data.primary_goal ?? null}
          onSaved={async () => {
            await load();
          }}
        />

        <ConfirmLogoutModal
          open={openLogout}
          onClose={() => setOpenLogout(false)}
          onLoggedOut={() => {
            router.replace("/");
          }}
        />

        <ConfirmDeleteAccountModal
          open={openDelete}
          onClose={() => setOpenDelete(false)}
        />
      </View>
    </SafeAreaView>
  );
}