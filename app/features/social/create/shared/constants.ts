// app/features/social/create/shared/constants.ts

import type { Audience } from "../state/createPostTypes";

export const AUDIENCE_OPTIONS: {
  label: string;
  value: Audience;
  description: string;
}[] = [
  {
    label: "Public",
    value: "public",
    description: "Visible to everyone",
  },
  {
    label: "Followers",
    value: "followers",
    description: "Visible to your followers",
  },
  {
    label: "Only Me",
    value: "private",
    description: "Private journal entry",
  },
];

export const MAX_CAPTION_LENGTH = 280;