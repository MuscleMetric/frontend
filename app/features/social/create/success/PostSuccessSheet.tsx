// app/features/social/create/success/PostSuccessSheet.tsx

import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import type {
  PostType,
  WorkoutSelection,
  WorkoutPostDraft,
  PrSelection,
  PrPostDraft,
} from "../state/createPostTypes";

import PrimaryActionButton from "../shared/PrimaryActionButton";
import ShareExternallyRow from "../shared/ShareExternallyRow";
import PostSuccessPreviewCard from "./PostSuccessPreviewCard";

type Props = {
  visible: boolean;
  onClose: () => void;
  onViewFeed: () => void;
  onShareExternally: () => void;

  postType: PostType | null;

  workout: WorkoutSelection | null;
  workoutDraft: WorkoutPostDraft;

  pr: PrSelection | null;
  prDraft: PrPostDraft;
};

export default function PostSuccessSheet(props: Props) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: Math.max(16, insets.bottom + 12),
        },
        grabberWrap: {
          alignItems: "center",
          marginBottom: 12,
        },
        grabber: {
          width: 44,
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.border,
        },
        header: {
          alignItems: "center",
          marginBottom: 16,
        },
        iconWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        },
        title: {
          fontSize: typography.size.h2,
          fontWeight: "900",
          color: colors.text,
          textAlign: "center",
        },
        subtitle: {
          marginTop: 4,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          textAlign: "center",
          fontWeight: "600",
        },
        previewWrap: {
          marginBottom: 16,
        },
        footerActions: {
          marginTop: 10,
          gap: 10,
        },
        closeText: {
          marginTop: 14,
          textAlign: "center",
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
      }),
    [colors, typography, insets.bottom]
  );

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Icon name={"checkmark-circle"} size={24} color={colors.onPrimary} />
            </View>

            <Text style={styles.title}>Shared with your circle</Text>

            <Text style={styles.subtitle}>
              Your session is now live for your training community.
            </Text>
          </View>

          <View style={styles.previewWrap}>
            <PostSuccessPreviewCard
              postType={props.postType}
              workout={props.workout}
              workoutDraft={props.workoutDraft}
              pr={props.pr}
              prDraft={props.prDraft}
            />
          </View>

          <View style={styles.footerActions}>
            <PrimaryActionButton
              label="View in Feed"
              onPress={props.onViewFeed}
            />

            <ShareExternallyRow onShare={props.onShareExternally} />
          </View>

          <TouchableOpacity onPress={props.onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}