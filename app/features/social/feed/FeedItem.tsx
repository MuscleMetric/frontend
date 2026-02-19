// app/features/social/feed/FeedItem.tsx

import React from "react";
import { FeedRow } from "./types";

// These will be created next
import { WorkoutPostCard } from "./posts/WorkoutPostCard";
import { PrPostCard } from "./posts/PrPostCard";

type Props = {
  item: FeedRow;
};

export function FeedItem({ item }: Props) {
  if (item.post_type === "workout") {
    return <WorkoutPostCard item={item} />;
  }

  if (item.post_type === "pr") {
    return <PrPostCard item={item} />;
  }

  // Unknown / future post types
  return null;
}