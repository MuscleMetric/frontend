// app/features/social/feed/modals/PostModal.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { FeedRow } from "../types";
import type { CommentRow, WorkoutDetailsPayload } from "./types";
import { CommentsList } from "./CommentsList";
import { CommentComposer } from "./CommentComposer";
import { WorkoutDetails } from "./WorkoutDetails";

export function PostModal({
  visible,
  post,
  onClose,

  // wiring hooks (we’ll implement next)
  fetchComments,
  addComment,
  fetchWorkoutDetails,
}: {
  visible: boolean;
  post: FeedRow | null;
  onClose: () => void;

  fetchComments: (postId: string) => Promise<CommentRow[]>;
  addComment: (postId: string, body: string) => Promise<void>;

  fetchWorkoutDetails?: (postId: string) => Promise<WorkoutDetailsPayload | null>;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: colors.bg },

        header: {
          paddingTop: layout.space.lg,
          paddingHorizontal: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.bg,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2 ?? typography.size.h1,
        },
        close: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        closeText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        content: { flex: 1 },
        inner: { paddingHorizontal: layout.space.lg, paddingVertical: layout.space.lg },

        postTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        postSub: {
          marginTop: 4,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        caption: {
          marginTop: layout.space.md,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center",
        },

        commentsHeader: {
          marginTop: layout.space.xl,
          marginBottom: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        commentsTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        commentsCount: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        commentsBox: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.surface,
          overflow: "hidden",
          minHeight: 200,
        },
      }),
    [colors, typography, layout]
  );

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetailsPayload | null>(null);
  const [loadingWorkoutDetails, setLoadingWorkoutDetails] = useState(false);

  // load comments when modal opens
  useEffect(() => {
    if (!visible || !post) return;

    let cancelled = false;
    (async () => {
      setLoadingComments(true);
      try {
        const data = await fetchComments(post.post_id);
        if (!cancelled) setComments(data);
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, post, fetchComments]);

  // lazy load workout details (only for workout posts)
  useEffect(() => {
    if (!visible || !post) return;
    if (post.post_type !== "workout") return;
    if (!fetchWorkoutDetails) return;

    let cancelled = false;
    (async () => {
      setLoadingWorkoutDetails(true);
      try {
        const data = await fetchWorkoutDetails(post.post_id);
        if (!cancelled) setWorkoutDetails(data);
      } finally {
        if (!cancelled) setLoadingWorkoutDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, post, fetchWorkoutDetails]);

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.title}>Post</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.inner}>
            <Text style={styles.postTitle}>
              {(post.post_type ?? "post").toUpperCase()}
            </Text>
            <Text style={styles.postSub}>
              {post.user_name ?? "User"}
              {post.user_username ? ` • @${post.user_username}` : ""}
            </Text>

            {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

            {/* Workout details section (workout posts only) */}
            {post.post_type === "workout" ? (
              <WorkoutDetails loading={loadingWorkoutDetails} data={workoutDetails} />
            ) : null}

            {/* Comments */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments</Text>
              <Text style={styles.commentsCount}>
                {post.comment_count ?? comments.length}
              </Text>
            </View>

            <View style={styles.commentsBox}>
              <CommentsList comments={comments} loading={loadingComments} />
            </View>
          </ScrollView>

          <CommentComposer
            onSubmit={async (body) => {
              // optimistic insert (basic)
              const tempId = `temp_${Date.now()}`;
              const optimistic: CommentRow = {
                id: tempId,
                post_id: post.post_id,
                user_id: "me",
                user_name: "You",
                user_username: null,
                body,
                created_at: new Date().toISOString(),
              };

              setComments((prev) => [optimistic, ...prev]);

              try {
                await addComment(post.post_id, body);
              } catch (e) {
                // revert if failed
                setComments((prev) => prev.filter((c) => c.id !== tempId));
                throw e;
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}