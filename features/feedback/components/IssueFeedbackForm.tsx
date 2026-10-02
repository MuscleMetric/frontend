import React, { useState, useRef } from "react";
import { View } from "react-native";

import { Button } from "@/ui/buttons/Button";
import { submitFeedback } from "../data/feedback.mutations";
import type { FeedbackFormProps, FeedbackImpact } from "../types";
import {
  ChoiceChips,
  FeedbackError,
  FeedbackFormContainer,
  FeedbackHeader,
  FeedbackSuccess,
  FeedbackTextArea,
  FormSection,
} from "./FeedbackFormParts";

const ISSUE_CATEGORIES = [
  { value: "workout_logging", label: "Workout logging" },
  { value: "plans_goals", label: "Plans & goals" },
  { value: "progress_analytics", label: "Progress & analytics" },
  { value: "social", label: "Social" },
  { value: "account_settings", label: "Account & settings" },
  { value: "other", label: "Other" },
] as const;

const IMPACT_OPTIONS = [
  { value: "minor", label: "Minor" },
  { value: "annoying", label: "Annoying" },
  { value: "blocked", label: "Stops me using it" },
] as const;

export function IssueFeedbackForm({ sourceScreen, onSubmitted }: FeedbackFormProps) {
  const [category, setCategory] = useState<string>();
  const [message, setMessage] = useState("");
  const [expected, setExpected] = useState("");
  const [impact, setImpact] = useState<FeedbackImpact>();
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitLock.current) return;
    if (!category || !message.trim()) {
      setError("Choose an area and tell us what went wrong.");
      return;
    }

    submitLock.current = true;
    try {
      setSubmitting(true);
      setError(null);
      await submitFeedback({
        type: "issue",
        sourceScreen,
        category,
        message,
        additionalContext: expected,
        impact,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError("We couldn't send this issue. Please try again.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <FeedbackSuccess message="Your report has been saved and can be reviewed by the MuscleMetric team." />;
  }

  return (
    <FeedbackFormContainer>
      <FeedbackHeader
        icon="bug-outline"
        title="Found an issue?"
        description="Tell us what went wrong so we can fix it and make MuscleMetric better."
        tone="danger"
      />

      <FormSection label="Where did the issue happen?">
        <ChoiceChips options={ISSUE_CATEGORIES} value={category} onChange={setCategory} />
      </FormSection>

      <FormSection label="What went wrong?">
        <FeedbackTextArea
          value={message}
          onChangeText={setMessage}
          placeholder="Describe what happened in as much detail as you can..."
        />
      </FormSection>

      <FormSection label="What did you expect to happen?" optional>
        <FeedbackTextArea
          value={expected}
          onChangeText={setExpected}
          placeholder="Tell us what you expected instead..."
        />
      </FormSection>

      <FormSection label="How much does this affect you?" optional>
        <ChoiceChips
          options={IMPACT_OPTIONS}
          value={impact}
          onChange={(value) => setImpact(value as FeedbackImpact)}
        />
      </FormSection>

      <View style={{ gap: 10 }}>
        <FeedbackError message={error} />
        <Button
          title="Submit issue"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || !category || !message.trim()}
        />
      </View>
    </FeedbackFormContainer>
  );
}
