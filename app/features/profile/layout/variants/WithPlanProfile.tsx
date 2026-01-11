import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ActivePlanCard from "../../ui/ActivePlanCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import RecentPostsCard from "../../ui/RecentPostsCard";
import SettingsSection from "../../ui/SettingsSection";
import RecentPlansCard from "../../ui/RecentPlansCard";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";

export default function WithPlanProfile({ data }: { data: ProfileOverview }) {
  const { layout } = useAppTheme();
  return (
    <View style={{ gap: layout.space.md }}>
      <ProfileHeaderCard data={data} />
      <ActivePlanCard data={data} />
      <ActivityCard data={data} showPlanned={true} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
      <RecentPostsCard data={data} />
      <RecentPlansCard data={data} />
      <SettingsSection />
    </View>
  );
}
