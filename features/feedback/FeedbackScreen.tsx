import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { IssueFeedbackForm, ImprovementFeedbackForm, AppRatingFeedbackForm } from "./index";
import type { FeedbackType } from "./types";

export default function FeedbackScreen({ type }: { type: FeedbackType }) {
  const { colors, typography, layout } = useAppTheme();
  const Form = type === "issue" ? IssueFeedbackForm : type === "improvement" ? ImprovementFeedbackForm : AppRatingFeedbackForm;
  function returnToPreviousScreen() {
    if (router.canGoBack()) router.back();
    else router.replace("/features/settings");
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: layout.space.lg, paddingVertical: layout.space.sm, flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={returnToPreviousScreen}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: layout.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.cardPressed : colors.surface, borderWidth: 1, borderColor: colors.border })}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sub }}>Feedback</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Form sourceScreen="settings" onReturn={returnToPreviousScreen} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
