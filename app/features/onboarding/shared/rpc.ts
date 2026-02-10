import { supabase } from "../../../../lib/supabase";
import type { OnboardingStatusRow } from "./types";

/**
 * NOTE:
 * Replace this with your real RPC(s).
 * For now this is a typed placeholder that won’t break builds.
 */
export async function fetchOnboardingStatus(): Promise<OnboardingStatusRow | null> {
  // Example shape. When you add the RPC, do:
  // const { data, error } = await supabase.rpc("get_post_onboarding_status_v1").single();
  // if (error) throw error;
  // return data;

  // Temporary: try to read from profiles until RPC exists
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      onboarding_stage2_completed_at,
      onboarding_stage2_dismissed_at,
      onboarding_stage3_completed_at,
      onboarding_stage3_dismissed_at
    `
    )
    .single();

  if (error) return null;

  return {
    stage2_completed_at: (data as any).onboarding_stage2_completed_at ?? null,
    stage2_dismissed_at: (data as any).onboarding_stage2_dismissed_at ?? null,
    stage3_completed_at: (data as any).onboarding_stage3_completed_at ?? null,
    stage3_dismissed_at: (data as any).onboarding_stage3_dismissed_at ?? null,
    workouts_total: 0, // you’ll replace with real count source
  };
}
