import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

type PostDraft = {
  post_type: "workout" | "pr" | "text";
  visibility: "public" | "followers" | "private";
  caption: string;
  workout_history_id?: string | null;
  exercise_id?: string | null;
  pr_snapshot?: any | null;
};

export default function ReviewPostScreen() {
  const { colors, typography, layout } = useAppTheme();
  const params = useLocalSearchParams<{ draft?: string }>();

  const draft: PostDraft | null = useMemo(() => {
    try {
      if (!params.draft) return null;
      return JSON.parse(String(params.draft));
    } catch {
      return null;
    }
  }, [params.draft]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        json: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          padding: 12,
        },
        jsonText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: 11,
          lineHeight: 15,
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
        error: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
        },
      }),
    [colors, typography, layout]
  );

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    setErr(null);

    const args = {
      p_post_type: draft.post_type,
      p_visibility: draft.visibility,
      p_caption: draft.caption,
      p_workout_history_id: draft.workout_history_id ?? null,
      p_exercise_id: draft.exercise_id ?? null,
      p_pr_snapshot: draft.pr_snapshot ?? null,
    };

    const res = await supabase.rpc("create_post_v1", args);

    if (res.error) {
      console.log("create_post_v1 error:", res.error);
      setErr(res.error.message ?? "Failed to save post");
      setSaving(false);
      return;
    }

    // Optional: if your RPC returns uuid, res.data is that id
    // const newPostId = res.data;

    router.replace("/(tabs)/social");
  };

  if (!draft) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Review</Text>
        <Text style={styles.error}>Invalid draft payload.</Text>
        <Pressable style={styles.ghost} onPress={() => router.back()}>
          <Text style={styles.ghostText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Review</Text>
        <Text style={styles.sub}>If this looks right, save it.</Text>

        <View style={styles.card}>
          <Text style={styles.sub}>
            Type: {draft.post_type} • Visibility: {draft.visibility}
          </Text>

          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.regular,
              fontSize: typography.size.body,
            }}
          >
            {draft.caption}
          </Text>

          <View style={styles.json}>
            <Text style={styles.jsonText}>
              {JSON.stringify(draft, null, 2)}
            </Text>
          </View>

          {err ? <Text style={styles.error}>{err}</Text> : null}

          <Pressable
            style={[styles.btn, { opacity: saving ? 0.7 : 1 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.btnText}>Save post</Text>
            )}
          </Pressable>

          <Pressable style={styles.ghost} onPress={() => router.back()}>
            <Text style={styles.ghostText}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
