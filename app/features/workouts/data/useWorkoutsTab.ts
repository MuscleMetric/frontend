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
    console.log("[useWorkoutsTab] refetch start", { userId });

    if (!userId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startedAt = Date.now();

      const result = await withTimeout(
        supabase.rpc("get_workouts_tab_payload"),
        15000,
        "get_workouts_tab_payload",
      );

      console.log("[useWorkoutsTab] rpc finished", {
        elapsed: Date.now() - startedAt,
        data: result.data,
        error: result.error,
      });

      if (result.error) throw result.error;

      setData((result.data ?? null) as WorkoutsTabPayload | null);
    } catch (e: any) {
      console.warn("[useWorkoutsTab] error", e);
      setData(null);
      setError(e?.message ?? "Failed to load workouts.");
    } finally {
      console.log("[useWorkoutsTab] finally -> setLoading(false)");
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
