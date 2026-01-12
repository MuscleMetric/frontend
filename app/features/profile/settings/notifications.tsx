// app/features/profile/settings/notifications.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch, ScrollView, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, Pill, ScreenHeader } from "@/ui";

type NotifSettings = {
  notif_workout_reminders?: boolean;
  notif_plan_weekly?: boolean;
  notif_social?: boolean;
};

const DEFAULTS: Required<NotifSettings> = {
  notif_workout_reminders: true,
  notif_plan_weekly: true,
  notif_social: true,
};

export default function NotificationsSettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles({ colors, typography, layout }), [colors, typography, layout]);

  const [loading, setLoading] = useState(true);
  const [settingsRaw, setSettingsRaw] = useState<any>({});
  const [toggles, setToggles] = useState<Required<NotifSettings>>(DEFAULTS);
  const [savingKey, setSavingKey] = useState<keyof NotifSettings | null>(null);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .single();

      if (error) console.warn("Notifications settings load error", error);

      const s = data?.settings ?? {};
      setSettingsRaw(s);

      setToggles({
        notif_workout_reminders: typeof s.notif_workout_reminders === "boolean" ? s.notif_workout_reminders : DEFAULTS.notif_workout_reminders,
        notif_plan_weekly: typeof s.notif_plan_weekly === "boolean" ? s.notif_plan_weekly : DEFAULTS.notif_plan_weekly,
        notif_social: typeof s.notif_social === "boolean" ? s.notif_social : DEFAULTS.notif_social,
      });

      setLoading(false);
    })();
  }, [userId]);

  async function saveToggle(key: keyof NotifSettings, value: boolean) {
    if (!userId) return;

    // optimistic
    setToggles((prev) => ({ ...prev, [key]: value }));
    setSavingKey(key);

    try {
      const next = { ...(settingsRaw ?? {}), [key]: value };
      setSettingsRaw(next);

      const { error } = await supabase.from("profiles").update({ settings: next }).eq("id", userId);
      if (error) throw error;
    } catch (e) {
      console.warn("Notifications toggle save error", e);
      // rollback
      setToggles((prev) => ({ ...prev, [key]: !value }));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <ScreenHeader title="Notifications" />
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScreenHeader title="Notifications" />

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Pill tone="neutral" label="Auto-saved" />
          </View>

          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.rowTitle}>Workout reminders</Text>
              <Text style={styles.rowSub}>Nudges to keep your training consistent.</Text>
            </View>
            <Switch
              value={toggles.notif_workout_reminders}
              onValueChange={(v) => saveToggle("notif_workout_reminders", v)}
              trackColor={{ false: colors.trackBg, true: colors.trackBorder }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.rowTitle}>Plan check-ins</Text>
              <Text style={styles.rowSub}>Weekly progress reminders when you’re on a plan.</Text>
            </View>
            <Switch
              value={toggles.notif_plan_weekly}
              onValueChange={(v) => saveToggle("notif_plan_weekly", v)}
              trackColor={{ false: colors.trackBg, true: colors.trackBorder }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.rowTitle}>Social updates</Text>
              <Text style={styles.rowSub}>Likes, comments, follows (when enabled).</Text>
            </View>
            <Switch
              value={toggles.notif_social}
              onValueChange={(v) => saveToggle("notif_social", v)}
              trackColor={{ false: colors.trackBg, true: colors.trackBorder }}
              thumbColor={colors.surface}
            />
          </View>

          {savingKey ? (
            <View style={styles.savingRow}>
              <Pill tone="neutral" label="Saving…" />
              <Text style={styles.savingText}>
                {String(savingKey).replace(/notif_|_/g, " ").trim()}
              </Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>System settings</Text>
          <Text style={styles.helperText}>
            If notifications are blocked at OS level, enable them in your phone settings.
          </Text>

          <View style={styles.btnRow}>
            <Button variant="secondary" title="Open system settings" onPress={() => Linking.openSettings()} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles({ colors, typography, layout }: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: {
      padding: layout.space.lg,
      paddingBottom: layout.space.xxl,
      gap: layout.space.md,
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.md,
      marginBottom: layout.space.sm,
    },
    sectionTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.md,
      paddingVertical: layout.space.sm,
    },
    left: { flex: 1, gap: 4 },
    rowTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
    rowSub: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      opacity: 0.9,
    },

    savingRow: {
      marginTop: layout.space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
    },
    savingText: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    helperText: {
      marginTop: layout.space.sm,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    btnRow: { marginTop: layout.space.md },
  });
}
