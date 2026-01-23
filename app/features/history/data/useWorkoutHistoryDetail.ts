// app/features/history/data/useWorkoutHistoryDetail.ts

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WorkoutHistoryDetailPayload } from "./history.types";

export function useWorkoutHistoryDetail(workoutHistoryId?: string | null) {
  const [data, setData] = useState<WorkoutHistoryDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!workoutHistoryId) {
        setData(null);
        setLoading(false);
        setError("Missing workoutHistoryId");
        return;
      }

      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        setError(null);

        const { data, error } = await supabase.rpc("get_workout_history_detail", {
          p_workout_history_id: workoutHistoryId,
        });

        if (error) throw error;

        setData(data as WorkoutHistoryDetailPayload);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load workout.");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workoutHistoryId]
  );

  useEffect(() => {
    fetchDetail("initial");
  }, [fetchDetail]);

  const refresh = useCallback(() => fetchDetail("refresh"), [fetchDetail]);

  return { data, loading, refreshing, error, refresh };
}
