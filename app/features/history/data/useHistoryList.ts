// app/features/history/data/useHistoryList.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { HistoryListItem, HistoryListPayload } from "./history.types";

type UseHistoryListArgs = {
  query?: string; // search workouts or exercises
  pageSize?: number; // default 20
};

export function useHistoryList({ query = "", pageSize = 20 }: UseHistoryListArgs) {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cursor pagination (matches RPC tuple ordering)
  const [cursorCompletedAt, setCursorCompletedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  const fetchPage = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        setError(null);

        const cursor =
          mode === "more"
            ? {
                p_cursor_completed_at: cursorCompletedAt,
                p_cursor_id: cursorId,
              }
            : {
                p_cursor_completed_at: null,
                p_cursor_id: null,
              };

        const { data, error } = await supabase.rpc("get_workout_history_feed", {
          p_limit: pageSize,
          ...cursor,
          p_query: normalizedQuery.length ? normalizedQuery : null,
        });

        if (error) throw error;

        const payload = data as HistoryListPayload;

        const nextItems = payload?.items ?? [];
        setTimezone(payload?.meta?.timezone ?? "UTC");

        if (mode === "more") {
          setItems((prev) => [...prev, ...nextItems]);
        } else {
          setItems(nextItems);
        }

        // update cursor from last item (for next page)
        const last = nextItems[nextItems.length - 1] ?? null;
        if (last) {
          setCursorCompletedAt(last.completed_at);
          setCursorId(last.workout_history_id);
        } else if (mode !== "more") {
          // cleared search/refresh -> no items
          setCursorCompletedAt(null);
          setCursorId(null);
        }

        // if we got fewer than pageSize we’re done
        setHasMore(nextItems.length >= pageSize);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load history.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursorCompletedAt, cursorId, normalizedQuery, pageSize]
  );

  // refetch when query changes
  useEffect(() => {
    fetchPage("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery]);

  const refresh = useCallback(() => fetchPage("refresh"), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!hasMore || loading || refreshing) return;
    fetchPage("more");
  }, [fetchPage, hasMore, loading, refreshing]);

  return {
    items,
    timezone,
    loading,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
