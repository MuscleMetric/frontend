import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { FeedbackSubmission } from "../types";

const FEEDBACK_TABLE = "app_feedback";

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getDiagnostics() {
  return {
    app_version: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
    os_version: Device.osVersion ?? String(Platform.Version ?? ""),
    device_model: Device.modelName ?? null,
  };
}

export async function submitFeedback(input: FeedbackSubmission): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in to submit feedback.");

  const diagnostics = getDiagnostics();

  const { error } = await supabase.from(FEEDBACK_TABLE).insert({
    user_id: user.id,
    feedback_type: input.type,
    source_screen: clean(input.sourceScreen),
    category: clean(input.category),
    message: clean(input.message),
    additional_context: clean(input.additionalContext),
    impact: input.impact ?? null,
    rating: input.rating ?? null,
    rating_tags: input.ratingTags ?? [],
    ...diagnostics,
    metadata: {},
  });

  if (error) throw error;
}
