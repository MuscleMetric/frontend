import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { Screen } from "@/ui";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreatePostScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          padding: layout.space.lg,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
          lineHeight: typography.lineHeight.h1,
        },
        subtitle: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },
        card: {
          marginTop: layout.space.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        btnText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        back: {
          marginTop: layout.space.lg,
          alignSelf: "flex-start",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        backText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Create post</Text>
        <Text style={styles.subtitle}>
          Basic UX first. We’ll style it later.
        </Text>

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.cardPressed : colors.bg },
            ]}
            onPress={() => router.push("/features/social/create/workout")}
          >
            <Text style={styles.btnText}>Share workout you completed</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.cardPressed : colors.bg },
            ]}
            onPress={() => router.push("/features/social/create/pr")}
          >
            <Text style={styles.btnText}>Share a PR</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? colors.cardPressed : colors.bg },
            ]}
            onPress={() => router.push("/features/social/create/text")}
          >
            <Text style={styles.btnText}>
              Text post / share a workout to try
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
