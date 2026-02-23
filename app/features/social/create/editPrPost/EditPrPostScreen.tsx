// app/features/social/create/editPrPost/EditPrPostScreen.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import type { PrSelection, PrPostDraft } from "../state/createPostTypes";
import AudiencePill from "../shared/AudiencePill";
import PrimaryActionButton from "../shared/PrimaryActionButton";
import PrPostPreviewCard from "./PrPostPreviewCard";
import PrCaptionBox from "./PrCaptionBox";

type Props = {
  pr: PrSelection | null;
  draft: PrPostDraft;

  onBack: () => void;

  onChangeAudience: (audience: PrPostDraft["audience"]) => void;
  onChangeCaption: (caption: string) => void;

  onPost: () => void;
  posting?: boolean;
};

export default function EditPrPostScreen(props: Props) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top + 8,
        },
        header: {
          paddingHorizontal: 16,
          marginBottom: 10,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        backBtn: {
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        titleWrap: { flex: 1, marginLeft: 12 },
        title: {
          fontSize: typography.size.h2,
          fontWeight: "900",
          color: colors.text,
        },
        subtitle: {
          marginTop: 2,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        content: {
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        sectionLabel: {
          marginTop: 14,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 12),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        },
      }),
    [colors, typography, insets.top, insets.bottom]
  );

  if (!props.pr) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={props.onBack}>
              <Icon name={"chevron-left" as any} size={18} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Create PR Post</Text>
              <Text style={styles.subtitle}>No PR selected</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={props.onBack}>
            <Icon name={"chevron-left" as any} size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>New PR Post</Text>
            <Text style={styles.subtitle}>Share your achievement</Text>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PrPostPreviewCard pr={props.pr} caption={props.draft.caption} />

        <Text style={styles.sectionLabel}>Audience</Text>
        <AudiencePill value={props.draft.audience} onChange={props.onChangeAudience} />

        <PrCaptionBox value={props.draft.caption} onChange={props.onChangeCaption} />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryActionButton
          label="Share PR"
          onPress={props.onPost}
          loading={props.posting}
          disabled={props.posting}
        />
      </View>
    </View>
  );
}