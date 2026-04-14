import { supabase } from "../../../../lib/supabase";

export type OnboardingStatus = {
  workouts_total: number;
  stage2_completed_at: string | null;
  stage2_dismissed_at: string | null;
  stage3_completed_at: string | null;
  stage3_dismissed_at: string | null;
};

/**
 * Fetches onboarding status from profiles and returns the normalized shape
 * expected by useOnboardingGate().
 */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
        weekly_workout_goal,
        onboarding_stage2_completed_at,
        onboarding_stage2_dismissed_at,
        onboarding_stage3_completed_at,
        onboarding_stage3_dismissed_at
      `
    )
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  const { count, error: countError } = await supabase
    .from("workout_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return null;
  }

  return {
    workouts_total: count ?? 0,
    stage2_completed_at: data.onboarding_stage2_completed_at ?? null,
    stage2_dismissed_at: data.onboarding_stage2_dismissed_at ?? null,
    stage3_completed_at: data.onboarding_stage3_completed_at ?? null,
    stage3_dismissed_at: data.onboarding_stage3_dismissed_at ?? null,
  };
}

/**
 * Until you add a dedicated RPC, we mark completion by updating columns on `profiles`.
 * Recommended columns (timestamptz):
 * - onboarding_stage2_completed_at
 * - onboarding_stage3_completed_at
 * - onboarding_stage2_dismissed_at
 * - onboarding_stage3_dismissed_at
 */
export async function markOnboardingStageComplete(stage: "stage2" | "stage3") {
  const patch =
    stage === "stage2"
      ? { onboarding_stage2_completed_at: new Date().toISOString() }
      : { onboarding_stage3_completed_at: new Date().toISOString() };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) throw error;
}

export async function markOnboardingStageDismissed(stage: "stage2" | "stage3") {
  const patch =
    stage === "stage2"
      ? { onboarding_stage2_dismissed_at: new Date().toISOString() }
      : { onboarding_stage3_dismissed_at: new Date().toISOString() };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) throw error;
}