// app/features/workouts/data/useWorkoutsTab.ts

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WorkoutsTabPayload } from "../types/workoutsTab";

type UseWorkoutsTabResult = {
  loading: boolean;
  error: string | null;
  data: WorkoutsTabPayload | null;
  refetch: () => Promise<void>;
};

export function useWorkoutsTab(userId: string | null): UseWorkoutsTabResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkoutsTabPayload | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: payload, error: rpcError } = await supabase.rpc(
        "get_workouts_tab_payload"
      );

      if (rpcError) throw rpcError;

      setData((payload ?? null) as WorkoutsTabPayload | null);
    } catch (e: any) {
      setData(null);
      setError(e?.message ?? "Failed to load workouts.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { loading, error, data, refetch };
}
