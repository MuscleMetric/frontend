// app/features/social/create/entry/CreatePostSheet.tsx

import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import type { PostType } from "../state/createPostTypes";
import CreatePostOptionRow from "./CreatePostOptionRow";

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (type: PostType) => void;
};

export default function CreatePostSheet({ visible, onClose, onChoose }: Props) {
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
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: Math.max(16, insets.bottom + 12),
        },
        grabberWrap: {
          alignItems: "center",
          marginBottom: 10,
        },
        grabber: {
          width: 44,
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.border,
          opacity: 0.9,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        },
        titleWrap: {
          flex: 1,
        },
        title: {
          fontSize: typography.size.h2,
          fontWeight: "700",
          color: colors.text,
        },
        subtitle: {
          marginTop: 4,
          fontSize: typography.size.meta,
          color: colors.textMuted,
        },
        closeText: {
          fontSize: typography.size.body,
          color: colors.textMuted,
          paddingVertical: 8,
          paddingHorizontal: 10,
        },
        list: {
          gap: 10,
          marginTop: 8,
        },
      }),
    [colors, typography, insets.bottom]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Create Post</Text>
              <Text style={styles.subtitle}>Share your progress with your community</Text>
            </View>

            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            <CreatePostOptionRow
              title="Workout Post"
              subtitle="Share a completed session"
              iconName="barbell-outline"
              onPress={() => onChoose("workout")}
            />
            <CreatePostOptionRow
              title="PR Post"
              subtitle="Share a new personal record"
              iconName="trophy"
              onPress={() => onChoose("pr")}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}