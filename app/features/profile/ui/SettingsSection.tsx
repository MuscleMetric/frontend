import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ListRow, Button, Icon, Pill } from "@/ui";
import { supabase } from "@/lib/supabase";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsSection() {
  const { colors, typography, layout } = useAppTheme();
  const [open, setOpen] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerPress: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 2,
        },
        headerLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.sm,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        listGap: { gap: layout.space.sm, marginTop: layout.space.md },

        logoutRow: {
          marginTop: layout.space.md,
          paddingTop: layout.space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        logoutHint: {
          flex: 1,
          marginRight: layout.space.md,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        // small, low-emphasis logout
        logoutBtn: {
          alignSelf: "flex-start",
          paddingHorizontal: layout.space.md,
          paddingVertical: layout.space.sm,
          borderRadius: layout.radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: "transparent",
        },
        logoutText: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.danger,
        },
      }),
    [colors, typography, layout]
  );

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <Card>
      <Pressable onPress={toggle} style={styles.headerPress}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Settings</Text>
          <Pill tone="neutral" label={open ? "Open" : "Closed"} />
        </View>

        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {open ? (
        <>
          <View style={styles.listGap}>
            <ListRow
              title="Personal Information"
              subtitle="Edit your details and preferences"
              onPress={() => router.push("/features/profile/settings/EditProfile")}
            />

            <ListRow
              title="Notifications"
              subtitle="Workout reminders and updates"
              onPress={() =>
                router.push("/features/profile/settings/notifications")
              }
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

          <View style={styles.logoutRow}>
            <Text style={styles.logoutHint}>
              Logging out will require you to sign in again.
            </Text>

            <Pressable onPress={onLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </Card>
  );
}
