// app/features/social/create/navigation.ts

import type { CreatePostStep, PostType } from "./state/createPostTypes";

/**
 * We keep navigation decoupled from Expo Router / React Navigation.
 * This returns a "next step" key your parent can route however it wants.
 *
 * Screens (matches the designs you showed):
 * - sheet
 * - select_workout
 * - edit_workout
 * - edit_pr
 * - success
 */
export const CREATE_POST_STEPS: CreatePostStep[] = [
  "sheet",
  "select_workout",
  "edit_workout",
  "select_pr_exercise",
  "select_pr_event",
  "edit_pr",
  "success",
];

export function nextStepForPostType(postType: PostType): CreatePostStep {
  if (postType === "workout") return "select_workout";
  if (postType === "pr") return "select_pr_exercise";
  return "edit_pr";
}

/**
 * If you want a single place to decide what "Back" should do per step,
 * keep it here (so screens stay dumb).
 */
export function backStep(current: CreatePostStep): CreatePostStep {
  switch (current) {
    case "select_workout":
      return "sheet";
    case "edit_workout":
      return "select_workout";
    case "edit_pr":
      return "sheet";
    case "success":
      return "sheet";
    default:
      return "sheet";
  }
}