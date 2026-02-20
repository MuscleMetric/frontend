// app/features/social/SocialScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "../../../lib/supabase";

// ✅ NEW feed module
import { FeedList } from "./feed/FeedList";
import type { FeedRow } from "./feed/types";

import { PostModal } from "./feed/modals/PostModal";
import type { CommentRow, WorkoutDetailsPayload } from "./feed/modals/types";

export default function SocialScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },

        // If you already have your header elsewhere, keep this minimal
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
          lineHeight: typography.lineHeight.h1,
        },
        subtitle: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
        errorText: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          textAlign: "center",
        },
        hintText: {
          marginTop: 10,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  const PAGE_SIZE = 20;

  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // cursor (seek pagination)
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  // prevent double fetch on mount (StrictMode)
  const didInitialFetch = useRef(false);

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedRow | null>(null);

  const openComments = useCallback((post: FeedRow) => {
    setSelectedPost(post);
    setPostModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setPostModalOpen(false);
    setSelectedPost(null);
  }, []);

  const fetchComments = useCallback(
    async (postId: string): Promise<CommentRow[]> => {
      const res = await supabase.rpc("get_post_comments", {
        p_post_id: postId,
        p_limit: 50,
      });
      if (res.error) throw res.error;
      return (res.data ?? []) as CommentRow[];
    },
    []
  );

  const bumpCommentCount = useCallback((postId: string, delta: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.post_id !== postId
          ? r
          : { ...r, comment_count: Math.max(0, (r.comment_count ?? 0) + delta) }
      )
    );

    setSelectedPost((prev) =>
      !prev || prev.post_id !== postId
        ? prev
        : {
            ...prev,
            comment_count: Math.max(0, (prev.comment_count ?? 0) + delta),
          }
    );
  }, []);

  const addComment = useCallback(
    async (postId: string, body: string) => {
      const res = await supabase.rpc("add_post_comment", {
        p_post_id: postId,
        p_body: body,
      });

      if (res.error) throw res.error;

      // ✅ update counts locally (no refetch)
      bumpCommentCount(postId, +1);
    },
    [bumpCommentCount]
  );

  const fetchWorkoutDetails = useCallback(
    async (_postId: string): Promise<WorkoutDetailsPayload | null> => {
      return null;
    },
    []
  );

  const applyCursorFrom = useCallback(
    (
      data: FeedRow[],
      fallbackCreatedAt: string | null,
      fallbackId: string | null
    ) => {
      const last = data[data.length - 1];
      setCursorCreatedAt(last?.created_at ?? fallbackCreatedAt);
      setCursorId(last?.post_id ?? fallbackId);
    },
    []
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await supabase.rpc("get_feed", { p_limit: PAGE_SIZE });

      if (res.error) {
        console.log("get_feed error:", res.error);
        setErrorMsg(res.error.message ?? "Failed to load feed");
        setRows([]);
        setCursorCreatedAt(null);
        setCursorId(null);
        return;
      }

      const data = (res.data ?? []) as FeedRow[];
      setRows(data);

      // set cursor for pagination
      applyCursorFrom(data, null, null);
    } catch (e: any) {
      console.log("get_feed exception:", e);
      setErrorMsg(e?.message ?? "Failed to load feed");
      setRows([]);
      setCursorCreatedAt(null);
      setCursorId(null);
    } finally {
      setLoading(false);
    }
  }, [applyCursorFrom]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (!cursorCreatedAt || !cursorId) return;

    setLoadingMore(true);
    setErrorMsg(null);

    try {
      const res = await supabase.rpc("get_feed", {
        p_limit: PAGE_SIZE,
        p_cursor_created_at: cursorCreatedAt,
        p_cursor_id: cursorId,
      });

      if (res.error) {
        console.log("get_feed more error:", res.error);
        setErrorMsg(res.error.message ?? "Failed to load more");
        return;
      }

      const data = (res.data ?? []) as FeedRow[];
      if (!data.length) return;

      setRows((prev) => {
        const existing = new Set(prev.map((r) => r.post_id));
        const next = data.filter((r) => !existing.has(r.post_id));
        return [...prev, ...next];
      });

      applyCursorFrom(data, cursorCreatedAt, cursorId);
    } catch (e: any) {
      console.log("get_feed more exception:", e);
      setErrorMsg(e?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [cursorCreatedAt, cursorId, loadingMore, applyCursorFrom]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    loadInitial();
  }, [loadInitial]);

  const toggleLike = useCallback(
    async (postId: string) => {
      // 1) optimistic update
      let prevLiked = false;
      setRows((prev) =>
        prev.map((r) => {
          if (r.post_id !== postId) return r;
          prevLiked = r.viewer_liked;
          const nextLiked = !r.viewer_liked;
          return {
            ...r,
            viewer_liked: nextLiked,
            like_count: Math.max(0, r.like_count + (nextLiked ? 1 : -1)),
          };
        })
      );

      // 2) server toggle + reconcile
      const res = await supabase.rpc("toggle_post_like", { p_post_id: postId });

      if (res.error) {
        console.log("toggle_post_like error:", res.error);

        // revert on failure
        setRows((prev) =>
          prev.map((r) => {
            if (r.post_id !== postId) return r;
            return {
              ...r,
              viewer_liked: prevLiked,
              like_count: Math.max(
                0,
                r.like_count + (prevLiked ? 1 : -1) - (!prevLiked ? 1 : -1)
              ),
            };
          })
        );
        return;
      }

      const row = (res.data?.[0] ?? null) as {
        liked: boolean;
        like_count: number;
      } | null;
      if (!row) return;

      setRows((prev) =>
        prev.map((r) =>
          r.post_id !== postId
            ? r
            : { ...r, viewer_liked: row.liked, like_count: row.like_count }
        )
      );
    },
    [setRows]
  );

  // -------- UI states --------
  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Text style={styles.hintText}>Pull to refresh.</Text>
        </View>

        {/* still allow pull-to-refresh even on error */}
        <View style={{ flex: 1 }}>
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FeedList
        rows={rows}
        refreshing={refreshing}
        onRefresh={onRefresh}
        loadingMore={loadingMore}
        onEndReached={() => {
          if (rows.length >= PAGE_SIZE) loadMore();
        }}
        onToggleLike={toggleLike}
        onOpenComments={openComments}
      />

      <PostModal
        visible={postModalOpen}
        post={selectedPost}
        onClose={closeModal}
        fetchComments={fetchComments}
        addComment={addComment}
        fetchWorkoutDetails={fetchWorkoutDetails}
      />
    </View>
  );
}
