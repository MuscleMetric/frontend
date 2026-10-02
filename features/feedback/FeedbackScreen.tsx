import React from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@/ui/buttons/Button";
import { useAppTheme } from "@/lib/useAppTheme";
import { IssueFeedbackForm, ImprovementFeedbackForm, AppRatingFeedbackForm } from "./index";
import type { FeedbackType } from "./types";

const titles = { issue: "Report an issue", improvement: "Suggest an improvement", rating: "Rate MuscleMetric" };
export default function FeedbackScreen({ type }: { type: FeedbackType }) {
  const { colors, typography, layout } = useAppTheme();
  const Form = type === "issue" ? IssueFeedbackForm : type === "improvement" ? ImprovementFeedbackForm : AppRatingFeedbackForm;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: layout.space.md, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Button title="Back" variant="secondary" fullWidth={false} onPress={() => router.back()} />
        <Text style={{ flex: 1, color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.h3 }}>{titles[type]}</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Form sourceScreen="settings" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
