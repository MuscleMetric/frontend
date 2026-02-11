// app/onboarding/stage3_five_workouts/types.ts

export type Stage3RpcPoint = {
  x: number;
  y: number;
  label?: string | null;
};

export type Stage3RpcScheduleItem = {
  dow: string; // "Mon"
  kind: "session" | "rest";
};

export type Stage3Payload = {
  // user / prefs
  user_name: string | null;
  unit_weight: string | null;
  timezone: string | null;

  // milestone context
  workouts_completed_total: number | null;
  window_start: string | null; // timestamptz
  window_end: string | null; // timestamptz
  window_days: number | null;

  // hero stats
  strength_change_pct: number | null;
  total_volume: number | null;

  // spotlight
  spotlight_exercise_id: string | null;
  spotlight_exercise_name: string | null;
  spotlight_current_1rm: number | null;
  spotlight_change_pct: number | null;
  spotlight_series: Stage3RpcPoint[] | null;

  // consistency
  weekly_goal_target: number | null;
  weekly_completed: number | null;
  streak_weeks: number | null;
  consistency_change_pct: number | null;

  // plan recommendation
  recommended_days_per_week: number | null;
  recommended_split_key: string | null;
  recommended_split_label: string | null;
  recommended_schedule: Stage3RpcScheduleItem[] | null;

  // milestone preview
  milestone_exercise_id: string | null;
  milestone_exercise_name: string | null;
  milestone_current_value: number | null;
  milestone_target_value: number | null;
  milestone_progress_pct: number | null;
  milestone_on_track: boolean | null;
  milestone_eta_weeks: number | null;
};

export type Stage3UiStrings = {
  greetingName: string; // e.g. "Harry" or "there"
  unitWeight: "kg" | "lb" | string;

  workoutsTotalLabel: string; // "5"
  windowLabel: string; // "in 14 days" | "recently"

  heroStatLabel: string; // "+15%" or "38,420"
  heroStatKicker: string; // "EST. STRENGTH" | "TOTAL VOLUME"
  heroStatSub: string; // "Bench Press 1RM estimate" etc.

  spotlightTitle: string; // "Bench Press"
  spotlightValueLabel: string; // "245 lb"
  spotlightChangeLabel: string; // "+15%"
  spotlightSeries: Stage3RpcPoint[];

  weeklyProgressLabel: string; // "2 / 3"
  weeklyPct: number; // 0..1

  streakLabel: string; // "3 weeks in a row"
  consistencyChangeLabel: string | null; // "+12% vs last month"

  recoTitle: string; // "Push / Pull / Legs"
  recoSubtitle: string; // "3 days/week"
  recoSchedule: Stage3RpcScheduleItem[];

  milestoneTitle: string; // exercise name
  milestoneProgressLabel: string; // "75%"
  milestoneCurrentLabel: string; // "105 kg"
  milestoneTargetLabel: string; // "140 kg"
  milestoneStatusLabel: string; // "ON TRACK" / "BUILDING"
};

export type Stage3DataState = {
  loading: boolean;
  error: string | null;
  payload: Stage3Payload | null;
  ui: Stage3UiStrings | null;
};
