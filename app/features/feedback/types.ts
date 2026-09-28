export type FeedbackType = "issue" | "improvement" | "rating";

export type FeedbackImpact = "minor" | "annoying" | "blocked";

export type FeedbackSubmission = {
  type: FeedbackType;
  sourceScreen?: string;
  category?: string;
  message?: string;
  additionalContext?: string;
  impact?: FeedbackImpact;
  rating?: number;
  ratingTags?: string[];
};

export type FeedbackFormProps = {
  sourceScreen?: string;
  onSubmitted?: () => void;
};
