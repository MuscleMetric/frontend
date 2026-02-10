export type OnboardingStage = "stage2_first_workout" | "stage3_five_workouts";

export type OnboardingGateDecision = {
  should_show: boolean;
  stage: OnboardingStage | null;
  reason:
    | "not_authenticated"
    | "already_completed"
    | "already_dismissed"
    | "eligible"
    | "unknown";
};

export type OnboardingStatusRow = {
  // completion flags (you’ll implement in DB; keep nullable)
  stage2_completed_at: string | null;
  stage2_dismissed_at: string | null;

  stage3_completed_at: string | null;
  stage3_dismissed_at: string | null;

  // user metrics needed for eligibility
  workouts_total: number;
};
