import React from "react";
import { useLocalSearchParams, router } from "expo-router";

import ProfileModalContent from "./ProfileModalContent";

export default function SocialProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return null;

  return (
    <ProfileModalContent
      profileId={String(id)}
      onClose={() => router.back()}
    />
  );
}