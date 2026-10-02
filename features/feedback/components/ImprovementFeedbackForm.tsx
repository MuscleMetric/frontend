import React, { useState, useRef } from "react";
import { View } from "react-native";

import { Button } from "@/ui/buttons/Button";
import { submitFeedback } from "../data/feedback.mutations";
import type { FeedbackFormProps } from "../types";
import {
  ChoiceChips,
  FeedbackError,
  FeedbackFormContainer,
  FeedbackHeader,
  FeedbackSuccess,
  FeedbackTextArea,
  FormSection,
} from "./FeedbackFormParts";

const APP_AREAS = [
  { value: "workout_logging", label: "Workout logging" },
  { value: "plans_goals", label: "Plans & goals" },
  { value: "progress_analytics", label: "Progress & analytics" },
  { value: "social", label: "Social" },
  { value: "account_settings", label: "Account & settings" },
  { value: "other", label: "Other" },
] as const;

export function ImprovementFeedbackForm({ sourceScreen, onSubmitted }: FeedbackFormProps) {
  const [category, setCategory] = useState<string>();
  const [message, setMessage] = useState("");
  const [whyHelpful, setWhyHelpful] = useState("");
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitLock.current) return;
    if (!category || !message.trim()) {
      setError("Choose an area and tell us what you'd improve.");
      return;
    }

    submitLock.current = true;
    try {
      setSubmitting(true);
      setError(null);
      await submitFeedback({
        type: "improvement",
        sourceScreen,
        category,
        message,
        additionalContext: whyHelpful,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError("We couldn't send your suggestion. Please try again.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <FeedbackSuccess message="Your suggestion has been saved and will be available when we review what to build next." />;
  }

  return (
    <FeedbackFormContainer>
      <FeedbackHeader
        icon="bulb-outline"
        title="Suggestion for improvement"
        description="Have an idea that would make MuscleMetric better? Tell us what you'd change."
        tone="success"
      />

      <FormSection label="Which part of the app?">
        <ChoiceChips options={APP_AREAS} value={category} onChange={setCategory} />
      </FormSection>

      <FormSection label="What should we improve?">
        <FeedbackTextArea
          value={message}
          onChangeText={setMessage}
          placeholder="Share the change, feature or improvement you'd like to see..."
        />
      </FormSection>

      <FormSection label="Why would this help you?" optional>
        <FeedbackTextArea
          value={whyHelpful}
          onChangeText={setWhyHelpful}
          placeholder="Tell us how this would improve your experience..."
        />
      </FormSection>

      <View style={{ gap: 10 }}>
        <FeedbackError message={error} />
        <Button
          title="Send suggestion"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || !category || !message.trim()}
        />
      </View>
    </FeedbackFormContainer>
  );
}
