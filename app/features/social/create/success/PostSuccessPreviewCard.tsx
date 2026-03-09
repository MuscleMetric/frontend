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
import { useAuth } from "@/lib/authContext";

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
  const { profile } = useAuth();

  const viewerName = profile?.name?.trim() ? profile.name : "You";
  const viewerUsername = (profile as any)?.username ?? null;

  if (postType === "workout" && workout) {
    return (
      <WorkoutPostPreviewCard
        workout={workout}
        caption={workoutDraft.caption}
        viewerName={viewerName}
        viewerUsername={viewerUsername}
      />
    );
  }

  if (postType === "pr" && pr) {
    return <PrPostPreviewCard pr={pr} caption={prDraft.caption} />;
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
