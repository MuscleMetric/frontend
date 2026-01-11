import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ChallengeBanner from "../../ui/ChallengeBanner";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentPlansCard from "../../ui/RecentPlansCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import SettingsSection from "../../ui/SettingsSection";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";

export default function NoPlanProfile({ data }: { data: ProfileOverview }) {
  const { layout } = useAppTheme();
  return (
    <View style={{ gap: layout.space.md }}>
      <ProfileHeaderCard data={data} />
      <ChallengeBanner />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentPlansCard data={data} />
      <RecentHistoryCard data={data} />
      <SettingsSection />
    </View>
  );
}
