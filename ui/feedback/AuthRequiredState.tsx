// ui/feedback/AuthRequiredState.tsx
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { EmptyState } from "@/ui";

export function AuthRequiredState({
  title = "Sign in required",
  message = "Please log in to access your training dashboard.",
  ctaLabel = "Go to Login",
  onCta,
}: {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <EmptyState
        title={title}
        message={message}
        ctaLabel={ctaLabel}
        onCta={onCta ?? (() => router.replace("/(auth)/login"))}
      />
    </View>
  );
}
