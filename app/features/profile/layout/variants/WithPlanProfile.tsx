import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ActivePlanCard from "../../ui/ActivePlanCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import RecentPostsCard from "../../ui/RecentPostsCard";
import SettingsSection from "../../ui/SettingsSection";

export default function WithPlanProfile({ data }: { data: ProfileOverview }) {
  return (
    <>
      <ProfileHeaderCard data={data} />
      <ActivePlanCard data={data} />
      <ActivityCard data={data} showPlanned={true} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
      <RecentPostsCard data={data} />
      <SettingsSection />
    </>
  );
}
