import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export function useHomeSummary(userId: string | null, monthOffset: number = 0) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc("get_home_summary", {
      p_month_offset: monthOffset,
    });

    if (error) {
      setError(error.message);
      setSummary(null);
      setLoading(false);
      return;
    }

    setSummary(data);
    setLoading(false);
  }, [userId, monthOffset]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}
