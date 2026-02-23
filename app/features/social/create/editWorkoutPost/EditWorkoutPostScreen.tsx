// app/features/social/create/editWorkoutPost/EditWorkoutPostScreen.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import type { WorkoutSelection, WorkoutPostDraft } from "../state/createPostTypes";
import AudiencePill from "../shared/AudiencePill";
import PrimaryActionButton from "../shared/PrimaryActionButton";
import WorkoutPostPreviewCard from "./WorkoutPostPreviewCard";
import WorkoutPostTemplatePicker from "./WorkoutPostTemplatePicker";
import WorkoutCaptionBox from "./WorkoutCaptionBox";

type Props = {
  workout: WorkoutSelection | null;

  draft: WorkoutPostDraft;

  onBack: () => void;

  onChangeAudience: (audience: WorkoutPostDraft["audience"]) => void;
  onChangeTemplate: (templateId: WorkoutPostDraft["templateId"]) => void;
  onChangeCaption: (caption: string) => void;

  onPost: () => void;
  posting?: boolean;
};

export default function EditWorkoutPostScreen(props: Props) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

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
          marginTop: 8,
          alignItems: "flex-start",
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
      }),
    [colors, typography, insets.top, insets.bottom]
  );

  if (!props.workout) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={props.onBack} activeOpacity={0.85}>
              <Icon name={"chevron-left" as any} size={18} color={colors.text} />
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
          <Text style={styles.errorSub}>Go back and choose a completed session to share.</Text>
        </View>
      </View>
    );
  }

  const canPost = !props.posting;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={props.onBack} activeOpacity={0.85}>
            <Icon name={"chevron-left" as any} size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>Edit Post</Text>
            <Text style={styles.subtitle}>Share your session with your community</Text>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <WorkoutPostPreviewCard
          workout={props.workout}
          caption={props.draft.caption}
          templateId={props.draft.templateId}
        />

        <Text style={styles.sectionLabel}>Audience</Text>
        <View style={styles.audienceRow}>
          <AudiencePill value={props.draft.audience} onChange={props.onChangeAudience} />
        </View>

        <WorkoutPostTemplatePicker value={props.draft.templateId} onChange={props.onChangeTemplate} />

        <WorkoutCaptionBox value={props.draft.caption} onChange={props.onChangeCaption} />
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