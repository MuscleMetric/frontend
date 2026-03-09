// app/features/social/create/editWorkoutPost/EditWorkoutPostScreen.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";
import { useAuth } from "@/lib/authContext";

import type { WorkoutSelection, WorkoutPostDraft } from "../state/createPostTypes";
import AudiencePill from "../shared/AudiencePill";
import PrimaryActionButton from "../shared/PrimaryActionButton";
import WorkoutPostPreviewCard from "./WorkoutPostPreviewCard";
import WorkoutCaptionBox from "./WorkoutCaptionBox";

type WorkoutDetail = {
  workout_history_id: string;
  workout_id: string | null;
  title: string;
  completed_at: string;
  duration_seconds: number | null;
  volume_kg: number;
  sets_count: number;
  workout_image_key?: string | null; // ✅ if/when RPC includes it
  exercises: Array<{
    workout_exercise_history_id: string;
    exercise_id: string;
    exercise_name: string;
    order_index: number;
    sets: Array<{
      set_number: number | null;
      weight: number | null;
      reps: number | null;
    }>;
  }>;
};

type Props = {
  workout: WorkoutSelection | null;

  // ✅ from get_workout_for_post_v1 (loaded on Next in selector)
  workoutDetail: WorkoutDetail | null;

  draft: WorkoutPostDraft;

  onBack: () => void;

  onChangeAudience: (audience: WorkoutPostDraft["audience"]) => void;
  onChangeCaption: (caption: string) => void;

  onPost: () => void;
  posting?: boolean;
};

export default function EditWorkoutPostScreen(props: Props) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth(); // ✅ get viewer name/username from auth context

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top + 8,
        },
        header: {
          paddingHorizontal: 16,
          marginBottom: 10,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        backBtn: {
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        titleWrap: { flex: 1, marginLeft: 12 },
        title: {
          fontSize: typography.size.h2,
          fontWeight: "900",
          color: colors.text,
        },
        subtitle: {
          marginTop: 2,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        content: {
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        sectionLabel: {
          marginTop: 14,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
        },
        audienceRow: {
          marginVertical: 8,
          alignItems: "center",
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 12),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        },
        errorCard: {
          marginHorizontal: 16,
          marginTop: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        errorTitle: {
          fontSize: typography.size.body,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 4,
        },
        errorSub: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
        },

        detailsCard: {
          marginTop: 14,
          borderRadius: 18,
          padding: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        detailsTitle: {
          fontSize: typography.size.body,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 10,
        },
        exRow: {
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        exName: {
          fontSize: typography.size.body,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 6,
        },
        setsLine: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
      }),
    [colors, typography, insets.top, insets.bottom]
  );

  if (!props.workout) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={props.onBack}
              activeOpacity={0.85}
            >
              <Icon name={"chevron-back" as any} size={18} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Create Post</Text>
              <Text style={styles.subtitle}>Workout</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </View>

        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No workout selected</Text>
          <Text style={styles.errorSub}>
            Go back and choose a completed session to share.
          </Text>
        </View>
      </View>
    );
  }

  // If we somehow got here without the detail payload, show a graceful loading state.
  if (!props.workoutDetail) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={props.onBack}
              activeOpacity={0.85}
            >
              <Icon name={"chevron-back" as any} size={18} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text style={styles.title}>Edit Post</Text>
              <Text style={styles.subtitle}>Loading workout details…</Text>
            </View>

            <View style={{ width: 42 }} />
          </View>
        </View>

        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Loading</Text>
          <Text style={styles.errorSub}>
            Fetching exercises and sets for this session.
          </Text>
        </View>
      </View>
    );
  }

  const canPost = !props.posting;

  const exerciseLines = props.workoutDetail.exercises.map((ex) => {
    const parts = (ex.sets ?? [])
      .filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0)
      .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
      .map((s) => `${s.weight}×${s.reps}`);

    return {
      key: ex.workout_exercise_history_id,
      name: ex.exercise_name,
      line: parts.join(", ") || "—",
    };
  });

  const viewerName = profile?.name?.trim() ? profile.name : "You";
  const viewerUsername = (profile as any)?.username ?? null; // ✅ after authContext adds username

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={props.onBack}
            activeOpacity={0.85}
          >
            <Icon name={"chevron-back" as any} size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>Edit Post</Text>
            <Text style={styles.subtitle}>Share your session with your community</Text>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Audience</Text>
        <View style={styles.audienceRow}>
          <AudiencePill
            value={props.draft.audience}
            onChange={props.onChangeAudience}
          />
        </View>

        <WorkoutPostPreviewCard
          workout={props.workout}
          caption={props.draft.caption}
          viewerName={viewerName}
          viewerUsername={viewerUsername}
        />

        <WorkoutCaptionBox
          value={props.draft.caption}
          onChange={props.onChangeCaption}
        />

        {/* ✅ Full sets preview (from get_workout_for_post_v1) */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Workout details</Text>

          {exerciseLines.map((ex, idx) => (
            <View
              key={ex.key}
              style={[styles.exRow, idx === 0 && { borderTopWidth: 0 }]}
            >
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.setsLine}>{ex.line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryActionButton
          label="Post to Social"
          onPress={props.onPost}
          disabled={!canPost}
          loading={props.posting}
        />
      </View>
    </View>
  );
}