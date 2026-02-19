// app/features/social/feed/FeedItem.tsx

import React from "react";
import { FeedRow } from "./types";

// These will be created next
import { WorkoutPostCard } from "./posts/WorkoutPostCard";
import { PrPostCard } from "./posts/PrPostCard";

type Props = {
  item: FeedRow;
  onToggleLike: (postId: string) => void;
};

export function FeedItem({ item, onToggleLike }: Props) {
  if (item.post_type === "workout") {
    return <WorkoutPostCard item={item} onToggleLike={onToggleLike} />;
  }
  if (item.post_type === "pr") {
    return <PrPostCard item={item} onToggleLike={onToggleLike} />;
  }
  return null;
}