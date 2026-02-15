import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateTextPostScreen() {
  const { colors, typography, layout } = useAppTheme();

  const [visibility, setVisibility] = useState<
    "public" | "followers" | "private"
  >("public");
  const [caption, setCaption] = useState(
    "Try this workout: Tests. Tap to copy it into your library."
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
        },
        sub: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
        },
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        pillRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        pillOn: {
          backgroundColor: colors.cardPressed,
          borderColor: colors.primary,
        },
        pillText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          padding: 12,
          color: colors.text,
          minHeight: 100,
          textAlignVertical: "top",
        },
        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        ghost: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        ghostText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout]
  );

  const goReview = () => {
    const draft = {
      post_type: "text",
      visibility,
      caption: caption.trim(),
      workout_history_id: null,
      exercise_id: null,
      // leave empty for normal text
      pr_snapshot: null,
    };

    router.push({
      pathname: "/features/social/create/review",
      params: { draft: JSON.stringify(draft) },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Text post</Text>
        <Text style={styles.sub}>
          We can later turn this into “share workout to try”.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sub}>Visibility</Text>
          <View style={styles.pillRow}>
            {(["public", "followers", "private"] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setVisibility(v)}
                style={[styles.pill, visibility === v && styles.pillOn]}
              >
                <Text style={styles.pillText}>{v}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sub}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write something…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />

          <Pressable style={styles.btn} onPress={goReview}>
            <Text style={styles.btnText}>Review</Text>
          </Pressable>

          <Pressable style={styles.ghost} onPress={() => router.back()}>
            <Text style={styles.ghostText}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
