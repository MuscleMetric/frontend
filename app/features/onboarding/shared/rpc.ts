import { supabase } from "../../../../lib/supabase";

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

  // if columns are missing, this will error — we swallow it to avoid blocking navigation
  const { error } = await supabase.from("profiles").update(patch).eq("id", (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}

export async function markOnboardingStageDismissed(stage: "stage2" | "stage3") {
  const patch =
    stage === "stage2"
      ? { onboarding_stage2_dismissed_at: new Date().toISOString() }
      : { onboarding_stage3_dismissed_at: new Date().toISOString() };

  const { error } = await supabase.from("profiles").update(patch).eq("id", (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}
