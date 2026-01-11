// app/features/profile/data/useProfileOverview.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import type { ProfileOverview } from "./profileTypes";

type State = {
  data: ProfileOverview | null;
  loading: boolean;
  error: string | null;
};

export function useProfileOverview() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchOnce = useCallback(async () => {
    if (!userId) {
      setState({ data: null, loading: false, error: "AUTH_REQUIRED" });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase.rpc("get_profile_overview");
    if (error) {
      setState({ data: null, loading: false, error: error.message });
      return;
    }

    console.log("profile overview rpc raw:", JSON.stringify(data, null, 2));

    setState({ data: (data as any) ?? null, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  return {
    userId,
    ...state,
    refetch: fetchOnce,
  };
}
