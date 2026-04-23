import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WorkoutsTabPayload } from "../types/workoutsTab";

type UseWorkoutsTabResult = {
  loading: boolean;
  error: string | null;
  data: WorkoutsTabPayload | null;
  refetch: () => Promise<void>;
};

function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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
      const result = await withTimeout(
        supabase.rpc("get_workouts_tab_payload"),
        15000,
        "get_workouts_tab_payload",
      );

      if (result.error) throw result.error;

      setData((result.data ?? null) as WorkoutsTabPayload | null);
    } catch (e: any) {
      setData(null);
      setError(e?.message ?? "Failed to load workouts.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const timer = setTimeout(() => {
      void refetch();
    }, 750);

    return () => clearTimeout(timer);
  }, [userId, refetch]);

  return { loading, error, data, refetch };
}
