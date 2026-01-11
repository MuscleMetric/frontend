import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ChallengeBanner from "../../ui/ChallengeBanner";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentPlansCard from "../../ui/RecentPlansCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import SettingsSection from "../../ui/SettingsSection";

export default function NoPlanProfile({ data }: { data: ProfileOverview }) {
  return (
    <>
      <ProfileHeaderCard data={data} />
      <ChallengeBanner />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentPlansCard data={data} />
      <RecentHistoryCard data={data} />
      <SettingsSection />
    </>
  );
}
