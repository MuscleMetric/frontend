// app/features/history/utils/history.mock.ts

import type { HistoryListPayload } from "../data/history.types";

export const MOCK_HISTORY: HistoryListPayload = {
  meta: { timezone: "UTC", unit: "kg" },
  items: [
    {
      workout_history_id: "mock-1",
      workout_id: "w-1",
      title: "Push Day - Hypertrophy",
      completed_at: new Date().toISOString(),
      duration_seconds: 52 * 60,
      volume_kg: 14250,
      sets_count: 24,
      pr_count: 2,
      insight: { metric: "volume", trend: "up", delta_pct: 5.0, label: "Lifted 5% more than last time" },
      top_items: [
        { exercise_id: "e1", exercise_name: "Bench Press", summary: "3 × 8" },
        { exercise_id: "e2", exercise_name: "OHP", summary: "3 × 6" },
        { exercise_id: "e3", exercise_name: "Lateral Raise", summary: "3 × 12" },
        { exercise_id: "e4", exercise_name: "Tricep Pushdown", summary: "3 × 10" },
      ],
    },
  ],
};
