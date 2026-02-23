// app/features/social/create/success/PostSuccessPreviewCard.tsx

import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

import type {
  PostType,
  WorkoutSelection,
  WorkoutPostDraft,
  PrSelection,
  PrPostDraft,
} from "../state/createPostTypes";

import WorkoutPostPreviewCard from "../editWorkoutPost/WorkoutPostPreviewCard";
import PrPostPreviewCard from "../editPrPost/PrPostPreviewCard";

type Props = {
  postType: PostType | null;

  workout: WorkoutSelection | null;
  workoutDraft: WorkoutPostDraft;

  pr: PrSelection | null;
  prDraft: PrPostDraft;
};

export default function PostSuccessPreviewCard({
  postType,
  workout,
  workoutDraft,
  pr,
  prDraft,
}: Props) {
  const { colors } = useAppTheme();

  if (postType === "workout" && workout) {
    return (
      <WorkoutPostPreviewCard
        workout={workout}
        caption={workoutDraft.caption}
        templateId={workoutDraft.templateId}
      />
    );
  }

  if (postType === "pr" && pr) {
    return (
      <PrPostPreviewCard
        pr={pr}
        caption={prDraft.caption}
      />
    );
  }

  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 200,
    borderRadius: 20,
    borderWidth: 1,
  },
});