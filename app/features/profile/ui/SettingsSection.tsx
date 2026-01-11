import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ListRow, Button } from "@/ui";
import { supabase } from "@/lib/supabase";

export default function SettingsSection() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
          marginBottom: layout.space.sm,
        },
        listGap: { gap: layout.space.sm },
        logoutWrap: { marginTop: layout.space.md },
      }),
    [colors, typography, layout]
  );

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <Card>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.listGap}>
        <ListRow
          title="Personal Information"
          subtitle="Edit your details and preferences"
          onPress={() => router.push("/features/profile/settings/EditProfile")}
        />
        <ListRow
          title="Notifications"
          subtitle="Workout reminders and updates"
          onPress={() => router.push("/features/profile/settings/QuickUpdateModal")}
        />
        <ListRow
          title="Help & Support"
          subtitle="Get help or contact us"
          onPress={() => router.push("/features/profile/settings/support")}
        />
        <ListRow
          title="Privacy Policy"
          subtitle="How we handle your data"
          onPress={() => router.push("/features/profile/settings/privacy")}
        />
        <ListRow
          title="Terms & Conditions"
          subtitle="The rules of the platform"
          onPress={() => router.push("/features/profile/settings/terms")}
        />
      </View>

      <View style={styles.logoutWrap}>
        <Button variant="destructive" tone="danger" title="Log out" onPress={onLogout} />
      </View>
    </Card>
  );
}
