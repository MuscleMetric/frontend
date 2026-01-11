import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import OnboardingCard from "../../ui/OnboardingCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import SettingsSection from "../../ui/SettingsSection";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";

export default function NewUserProfile({ data }: { data: ProfileOverview }) {
  const { layout } = useAppTheme();
  return (
    <View style={{ gap: layout.space.md }}>
      <ProfileHeaderCard data={data} />
      <OnboardingCard data={data} />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
      <SettingsSection />
    </View>
  );
}
