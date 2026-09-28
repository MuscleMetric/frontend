import React, { useMemo, useState } from "react";
import { View } from "react-native";

import { Button } from "@/ui/buttons/Button";
import { submitFeedback } from "../data/feedback.mutations";
import type { FeedbackFormProps } from "../types";
import {
  FeedbackError,
  FeedbackFormContainer,
  FeedbackHeader,
  FeedbackSuccess,
  FeedbackTextArea,
  FormSection,
  MultiChoiceChips,
  StarRating,
} from "./FeedbackFormParts";

const POSITIVE_TAGS = [
  { value: "easy_to_use", label: "Easy to use" },
  { value: "helpful_analytics", label: "Helpful analytics" },
  { value: "motivating", label: "Motivating" },
  { value: "clean_design", label: "Clean design" },
  { value: "workout_tracking", label: "Great workout tracking" },
] as const;

const IMPROVEMENT_TAGS = [
  { value: "confusing", label: "Confusing" },
  { value: "missing_features", label: "Missing features" },
  { value: "too_buggy", label: "Too buggy" },
  { value: "slow", label: "Slow" },
  { value: "hard_to_use", label: "Hard to use" },
] as const;

export function AppRatingFeedbackForm({ sourceScreen, onSubmitted }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tagOptions = useMemo(
    () => (rating >= 4 ? POSITIVE_TAGS : IMPROVEMENT_TAGS),
    [rating]
  );

  function handleRatingChange(nextRating: number) {
    setRating(nextRating);
    setTags([]);
  }

  function toggleTag(value: string) {
    setTags((current) =>
      current.includes(value)
        ? current.filter((tag) => tag !== value)
        : [...current, value]
    );
  }

  async function handleSubmit() {
    if (!rating) {
      setError("Choose a rating before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await submitFeedback({
        type: "rating",
        sourceScreen,
        rating,
        ratingTags: tags,
        message,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError("We couldn't send your rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <FeedbackSuccess message="Your rating has been saved. It helps us understand where MuscleMetric is working well and where it needs to improve." />;
  }

  return (
    <FeedbackFormContainer>
      <FeedbackHeader
        icon="star-outline"
        title="Rate MuscleMetric"
        description="How would you rate the app overall?"
        tone="primary"
      />

      <StarRating value={rating} onChange={handleRatingChange} />

      {rating ? (
        <FormSection label={rating >= 4 ? "What do you like most?" : "What should we improve?"} optional>
          <MultiChoiceChips options={tagOptions} values={tags} onToggle={toggleTag} />
        </FormSection>
      ) : null}

      <FormSection label="Anything else to share?" optional>
        <FeedbackTextArea
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us more about your experience with MuscleMetric..."
        />
      </FormSection>

      <View style={{ gap: 10 }}>
        <FeedbackError message={error} />
        <Button
          title="Submit rating"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || !rating}
        />
      </View>
    </FeedbackFormContainer>
  );
}
