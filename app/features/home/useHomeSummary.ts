// app/features/home/useHomeSummary.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export function useHomeSummary(userId: string | null) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      setLoading(false);
      setError("Not logged in.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ IMPORTANT: always fetch "this month" only
      const { data, error } = await supabase.rpc("get_home_summary", {
        p_month_offset: 0,
      });

      if (error) throw error;
      setSummary(data ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load home");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary, loading, error, refetch };
}
